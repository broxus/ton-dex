pragma ton-solidity >= 0.57.0;

pragma AbiHeader time;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

import 'ton-eth-bridge-token-contracts/contracts/interfaces/ITokenRoot.sol';
import 'ton-eth-bridge-token-contracts/contracts/interfaces/ITokenWallet.sol';
import "ton-eth-bridge-token-contracts/contracts/interfaces/IAcceptTokensTransferCallback.sol";

import "./libraries/DexPlatformTypes.sol";
import "./libraries/DexErrors.sol";
import "./libraries/DexGas.sol";
import "@broxus/contracts/contracts/libraries/MsgFlag.sol";

import "./interfaces/IUpgradableByRequest.sol";
import "./interfaces/IDexRoot.sol";
import "./interfaces/IDexAccount.sol";
import "./interfaces/IDexPair.sol";
import "./interfaces/IDexVault.sol";
import "./interfaces/IResetGas.sol";
import "./interfaces/IDexAccountOwner.sol";

import "./DexPlatform.sol";

contract DexAccount is
    IDexAccount,
    IAcceptTokensTransferCallback,
    IUpgradableByRequest,
    IResetGas
{

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
    // root -> wallet
    mapping(address => address) _wallets;
    // root -> balance
    mapping(address => uint128) _balances;

    // Operations temporary data:
    // call_id -> Operation[]
    mapping(uint64 => Operation) _tmp_operations;
    // token_root -> send_gas_to
    mapping(address => address) _tmp_deploying_wallets;
    // token_root -> (call_id, recipient_address, deploy_wallet_grams)
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
        tvm.rawReserve(DexGas.ACCOUNT_INITIAL_BALANCE, 0);
        receiver.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: false });
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

    function onAcceptTokensTransfer(
        address token_root,
        uint128 tokens_amount,
        address /* sender_address */,
        address sender_wallet,
        address original_gas_to,
        TvmCell payload
    ) override external {

        tvm.rawReserve(DexGas.ACCOUNT_INITIAL_BALANCE, 0);

        TvmSlice payloadSlice = payload.toSlice();
        bool notify_cancel = payloadSlice.refs() >= 1;
        TvmCell cancel_payload;
        if (notify_cancel) {
            cancel_payload = payloadSlice.loadRef();
        }

        if (_wallets.exists(token_root) && msg.sender == _wallets[token_root]) {
            if(_balances.exists(token_root)) {
                _balances[token_root] += tokens_amount;
            } else {
                _balances[token_root] = tokens_amount;
            }

            emit TokensReceived(token_root, tokens_amount, _balances[token_root], sender_wallet);

            TvmCell empty;
            ITokenWallet(msg.sender).transfer{ value: 0, flag: MsgFlag.ALL_NOT_RESERVED }(
                tokens_amount,
                vault,                      // recipient_address
                0,                          // deploy_grams
                original_gas_to,
                false,                      // notify_receiver
                empty
            );
        } else {
            ITokenWallet(msg.sender).transferToWallet{ value: 0, flag: MsgFlag.ALL_NOT_RESERVED }(
                tokens_amount,
                sender_wallet,
                original_gas_to,
                notify_cancel,
                cancel_payload
            );
        }
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // Withdraw

    function withdraw(
        uint64  call_id,
        uint128 amount,
        address token_root,
        address recipient_address,
        uint128 deploy_wallet_grams,
        address send_gas_to
    ) override external onlyOwner {
        require(!_tmp_operations.exists(call_id), DexErrors.OPERATION_ALREADY_IN_PROGRESS);
        require(!_tmp_withdrawals.exists(token_root), DexErrors.ANOTHER_WITHDRAWAL_IN_PROGRESS);
        require(amount > 0, DexErrors.AMOUNT_TOO_LOW);
        require(recipient_address.value != 0, DexErrors.WRONG_RECIPIENT);
        require(msg.value >= DexGas.WITHDRAW_MIN_VALUE_BASE + deploy_wallet_grams, DexErrors.VALUE_TOO_LOW);
        require(_wallets.exists(token_root) && _balances.exists(token_root), DexErrors.UNKNOWN_TOKEN_ROOT);
        require(_balances[token_root] >= amount, DexErrors.NOT_ENOUGH_FUNDS);

        tvm.rawReserve(DexGas.ACCOUNT_INITIAL_BALANCE, 0);

        _balances[token_root] -= amount;

        emit WithdrawTokens(token_root, amount, _balances[token_root]);

        address send_gas_to_ = send_gas_to.value == 0 ? owner : send_gas_to;

        _tmp_operations[call_id] = Operation([TokenOperation(amount, token_root)], send_gas_to_, vault);
        _tmp_withdrawals[token_root] = WithdrawalParams(call_id, recipient_address, deploy_wallet_grams);

        ITokenRoot(token_root)
            .walletOf{
                value: 0,
                flag: MsgFlag.ALL_NOT_RESERVED,
                callback: DexAccount.onVaultTokenWallet
            }(vault);
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // Transfers

    function transfer(
        uint64  call_id,
        uint128 amount,
        address token_root,
        address recipient,
        bool    willing_to_deploy,
        address send_gas_to
    ) override external onlyOwner {
        require(!_tmp_operations.exists(call_id), DexErrors.OPERATION_ALREADY_IN_PROGRESS);
        require(amount > 0, DexErrors.AMOUNT_TOO_LOW);
        require(msg.value >= DexGas.TRANSFER_MIN_VALUE, DexErrors.VALUE_TOO_LOW);
        require(_wallets.exists(token_root) && _balances.exists(token_root), DexErrors.UNKNOWN_TOKEN_ROOT);
        require(_balances[token_root] >= amount, DexErrors.NOT_ENOUGH_FUNDS);

        tvm.rawReserve(DexGas.ACCOUNT_INITIAL_BALANCE, 0);

        _balances[token_root] -= amount;

        emit TransferTokens(token_root, amount, _balances[token_root]);

        address send_gas_to_ = send_gas_to.value == 0 ? owner : send_gas_to;

        address recipient_dex_account = address(tvm.hash(_buildInitData(
            DexPlatformTypes.Account,
            _buildAccountParams(recipient)
        )));

        _tmp_operations[call_id] = Operation([TokenOperation(amount, token_root)], send_gas_to_, recipient_dex_account);

        IDexAccount(recipient_dex_account).internalAccountTransfer{ value: 0, bounce: true, flag: MsgFlag.ALL_NOT_RESERVED }(
            call_id,
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

        tvm.rawReserve(DexGas.ACCOUNT_INITIAL_BALANCE, 0);

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
        tvm.rawReserve(DexGas.ACCOUNT_INITIAL_BALANCE, 0);

        if(_balances.exists(token_root)) {
            _balances[token_root] += amount;
        } else {
            _balances[token_root] = amount;
        }
        emit TokensReceivedFromPair(token_root, amount, _balances[token_root], sender_left_root, sender_right_root);

        send_gas_to.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED + MsgFlag.IGNORE_ERRORS });
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // Pair operations

    function exchange(
        uint64  call_id,
        uint128 spent_amount,
        address spent_token_root,
        address receive_token_root,
        uint128 expected_amount,
        address send_gas_to
    ) override external onlyOwner {
        require(!_tmp_operations.exists(call_id), DexErrors.OPERATION_ALREADY_IN_PROGRESS);
        require(spent_amount > 0, DexErrors.AMOUNT_TOO_LOW);
        require(msg.value >= DexGas.EXCHANGE_MIN_VALUE, DexErrors.VALUE_TOO_LOW);
        require(_wallets.exists(spent_token_root) && _balances.exists(spent_token_root), DexErrors.UNKNOWN_TOKEN_ROOT);
        require(_wallets.exists(receive_token_root), DexErrors.UNKNOWN_TOKEN_ROOT);
        require(_balances[spent_token_root] >= spent_amount, DexErrors.NOT_ENOUGH_FUNDS);

        tvm.rawReserve(DexGas.ACCOUNT_INITIAL_BALANCE, 0);

        address pair = address(tvm.hash(_buildInitData(
            DexPlatformTypes.Pair,
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

        _tmp_operations[call_id] = Operation([TokenOperation(spent_amount, spent_token_root)], send_gas_to_, pair);

        IDexPair(pair).exchange{ value: 0, bounce: true, flag: MsgFlag.ALL_NOT_RESERVED }(
            call_id,
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
        uint64  call_id,
        address left_root,
        uint128 left_amount,
        address right_root,
        uint128 right_amount,
        address expected_lp_root,
        bool    auto_change,
        address send_gas_to
    ) override external onlyOwner {
        require(!_tmp_operations.exists(call_id), DexErrors.OPERATION_ALREADY_IN_PROGRESS);
        require(left_root.value != right_root.value, DexErrors.WRONG_PAIR);
        require(left_root.value != 0, DexErrors.WRONG_PAIR);
        require(right_root.value != 0, DexErrors.WRONG_PAIR);
        require((left_amount > 0 && right_amount > 0) || (auto_change && (left_amount + right_amount > 0)),
                DexErrors.AMOUNT_TOO_LOW);
        require(msg.value >= DexGas.DEPOSIT_LIQUIDITY_MIN_VALUE, DexErrors.VALUE_TOO_LOW);
        require(_wallets.exists(left_root) && _balances.exists(left_root), DexErrors.UNKNOWN_TOKEN_ROOT);
        require(_wallets.exists(right_root) && _balances.exists(right_root), DexErrors.UNKNOWN_TOKEN_ROOT);
        require(_wallets.exists(expected_lp_root) && _balances.exists(expected_lp_root), DexErrors.UNKNOWN_TOKEN_ROOT);
        require(_balances[left_root] >= left_amount, DexErrors.NOT_ENOUGH_FUNDS);
        require(_balances[right_root] >= right_amount, DexErrors.NOT_ENOUGH_FUNDS);

        tvm.rawReserve(DexGas.ACCOUNT_INITIAL_BALANCE, 0);

        address pair = address(tvm.hash(_buildInitData(
            DexPlatformTypes.Pair,
            _buildPairParams(left_root, right_root)
        )));

        _balances[left_root] -= left_amount;
        _balances[right_root] -= right_amount;

        emit DepositLiquidity(left_root, left_amount, right_root, right_amount, auto_change);

        address send_gas_to_ = send_gas_to.value == 0 ? owner : send_gas_to;

        _tmp_operations[call_id] = Operation(
            [TokenOperation(left_amount, left_root), TokenOperation(right_amount, right_root)],
            send_gas_to_,
            pair
        );

        IDexPair(pair).depositLiquidity{ value: 0, bounce: true, flag: MsgFlag.ALL_NOT_RESERVED }(
            call_id,
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
        uint64  call_id,
        uint128 lp_amount,
        address lp_root,
        address left_root,
        address right_root,
        address send_gas_to
    ) override external onlyOwner {
        require(!_tmp_operations.exists(call_id), DexErrors.OPERATION_ALREADY_IN_PROGRESS);
        require(lp_amount > 0, DexErrors.AMOUNT_TOO_LOW);
        require(msg.value >= DexGas.WITHDRAW_LIQUIDITY_MIN_VALUE, DexErrors.VALUE_TOO_LOW);
        require(_wallets.exists(lp_root) && _balances.exists(lp_root), DexErrors.UNKNOWN_TOKEN_ROOT);
        require(_wallets.exists(left_root), DexErrors.UNKNOWN_TOKEN_ROOT);
        require(_wallets.exists(right_root), DexErrors.UNKNOWN_TOKEN_ROOT);
        require(_balances[lp_root] >= lp_amount, DexErrors.NOT_ENOUGH_FUNDS);

        tvm.rawReserve(DexGas.ACCOUNT_INITIAL_BALANCE, 0);

        address pair = address(tvm.hash(_buildInitData(
            DexPlatformTypes.Pair,
            _buildPairParams(left_root, right_root)
        )));

        _balances[lp_root] -= lp_amount;

        emit WithdrawLiquidity(lp_amount, _balances[lp_root], lp_root, left_root, right_root);

        address send_gas_to_ = send_gas_to.value == 0 ? owner : send_gas_to;

        _tmp_operations[call_id] = Operation([TokenOperation(lp_amount, lp_root)], send_gas_to_, pair);

        IDexPair(pair).withdrawLiquidity{ value: 0, bounce: true, flag: MsgFlag.ALL_NOT_RESERVED }(
            call_id,
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
        address right_root
    ) override external onlyOwner {
        require(left_root.value != right_root.value, DexErrors.WRONG_PAIR);
        require(left_root.value != 0, DexErrors.WRONG_PAIR);
        require(right_root.value != 0, DexErrors.WRONG_PAIR);
        require(msg.value >= DexGas.ADD_PAIR_MIN_VALUE, DexErrors.VALUE_TOO_LOW);

        tvm.rawReserve(DexGas.ACCOUNT_INITIAL_BALANCE, 0);

        address expected = address(tvm.hash(_buildInitData(
            DexPlatformTypes.Pair,
            _buildPairParams(left_root, right_root)
        )));

        emit AddPair(left_root, right_root, expected);

        IDexPair(expected).checkPair{ value: 0, bounce: true, flag: MsgFlag.ALL_NOT_RESERVED }(owner, current_version);
    }

    function checkPairCallback(
        address left_root,
        address right_root,
        address lp_root
    ) override external onlyPair(left_root, right_root) {

        tvm.rawReserve(DexGas.ACCOUNT_INITIAL_BALANCE, 0);

        if (!_wallets.exists(left_root)) {
            _deployWallet(left_root, owner);
        }
        if (!_wallets.exists(right_root)) {
            _deployWallet(right_root, owner);
        }
        if (!_wallets.exists(lp_root)) {
            _deployWallet(lp_root, owner);
        }

        owner.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED + MsgFlag.IGNORE_ERRORS });
    }

    function _deployWallet(address token_root, address send_gas_to) private {
        _tmp_deploying_wallets[token_root] = send_gas_to;
        ITokenRoot(token_root)
            .deployWallet {
                value: DexGas.DEPLOY_EMPTY_WALLET_VALUE,
                flag: MsgFlag.SENDER_PAYS_FEES,
                callback: DexAccount.onTokenWallet
            }(
                address(this),                  // owner_address
                DexGas.DEPLOY_EMPTY_WALLET_GRAMS   // deploy_grams
            );
    }

    // callback for ITokenRoot(...).walletOf
    function onTokenWallet(address wallet) external {
        require(_tmp_deploying_wallets.exists(msg.sender) && !_wallets.exists(msg.sender), DexErrors.TODO);

        tvm.rawReserve(DexGas.ACCOUNT_INITIAL_BALANCE, 2);

        address send_gas_to = _tmp_deploying_wallets[msg.sender];

        _wallets[msg.sender] = wallet;
        if(!_balances.exists(msg.sender)) {
            _balances[msg.sender] = 0;
        }
        delete _tmp_deploying_wallets[msg.sender];

        send_gas_to.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED + MsgFlag.IGNORE_ERRORS });
    }

    function onVaultTokenWallet(address wallet) external {
        require(_wallets.exists(msg.sender) && _tmp_withdrawals.exists(msg.sender), DexErrors.TODO);

        tvm.rawReserve(DexGas.ACCOUNT_INITIAL_BALANCE, 0);

        WithdrawalParams w = _tmp_withdrawals[msg.sender];

        Operation operation = _tmp_operations[w.call_id];

        if (operation.expected_callback_sender == vault && operation.token_operations[0].root == msg.sender) {
            delete _tmp_withdrawals[msg.sender];
            IDexVault(vault).withdraw{ value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: true }(
                w.call_id,
                operation.token_operations[0].amount,
                operation.token_operations[0].root,
                wallet,
                w.recipient_address,
                w.deploy_wallet_grams,
                owner,
                current_version,
                operation.send_gas_to
            );
        } else {
            operation.send_gas_to.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED + MsgFlag.IGNORE_ERRORS });
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
            DexPlatformTypes.Account,
            _buildAccountParams(account_owner)
        )));
        require(msg.sender == expected, DexErrors.NOT_ACCOUNT);
        _;
    }

    modifier onlyPair(address left_root, address right_root) {
        address expected = address(tvm.hash(_buildInitData(
            DexPlatformTypes.Pair,
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
        require(msg.value >= DexGas.UPGRADE_ACCOUNT_MIN_VALUE, DexErrors.VALUE_TOO_LOW);
        tvm.rawReserve(DexGas.ACCOUNT_INITIAL_BALANCE, 0);
        emit CodeUpgradeRequested();
        IDexRoot(root).requestUpgradeAccount{ value: 0, flag: MsgFlag.ALL_NOT_RESERVED }(current_version, owner, send_gas_to);
    }

    function upgrade(TvmCell code, uint32 new_version, address send_gas_to) override external onlyRoot {
        if (current_version == new_version) {
            tvm.rawReserve(DexGas.ACCOUNT_INITIAL_BALANCE, 0);
            send_gas_to.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED + MsgFlag.IGNORE_ERRORS });
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

            TvmBuilder tmpBuilder;        // ref3:
            tmpBuilder.store(_tmp_operations);
            tmpBuilder.store(_tmp_deploying_wallets);
            tmpBuilder.store(_tmp_withdrawals);
            builder.storeRef(tmpBuilder);

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

        tvm.rawReserve(DexGas.ACCOUNT_INITIAL_BALANCE, 0);
        send_gas_to.transfer({
            value: 0,
            flag: MsgFlag.ALL_NOT_RESERVED + MsgFlag.IGNORE_ERRORS,
            bounce: false
        });
    }

    // success
    function successCallback(
        uint64 call_id
    ) override external {
        require(_tmp_operations.exists(call_id), DexErrors.INVALID_CALLBACK);
        Operation operation = _tmp_operations[call_id];
        require(operation.expected_callback_sender == msg.sender, DexErrors.INVALID_CALLBACK_SENDER);

        tvm.rawReserve(DexGas.ACCOUNT_INITIAL_BALANCE, 0);

        delete _tmp_operations[call_id];

        if (operation.send_gas_to == owner) {
            IDexAccountOwner(owner).dexAccountOnSuccess{
                value: 0,
                flag: MsgFlag.ALL_NOT_RESERVED + MsgFlag.IGNORE_ERRORS,
                bounce: false
            }(call_id);
        } else {
            IDexAccountOwner(owner).dexAccountOnSuccess{
                value: DexGas.OPERATION_CALLBACK_BASE + 2,
                flag: MsgFlag.SENDER_PAYS_FEES + MsgFlag.IGNORE_ERRORS
            }(call_id);
            operation.send_gas_to.transfer({
                value: 0,
                flag: MsgFlag.ALL_NOT_RESERVED + MsgFlag.IGNORE_ERRORS,
                bounce: false
            });
        }
    }

    // onBounce
    onBounce(TvmSlice body) external {
        tvm.rawReserve(DexGas.ACCOUNT_INITIAL_BALANCE, 0);

        uint32 functionId = body.decode(uint32);

        if (
            functionId == tvm.functionId(IDexPair.exchange) ||
            functionId == tvm.functionId(IDexPair.depositLiquidity) ||
            functionId == tvm.functionId(IDexAccount.internalAccountTransfer) ||
            functionId == tvm.functionId(IDexVault.withdraw))
        {
            uint64 call_id = body.decode(uint64);

            if (_tmp_operations.exists(call_id)) {
                Operation operation = _tmp_operations[call_id];
                delete _tmp_operations[call_id];
                for (TokenOperation op : operation.token_operations) {
                    _balances[op.root] += op.amount;
                    emit OperationRollback(op.root, op.amount, _balances[op.root], msg.sender);
                }

                if (operation.send_gas_to == owner) {
                    IDexAccountOwner(owner).dexAccountOnBounce{
                        value: 0,
                        flag: MsgFlag.ALL_NOT_RESERVED + MsgFlag.IGNORE_ERRORS,
                        bounce: false
                    }(call_id, functionId);
                } else {
                    IDexAccountOwner(owner).dexAccountOnBounce{
                        value: DexGas.OPERATION_CALLBACK_BASE + 1,
                        flag: MsgFlag.SENDER_PAYS_FEES + MsgFlag.IGNORE_ERRORS,
                        bounce: false
                    }(call_id, functionId);
                    operation.send_gas_to.transfer({
                        value: 0,
                        flag: MsgFlag.ALL_NOT_RESERVED + MsgFlag.IGNORE_ERRORS,
                        bounce: false
                    });
                }
            }
        } else if(functionId == tvm.functionId(IDexPair.checkPair)) {
            emit ExpectedPairNotExist(msg.sender);

            IDexAccountOwner(owner).dexAccountOnBounce{
                value: 0,
                flag: MsgFlag.ALL_NOT_RESERVED + MsgFlag.IGNORE_ERRORS,
                bounce: false
            }(0, functionId);
        }
    }
}
