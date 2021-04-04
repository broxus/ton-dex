pragma ton-solidity ^0.39.0;

pragma AbiHeader time;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

import "./libraries/PlatformTypes.sol";
import "./libraries/DexErrors.sol";
import "./libraries/Gas.sol";

import "./interfaces/IUpgradableByRequest.sol";
import "./interfaces/IDexRoot.sol";
import "./interfaces/IDexPair.sol";
import "./interfaces/IDexVault.sol";
import "./interfaces/IResetGas.sol";
import "./interfaces/IAfterInitialize.sol";

import "./DexPlatform.sol";

contract DexPair is IDexPair, IUpgradableByRequest, IAfterInitialize, IResetGas {

    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // Data

    // Base:
    address root;
    address vault;
    uint32 current_version;
    TvmCell platform_code;

    // Params:
    address left_root;
    address right_root;

    // Custom:
    address lp_root;
    // Total supply of LP tokens
    uint128 lp_supply = 0;
    // Balances
    uint128 left_balance = 0;
    uint128 right_balance = 0;
    // Fee
    uint16 fee_nominator = 3;
    uint16 fee_denominator = 1000;

    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // Base functions

    // Cant be deployed directly
    constructor() public { revert(); }

    // Prevent manual transfers
    receive() external pure { revert(); }

    // Prevent undefined functions call, need for bounce future Account/Root functions calls, when not upgraded
    fallback() external pure { revert();  }

    // ...and allow root to get surplus gas
    function resetGas(address receiver) override external view onlyRoot {
        tvm.rawReserve(Gas.PAIR_INITIAL_BALANCE, 2);
        receiver.transfer({ value: 0, flag: 128 });
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // Getters

    function getRoot() external view responsible returns (address) {
        return{ value: 0, bounce: false, flag: 64 } root;
    }

    function getTokenRoots() external view responsible returns (address, address) {
        return{ value: 0, bounce: false, flag: 64 } (left_root, right_root);
    }

    function getVersion() external view responsible returns (uint32) {
        return{ value: 0, bounce: false, flag: 64 } current_version;
    }

    function getVault() external view responsible returns (address) {
        return{ value: 0, bounce: false, flag: 64 } vault;
    }

    function getFeeParams() external view responsible returns (uint16 nominator, uint16 denominator) {
        return{ value: 0, bounce: false, flag: 64 } (fee_nominator, fee_denominator);
    }

    // TODO:

    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // Deposit liquidity
    // TODO:

    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // Withdraw liquidity
    // TODO:

    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // Exchange
    // TODO:

    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // Account operations
    // TODO:

    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // Modifiers

    modifier onlyLiquidityTokenRoot() {
        require(msg.sender == lp_root, DexErrors.NOT_LP_TOKEN_ROOT);
        _;
    }

    modifier onlyTokenRoot() {
        require(msg.sender == left_root || msg.sender == right_root, DexErrors.NOT_TOKEN_ROOT);
        _;
    }

    modifier onlyRoot() {
        require(msg.sender == root, DexErrors.NOT_ROOT);
        _;
    }

    modifier onlyVault() {
        require(msg.sender == vault, DexErrors.NOT_VAULT);
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

    modifier onlyPair(address left_root_, address right_root_) {
        address expected = address(tvm.hash(_buildInitData(
                PlatformTypes.Pair,
                _buildPairParams(left_root_, right_root_)
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

    function _buildPairParams(address left_root_, address right_root_) private inline pure returns (TvmCell) {
        TvmBuilder builder;
        if (left_root_.value > right_root_.value) {
            builder.store(left_root_);
            builder.store(right_root_);
        } else {
            builder.store(right_root_);
            builder.store(left_root_);
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
            dataBuilder.store(left_root);
            dataBuilder.store(right_root);
            dataBuilder.store(lp_root);
            // TODO:
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
                        address left_root
                        address right_root
                        [address lp_root]
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

        left_root = data.decode(address);
        right_root = data.decode(address);

        tvm.rawReserve(Gas.PAIR_INITIAL_BALANCE, 2);
        send_gas_to.transfer({ value: 0, flag: 128 });
    }

    function afterInitialize(address send_gas_to) override external onlyRoot {
        tvm.rawReserve(Gas.PAIR_INITIAL_BALANCE, 2);
        if (lp_root.value == 0) {
            IDexVault(vault).addLiquidityToken{ value: 0, flag: 128 }(address(this), left_root, right_root, send_gas_to);
        } else {
            send_gas_to.transfer({ value: 0, flag: 128 });
        }
    }

    function liquidityTokenRootDeployed(address lp_root_, address send_gas_to) override external onlyVault {
        tvm.rawReserve(Gas.PAIR_INITIAL_BALANCE, 2);
        lp_root = lp_root_;
        send_gas_to.transfer({ value: 0, flag: 128 });
    }
}
