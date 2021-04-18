pragma ton-solidity ^0.39.0;

pragma AbiHeader time;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

import '../node_modules/ton-eth-bridge-token-contracts/free-ton/contracts/interfaces/IRootTokenContract.sol';
import '../node_modules/ton-eth-bridge-token-contracts/free-ton/contracts/interfaces/ITONTokenWallet.sol';
import "../node_modules/ton-eth-bridge-token-contracts/free-ton/contracts/interfaces/ITokensReceivedCallback.sol";
import "../node_modules/ton-eth-bridge-token-contracts/free-ton/contracts/interfaces/IExpectedWalletAddressCallback.sol";

import "./libraries/PlatformTypes.sol";
import "./libraries/DexErrors.sol";
import "./libraries/Gas.sol";
import "./libraries/MsgFlag.sol";

import "./structures/ITokenOperationStructure.sol";

import "./interfaces/IUpgradableByRequest.sol";
import "./interfaces/IDexRoot.sol";
import "./interfaces/IDexAccount.sol";
import "./interfaces/IDexPair.sol";
import "./interfaces/IDexVault.sol";
import "./interfaces/IResetGas.sol";

import "./DexPlatform.sol";

contract DexAccount is
    IDexAccount,
    IExpectedWalletAddressCallback,
    ITokensReceivedCallback,
    ITokenOperationStructure,
    IUpgradableByRequest,
    IResetGas
{

    struct WithdrawalParams {
        uint64  call_id;
        uint256 recipient_public_key;
        address recipient_address;
        uint128 deploy_wallet_grams;
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // Data:

    // Base:
    address root;
    address vault;
    uint32 current_version;
    TvmCell public platform_code;

    // Params:
    address owner;

    // Custom:
    uint64 _nonce;
    // root -> wallet
    mapping(address => address) _wallets;
    // root -> balance
    mapping(address => uint128) _balances;

    // Operations temporary data:
    // token_root -> true
    mapping(address => bool) _tmp_deploying_wallets;
    // _nonce -> TokenOperation[]
    mapping(uint64 => TokenOperation[]) _tmp_operations;
    // _nonce -> send_gas_to
    mapping(uint64 => address) _tmp_send_gas_to;
    // _nonce -> expected_confirmation_sender
    mapping(uint64 => address) _tmp_expected_callback_sender;
    // token_root -> (_nonce, recipient_public_key, recipient_address, deploy_wallet_grams)
    mapping(address => WithdrawalParams) _tmp_withdrawals;

    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // Base functions

    // Cant be deployed directly
    constructor() public { revert(); }

    // Prevent manual transfers
    receive() external pure { revert(); }

    // Prevent undefined functions call, need for bounce future Pair/Root functions calls, when not upgraded
    fallback() external pure { revert(); }

    // ...and allow user to get surplus gas
    function resetGas(address receiver) override external view onlyOwner {
        tvm.rawReserve(Gas.ACCOUNT_INITIAL_BALANCE, 2);
        receiver.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED });
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // Getters

    function getRoot() override external view responsible returns (address) {
        return { value: 0, bounce: false, flag: MsgFlag.REMAINING_GAS } root;
    }

    function getOwner() override external view responsible returns (address) {
        return { value: 0, bounce: false, flag: MsgFlag.REMAINING_GAS } owner;
    }

    function getVersion() override external view responsible returns (uint32) {
        return { value: 0, bounce: false, flag: MsgFlag.REMAINING_GAS } current_version;
    }

    function getVault() override external view responsible returns (address) {
        return { value: 0, bounce: false, flag: MsgFlag.REMAINING_GAS } vault;
    }

    function getWalletData(address token_root) override external view responsible returns (address wallet, uint128 balance) {
        return { value: 0, bounce: false, flag: MsgFlag.REMAINING_GAS } (
            _wallets.exists(token_root) ? _wallets.at(token_root) : address.makeAddrStd(0, 0),
            _balances.exists(token_root) ? _balances.at(token_root) : 0
        );
    }

    function getWallets() external view returns (mapping(address => address)) {
        return _wallets;
    }

    function getBalances() external view returns (mapping(address => uint128)) {
        return _balances;
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // Deposit

    function tokensReceivedCallback(
        address token_wallet,
        address token_root,
        uint128 tokens_amount,
        uint256 /*sender_public_key*/,
        address /*sender_address*/,
        address sender_wallet,
        address original_gas_to,
        uint128 /*updated_balance*/,
        TvmCell payload
    ) override external {

        tvm.rawReserve(Gas.ACCOUNT_INITIAL_BALANCE, 2);

        TvmSlice payloadSlice = payload.toSlice();
        bool notify_cancel = payloadSlice.refs() >= 1;
        TvmCell cancel_payload;
        if (notify_cancel) {
            cancel_payload = payloadSlice.loadRef();
        }

        if (_wallets.exists(token_root) && msg.sender == _wallets[token_root] && msg.sender == token_wallet) {
            if(_balances.exists(token_root)) {
                _balances[token_root] += tokens_amount;
            } else {
                _balances[token_root] = tokens_amount;
            }

            emit TokensReceived(token_root, tokens_amount, _balances[token_root], sender_wallet);

            TvmCell empty;
            ITONTokenWallet(token_wallet).transferToRecipient{ value: 0, flag: MsgFlag.ALL_NOT_RESERVED }(
                0,                          // recipient_public_key
                vault,                      // recipient_address
                tokens_amount,
                0,                          // deploy_grams
                0,                          // transfer_grams
                original_gas_to,
                false,                      // notify_receiver
                empty
            );
        } else {
            ITONTokenWallet(token_wallet).transfer{ value: 0, flag: MsgFlag.ALL_NOT_RESERVED }(
                sender_wallet,
                tokens_amount,
                0,                          // grams
                original_gas_to,
                notify_cancel,
                cancel_payload
            );
        }
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // Withdraw

    function withdraw(
        uint128 amount,
        address token_root,
        uint256 recipient_public_key,
        address recipient_address,
        uint128 deploy_wallet_grams,
        address send_gas_to
    ) override external onlyOwner {
        require(!_tmp_withdrawals.exists(token_root), DexErrors.ANOTHER_WITHDRAWAL_IN_PROGRESS);
        require(amount > 0, DexErrors.AMOUNT_TOO_LOW);
        require(recipient_address.value == 0 || recipient_public_key == 0, DexErrors.WRONG_RECIPIENT);
        require(recipient_address.value != 0 || recipient_public_key != 0, DexErrors.WRONG_RECIPIENT);
        require(msg.value >= Gas.WITHDRAW_MIN_VALUE_BASE + deploy_wallet_grams, DexErrors.VALUE_TOO_LOW);
        require(_wallets.exists(token_root) && _balances.exists(token_root), DexErrors.UNKNOWN_TOKEN_ROOT);
        require(_balances[token_root] >= amount, DexErrors.NOT_ENOUGH_FUNDS);

        tvm.rawReserve(Gas.ACCOUNT_INITIAL_BALANCE, 2);

        _balances[token_root] -= amount;

        emit WithdrawTokens(token_root, amount, _balances[token_root]);

        address send_gas_to_ = send_gas_to.value == 0 ? owner : send_gas_to;

        _nonce++;
        _tmp_operations[_nonce] = [TokenOperation(amount, token_root)];
        _tmp_send_gas_to[_nonce] = send_gas_to_;
        _tmp_expected_callback_sender[_nonce] = vault;
        _tmp_withdrawals[token_root] = WithdrawalParams(_nonce, recipient_public_key, recipient_address, deploy_wallet_grams);

        IRootTokenContract(token_root)
            .sendExpectedWalletAddress{
                value: Gas.SEND_EXPECTED_WALLET_VALUE,
                bounce: true,
                flag: MsgFlag.ALL_NOT_RESERVED
            }(
                0,                              // wallet_public_key_
                vault,                          // owner_address_
                address(this)                   // to
            );
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // Transfers

    function transfer(
        uint128 amount,
        address token_root,
        address to_dex_account,
        bool    willing_to_deploy,
        address send_gas_to
    ) override external onlyOwner {
        require(amount > 0, DexErrors.AMOUNT_TOO_LOW);
        require(msg.value >= Gas.TRANSFER_MIN_VALUE, DexErrors.VALUE_TOO_LOW);
        require(_wallets.exists(token_root) && _balances.exists(token_root), DexErrors.UNKNOWN_TOKEN_ROOT);
        require(_balances[token_root] >= amount, DexErrors.NOT_ENOUGH_FUNDS);

        tvm.rawReserve(Gas.ACCOUNT_INITIAL_BALANCE, 2);

        _balances[token_root] -= amount;

        emit TransferTokens(token_root, amount, _balances[token_root]);

        address send_gas_to_ = send_gas_to.value == 0 ? owner : send_gas_to;

        _nonce++;
        _tmp_operations[_nonce] = [TokenOperation(amount, token_root)];
        _tmp_send_gas_to[_nonce] = send_gas_to_;
        _tmp_expected_callback_sender[_nonce] = to_dex_account;

        IDexAccount(to_dex_account).internalAccountTransfer{ value: 0, bounce: true, flag: MsgFlag.ALL_NOT_RESERVED }(
            _nonce,
            amount,
            token_root,
            owner,
            willing_to_deploy,
            send_gas_to_
        );
    }

    function internalAccountTransfer(
        uint64 call_id,
        uint128 amount,
        address token_root,
        address sender_owner,
        bool    willing_to_deploy,
        address send_gas_to
    ) override external onlyAccount(sender_owner) {
        require(willing_to_deploy || _wallets.exists(token_root) || _tmp_deploying_wallets.exists(token_root), DexErrors.UNKNOWN_TOKEN_ROOT);

        tvm.rawReserve(Gas.ACCOUNT_INITIAL_BALANCE, 2);

        if(_balances.exists(token_root)) {
            _balances[token_root] += amount;
        } else {
            _balances[token_root] = amount;
        }
        emit TokensReceivedFromAccount(token_root, amount, _balances[token_root], sender_owner);

        if (willing_to_deploy && !_wallets.exists(token_root) && !_tmp_deploying_wallets.exists(token_root)) {
            _deployWallet(token_root, send_gas_to);
        }

        IDexAccount(msg.sender).successCallback{ value: 0, flag: MsgFlag.ALL_NOT_RESERVED }(call_id);
    }

    function internalPairTransfer(
        uint128 amount,
        address token_root,
        address sender_left_root,
        address sender_right_root,
        address send_gas_to
    ) override external onlyPair(sender_left_root, sender_right_root) {
        tvm.rawReserve(Gas.ACCOUNT_INITIAL_BALANCE, 2);

        if(_balances.exists(token_root)) {
            _balances[token_root] += amount;
        } else {
            _balances[token_root] = amount;
        }
        emit TokensReceivedFromPair(token_root, amount, _balances[token_root], sender_left_root, sender_right_root);

        send_gas_to.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED });
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // Pair operations

    function exchange(
        uint128 spent_amount,
        address spent_token_root,
        address receive_token_root,
        uint128 expected_amount,
        address send_gas_to
    ) override external onlyOwner {
        require(spent_amount > 0, DexErrors.AMOUNT_TOO_LOW);
        require(msg.value >= Gas.EXCHANGE_MIN_VALUE, DexErrors.VALUE_TOO_LOW);
        require(_wallets.exists(spent_token_root) && _balances.exists(spent_token_root), DexErrors.UNKNOWN_TOKEN_ROOT);
        require(_wallets.exists(receive_token_root), DexErrors.UNKNOWN_TOKEN_ROOT);
        require(_balances[spent_token_root] >= spent_amount, DexErrors.NOT_ENOUGH_FUNDS);

        tvm.rawReserve(Gas.ACCOUNT_INITIAL_BALANCE, 2);

        address pair = address(tvm.hash(_buildInitData(
            PlatformTypes.Pair,
            _buildPairParams(spent_token_root, receive_token_root)
        )));

        _balances[spent_token_root] -= spent_amount;

        emit ExchangeTokens(
            spent_token_root,
            receive_token_root,
            spent_amount,
            expected_amount,
            _balances[spent_token_root]
        );

        address send_gas_to_ = send_gas_to.value == 0 ? owner : send_gas_to;

        _nonce++;
        _tmp_operations[_nonce] = [TokenOperation(spent_amount, spent_token_root)];
        _tmp_send_gas_to[_nonce] = send_gas_to_;
        _tmp_expected_callback_sender[_nonce] = pair;

        IDexPair(pair).exchange{ value: 0, bounce: true, flag: MsgFlag.ALL_NOT_RESERVED }(
            _nonce,
            spent_amount,
            spent_token_root,
            receive_token_root,
            expected_amount,
            owner,
            current_version,
            send_gas_to_
        );
    }

    function depositLiquidity(
        address left_root,
        uint128 left_amount,
        address right_root,
        uint128 right_amount,
        address expected_lp_root,
        bool    auto_change,
        address send_gas_to
    ) override external onlyOwner {
        require(left_root.value != right_root.value, DexErrors.WRONG_PAIR);
        require(left_root.value != 0, DexErrors.WRONG_PAIR);
        require(right_root.value != 0, DexErrors.WRONG_PAIR);
        require((left_amount > 0 && right_amount > 0) || (auto_change && (left_amount + right_amount > 0)),
                DexErrors.AMOUNT_TOO_LOW);
        require(msg.value >= Gas.DEPOSIT_LIQUIDITY_MIN_VALUE, DexErrors.VALUE_TOO_LOW);
        require(_wallets.exists(left_root) && _balances.exists(left_root), DexErrors.UNKNOWN_TOKEN_ROOT);
        require(_wallets.exists(right_root) && _balances.exists(right_root), DexErrors.UNKNOWN_TOKEN_ROOT);
        require(_wallets.exists(expected_lp_root) && _balances.exists(expected_lp_root), DexErrors.UNKNOWN_TOKEN_ROOT);
        require(_balances[left_root] >= left_amount, DexErrors.NOT_ENOUGH_FUNDS);
        require(_balances[right_root] >= right_amount, DexErrors.NOT_ENOUGH_FUNDS);

        tvm.rawReserve(Gas.ACCOUNT_INITIAL_BALANCE, 2);

        address pair = address(tvm.hash(_buildInitData(
            PlatformTypes.Pair,
            _buildPairParams(left_root, right_root)
        )));

        _balances[left_root] -= left_amount;
        _balances[right_root] -= right_amount;

        emit DepositLiquidity(left_root, left_amount, right_root, right_amount, auto_change);

        address send_gas_to_ = send_gas_to.value == 0 ? owner : send_gas_to;

        _nonce++;
        _tmp_operations[_nonce] = [
            TokenOperation(left_amount, left_root),
            TokenOperation(right_amount, right_root)
        ];
        _tmp_send_gas_to[_nonce] = send_gas_to_;
        _tmp_expected_callback_sender[_nonce] = pair;

        IDexPair(pair).depositLiquidity{ value: 0, bounce: true, flag: MsgFlag.ALL_NOT_RESERVED }(
            _nonce,
            left_root.value < right_root.value ? left_amount : right_amount,
            left_root.value < right_root.value ? right_amount : left_amount,
            expected_lp_root,
            auto_change,
            owner,
            current_version,
            send_gas_to_
        );
    }

    function withdrawLiquidity(
        uint128 lp_amount,
        address lp_root,
        address left_root,
        address right_root,
        address send_gas_to
    ) override external onlyOwner {

        require(lp_amount > 0, DexErrors.AMOUNT_TOO_LOW);
        require(msg.value >= Gas.WITHDRAW_LIQUIDITY_MIN_VALUE, DexErrors.VALUE_TOO_LOW);
        require(_wallets.exists(lp_root) && _balances.exists(lp_root), DexErrors.UNKNOWN_TOKEN_ROOT);
        require(_wallets.exists(left_root), DexErrors.UNKNOWN_TOKEN_ROOT);
        require(_wallets.exists(right_root), DexErrors.UNKNOWN_TOKEN_ROOT);
        require(_balances[lp_root] >= lp_amount, DexErrors.NOT_ENOUGH_FUNDS);

        tvm.rawReserve(Gas.ACCOUNT_INITIAL_BALANCE, 2);

        address pair = address(tvm.hash(_buildInitData(
            PlatformTypes.Pair,
            _buildPairParams(left_root, right_root)
        )));

        _balances[lp_root] -= lp_amount;

        emit WithdrawLiquidity(lp_amount, _balances[lp_root], lp_root, left_root, right_root);

        address send_gas_to_ = send_gas_to.value == 0 ? owner : send_gas_to;

        _nonce++;
        _tmp_operations[_nonce] = [TokenOperation(lp_amount, lp_root)];
        _tmp_send_gas_to[_nonce] = send_gas_to_;
        _tmp_expected_callback_sender[_nonce] = pair;

        IDexPair(pair).withdrawLiquidity{ value: 0, bounce: true, flag: MsgFlag.ALL_NOT_RESERVED }(
            _nonce,
            lp_amount,
            lp_root,
            owner,
            current_version,
            send_gas_to_
        );
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // Add wallets flow

    function addPair(
        address left_root,
        address right_root,
        address send_gas_to
    ) override external onlyOwner {
        require(left_root.value != right_root.value, DexErrors.WRONG_PAIR);
        require(left_root.value != 0, DexErrors.WRONG_PAIR);
        require(right_root.value != 0, DexErrors.WRONG_PAIR);
        require(msg.value >= Gas.ADD_PAIR_MIN_VALUE, DexErrors.VALUE_TOO_LOW);

        tvm.rawReserve(Gas.ACCOUNT_INITIAL_BALANCE, 2);

        address expected = address(tvm.hash(_buildInitData(
            PlatformTypes.Pair,
            _buildPairParams(left_root, right_root)
        )));

        emit AddPair(left_root, right_root, expected);

        address send_gas_to_ = send_gas_to.value == 0 ? owner : send_gas_to;

        _nonce++;
        _tmp_send_gas_to[_nonce] = send_gas_to_;

        IDexPair(expected).checkPair{ value: 0, bounce: true, flag: MsgFlag.ALL_NOT_RESERVED }(_nonce, owner, current_version, send_gas_to_);
    }

    function checkPairCallback(
        uint64 original_call_id,
        address left_root,
        address right_root,
        address lp_root,
        address send_gas_to
    ) override external onlyPair(left_root, right_root) {

        tvm.rawReserve(Gas.ACCOUNT_INITIAL_BALANCE, 2);

        delete _tmp_send_gas_to[original_call_id];

        if (!_wallets.exists(left_root)) {
            _deployWallet(left_root, send_gas_to);
        }
        if (!_wallets.exists(right_root)) {
            _deployWallet(right_root, send_gas_to);
        }
        if (!_wallets.exists(lp_root)) {
            _deployWallet(lp_root, send_gas_to);
        }

        send_gas_to.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED });
    }

    function _deployWallet(address token_root, address send_gas_to) private {
        _tmp_deploying_wallets[token_root] = true;
        IRootTokenContract(token_root)
            .deployEmptyWallet {
                value: Gas.DEPLOY_EMPTY_WALLET_VALUE,
                flag: MsgFlag.SENDER_PAYS_FEES
            }(
                Gas.DEPLOY_EMPTY_WALLET_GRAMS,  // deploy_grams
                0,                              // wallet_public_key
                address(this),                  // owner_address
                send_gas_to                     // gas_back_address
            );
        IRootTokenContract(token_root)
            .sendExpectedWalletAddress{
                value: Gas.SEND_EXPECTED_WALLET_VALUE,
                flag: MsgFlag.SENDER_PAYS_FEES
            }(
                0,                              // wallet_public_key_
                address(this),                  // owner_address_
                address(this)                   // to
            );
    }

    // callback for IRootTokenContract(...).sendExpectedWalletAddress
    function expectedWalletAddressCallback(
        address wallet,
        uint256 wallet_public_key,
        address owner_address
    ) override external {
        require(wallet_public_key == 0);
        tvm.rawReserve(Gas.ACCOUNT_INITIAL_BALANCE, 2);

        if (_tmp_deploying_wallets[msg.sender] && owner_address == address(this) && !_wallets.exists(msg.sender)) {
            _wallets[msg.sender] = wallet;
            if(!_balances.exists(msg.sender)) {
                _balances[msg.sender] = 0;
            }
            delete _tmp_deploying_wallets[msg.sender];

            ITONTokenWallet(wallet).setReceiveCallback{ value: 0, flag: MsgFlag.ALL_NOT_RESERVED }(address(this), false);
        } else if (owner_address == vault && _wallets.exists(msg.sender) && _tmp_withdrawals.exists(msg.sender)) {
            WithdrawalParams w = _tmp_withdrawals[msg.sender];

            TokenOperation operation = _tmp_operations[w.call_id][0];
            address send_gas_to = _tmp_send_gas_to[w.call_id];

            if (_tmp_expected_callback_sender[w.call_id] == vault && operation.root == msg.sender) {
                delete _tmp_withdrawals[msg.sender];
                IDexVault(vault).withdraw{ value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: true }(
                    w.call_id,
                    operation.amount,
                    operation.root,
                    wallet,
                    w.recipient_public_key,
                    w.recipient_address,
                    w.deploy_wallet_grams,
                    owner,
                    current_version,
                    send_gas_to
                );
            } else {
                send_gas_to.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED });
            }
        }
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, DexErrors.NOT_MY_OWNER);
        _;
    }
    modifier onlyRoot() {
        require(msg.sender == root, DexErrors.NOT_ROOT);
        _;
    }

    modifier onlyAccount(address account_owner) {
        address expected = address(tvm.hash(_buildInitData(
            PlatformTypes.Account,
            _buildAccountParams(account_owner)
        )));
        require(msg.sender == expected, DexErrors.NOT_ACCOUNT);
        _;
    }

    modifier onlyPair(address left_root, address right_root) {
        address expected = address(tvm.hash(_buildInitData(
            PlatformTypes.Pair,
            _buildPairParams(left_root, right_root)
        )));
        require(msg.sender == expected, DexErrors.NOT_PAIR);
        _;
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // Address calculations
    function _buildAccountParams(address account_owner) private inline pure returns (TvmCell) {
        TvmBuilder builder;
        builder.store(account_owner);
        return builder.toCell();
    }

    function _buildPairParams(address left_root, address right_root) private inline pure returns (TvmCell) {
        TvmBuilder builder;
        if (left_root.value < right_root.value) {
            builder.store(left_root);
            builder.store(right_root);
        } else {
            builder.store(right_root);
            builder.store(left_root);
        }
        return builder.toCell();
    }

    function _buildInitData(uint8 type_id, TvmCell params) private inline view returns (TvmCell) {
        return tvm.buildStateInit({
            contr: DexPlatform,
            varInit: {
                root: root,
                type_id: type_id,
                params: params
            },
            pubkey: 0,
            code: platform_code
        });
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // Code upgrade
    function requestUpgrade(address send_gas_to) external view onlyOwner {
        require(msg.value >= Gas.UPGRADE_ACCOUNT_MIN_VALUE, DexErrors.VALUE_TOO_LOW);
        tvm.rawReserve(Gas.ACCOUNT_INITIAL_BALANCE, 2);
        emit CodeUpgradeRequested();
        IDexRoot(root).requestUpgradeAccount{ value: 0, flag: MsgFlag.ALL_NOT_RESERVED }(current_version, owner, send_gas_to);
    }

    function upgrade(TvmCell code, uint32 new_version, address send_gas_to) override external onlyRoot {
        if (current_version == new_version || !_tmp_deploying_wallets.empty() || !_tmp_operations.empty() ||
            !_tmp_send_gas_to.empty() || !_tmp_expected_callback_sender.empty()) {
            tvm.rawReserve(Gas.PAIR_INITIAL_BALANCE, 2);
            send_gas_to.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED });
        } else {
            emit AccountCodeUpgraded(new_version);

            TvmBuilder builder;

            builder.store(root);
            builder.store(vault);
            builder.store(current_version);
            builder.store(new_version);
            builder.store(send_gas_to);

            builder.store(platform_code);  // ref1 = platform_code

            TvmBuilder dataBuilder;        // ref2:
            dataBuilder.store(owner);      //   owner
            dataBuilder.store(_wallets);   //   _wallets
            dataBuilder.store(_balances);  //   _balances
            builder.storeRef(dataBuilder);

            // set code after complete this method
            tvm.setcode(code);

            // run onCodeUpgrade from new code
            tvm.setCurrentCode(code);
            onCodeUpgrade(builder.toCell());
        }
    }

    /*
        upgrade_data
            bits:
                uint32 old_version - zero if initialize
                uint32 new_version
                address root
                address send_gas_to
            refs:
                1: platform_code
                2: data
                    bits:
                        address owner
                        [mapping(address => address) _wallets]
                        [mapping(address => uint128) _balances]
    */
    function onCodeUpgrade(TvmCell upgrade_data) private {
        TvmSlice s = upgrade_data.toSlice();
        (address root_, address vault_, uint32 old_version, uint32 new_version, address send_gas_to) =
            s.decode(address, address, uint32, uint32, address);

        if (old_version == 0) {
            tvm.resetStorage();
        }

        root = root_;
        vault = vault_;
        current_version = new_version;

        platform_code = s.loadRef();        // ref 1
        TvmSlice data = s.loadRefAsSlice(); // ref 2

        owner = data.decode(address);

        tvm.rawReserve(Gas.ACCOUNT_INITIAL_BALANCE, 2);
        send_gas_to.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED });
    }

    // success
    function successCallback(
        uint64 call_id
    ) override external {
        require(!_tmp_expected_callback_sender.exists(call_id), DexErrors.INVALID_CALLBACK);
        require(_tmp_expected_callback_sender.at(call_id) == msg.sender, DexErrors.INVALID_CALLBACK_SENDER);

        delete _tmp_operations[call_id];
        delete _tmp_expected_callback_sender[call_id];

        address send_gas_to = _tmp_send_gas_to.exists(call_id) ? _tmp_send_gas_to.at(call_id) : owner;
        delete _tmp_send_gas_to[call_id];

        send_gas_to.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED });
    }

    function gc() onlyOwner external {
        delete _tmp_deploying_wallets;
        delete _tmp_operations;
        delete _tmp_send_gas_to;
        delete _tmp_expected_callback_sender;
        delete _tmp_withdrawals;
        emit GarbageCollected();
    }

    // onBounce
    onBounce(TvmSlice body) external {
        tvm.accept();
        tvm.rawReserve(Gas.ACCOUNT_INITIAL_BALANCE, 2);

        uint32 functionId = body.decode(uint32);
        if (functionId == tvm.functionId(IDexPair.exchange) ||
            functionId == tvm.functionId(IDexPair.depositLiquidity) ||
            functionId == tvm.functionId(IDexAccount.internalAccountTransfer) ||
            functionId == tvm.functionId(IDexVault.withdraw)) {
            uint64 call_id = body.decode(uint64);
            if (_tmp_operations.exists(call_id) &&
                _tmp_expected_callback_sender.exists(call_id) &&
                _tmp_expected_callback_sender[call_id] == msg.sender)
            {
                for (TokenOperation op : _tmp_operations.at(call_id)) { // iteration over array
                    _balances[op.root] += op.amount;
                    emit OperationRollback(op.root, op.amount, _balances[op.root], msg.sender);
                }
            }

            delete _tmp_operations[call_id];
            delete _tmp_expected_callback_sender[call_id];

            address send_gas_to = _tmp_send_gas_to.exists(call_id) ? _tmp_send_gas_to.at(call_id) : owner;
            delete _tmp_send_gas_to[call_id];

            send_gas_to.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED });
        } else if(functionId == tvm.functionId(IDexPair.checkPair)) {
            emit ExpectedPairNotExist(msg.sender);
            uint64 call_id = body.decode(uint64);

            address send_gas_to = _tmp_send_gas_to.exists(call_id) ? _tmp_send_gas_to.at(call_id) : owner;
            delete _tmp_send_gas_to[call_id];

            send_gas_to.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED });
        }
    }
}
