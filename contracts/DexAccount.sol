pragma ton-solidity ^0.39.0;

pragma AbiHeader time;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

import "./libraries/PlatformTypes.sol";
import "./libraries/DexErrors.sol";
import "./libraries/Gas.sol";

import "./interfaces/IUpgradableByRequest.sol";
import "./interfaces/IDexRoot.sol";
import "./interfaces/IDexVault.sol";
import "./interfaces/IResetGas.sol";

import "./DexPlatform.sol";

contract DexAccount is IUpgradableByRequest, IResetGas {

    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // Data:

    // Base:
    address root;
    address vault;
    uint32 current_version;
    TvmCell platform_code;

    // Params:
    address owner;

    // Custom:
    // root -> wallet
    mapping(address => address) _wallets;
    // root -> balance
    mapping(address => uint128) _balances;

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
        receiver.transfer({ value: 0, flag: 128 });
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // Getters

    function getRoot() external view responsible returns (address) {
        return{ value: 0, bounce: false, flag: 64 } root;
    }

    function getOwner() external view responsible returns (address) {
        return{ value: 0, bounce: false, flag: 64 } owner;
    }

    function getVersion() external view responsible returns (uint32) {
        return{ value: 0, bounce: false, flag: 64 } current_version;
    }

    function getVault() external view responsible returns (address) {
        return{ value: 0, bounce: false, flag: 64 } vault;
    }

    // returns account wallet_address and balance
    function getWalletData(address token_root) external view responsible returns (address, uint128) {
        if(_wallets.exists(token_root) && _balances.exists(token_root)) {
            return{ value: 0, bounce: false, flag: 64 } (_wallets.at(token_root), _balances.at(token_root));
        } else {
            return{ value: 0, bounce: false, flag: 64 } (address.makeAddrStd(0, 0), 0);
        }
    }
    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // Deposit
    // TODO:

    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // Withdraw
    // TODO:

    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // Transfers
    // TODO:

    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // Pair operations
    // TODO:

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
        if (left_root.value > right_root.value) {
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
                root: address(this),
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
        require(msg.value >= gasToValue(Gas.UPGRADE_ACCOUNT_MIN_VALUE, Gas.WID), DexErrors.VALUE_TOO_LOW);
        tvm.rawReserve(Gas.ACCOUNT_INITIAL_BALANCE, 2);
        IDexRoot(root).requestUpgradeAccount{ value: 0, flag: 128 }(current_version, owner, send_gas_to);
    }

    function upgrade(TvmCell code, uint32 new_version, address send_gas_to) override external onlyRoot {
        if (current_version == new_version) {
            send_gas_to.transfer({ value: 0, flag: 128 });
        } else {
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
        vault_ = vault_;
        current_version = new_version;

        platform_code = s.loadRef();        // ref 1
        TvmSlice data = s.loadRefAsSlice(); // ref 2

        owner = data.decode(address);

        tvm.rawReserve(Gas.ACCOUNT_INITIAL_BALANCE, 2);
        send_gas_to.transfer({ value: 0, flag: 128 });
    }
}
