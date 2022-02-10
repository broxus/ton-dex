pragma ton-solidity >= 0.57.0;

pragma AbiHeader time;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

import "../libraries/DexErrors.sol";
import "../libraries/Gas.sol";
import "../libraries/MsgFlag.sol";
import "../structures/ITokenOperationStructure.sol";

// This is just for test purposes, this is not a real contract!
contract TestNewDexAccount is ITokenOperationStructure {
    address root;
    address vault;
    uint32 current_version;
    TvmCell public platform_code;

    struct WithdrawalParams {
        uint64  call_id;
        address recipient_address;
        uint128 deploy_wallet_grams;
    }

    struct Operation {
        TokenOperation[] token_operations;
        address send_gas_to;
        address expected_callback_sender;
    }

    // Params:
    address owner;

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

    string newTestField;

    constructor() public {revert();}

    function getRoot() external view responsible returns (address) {
        return { value: 0, bounce: false, flag: MsgFlag.REMAINING_GAS } root;
    }

    function getOwner() external view responsible returns (address) {
        return { value: 0, bounce: false, flag: MsgFlag.REMAINING_GAS } owner;
    }

    function getVersion() external view responsible returns (uint32) {
        return { value: 0, bounce: false, flag: MsgFlag.REMAINING_GAS } current_version;
    }

    function getVault() external view responsible returns (address) {
        return { value: 0, bounce: false, flag: MsgFlag.REMAINING_GAS } vault;
    }

    function getWalletData(address token_root) external view responsible returns (address wallet, uint128 balance) {
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

    function onCodeUpgrade(TvmCell data) private {
        tvm.rawReserve(Gas.PAIR_INITIAL_BALANCE, 2);
        tvm.resetStorage();
        TvmSlice s = data.toSlice();
        uint32 old_version;
        address send_gas_to;
        (root, vault, old_version, current_version, send_gas_to) =
        s.decode(address, address, uint32, uint32, address);

        platform_code = s.loadRef();
        TvmSlice old_contract_data = s.loadRefAsSlice();
        owner = old_contract_data.decode(address);
        _wallets = old_contract_data.decode(mapping(address => address));
        _balances = old_contract_data.decode(mapping(address => uint128));

        TvmSlice old_contract_tmp_data = s.loadRefAsSlice();
        _tmp_operations = old_contract_tmp_data.decode(mapping(uint64 => Operation));
        _tmp_deploying_wallets = old_contract_tmp_data.decode(mapping(address => address));
        _tmp_withdrawals = old_contract_tmp_data.decode(mapping(address => WithdrawalParams));

        newTestField = "New Account";

        send_gas_to.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED });
    }

    function newFunc() public view returns (string) {
        return newTestField;
    }
}
