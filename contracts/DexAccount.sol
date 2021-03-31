pragma ton-solidity ^0.39.0;

pragma AbiHeader time;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

import "./libraries/DexErrors.sol";
import "./libraries/GasConstants.sol";
import "./interfaces/IUpgradableByRequest.sol";
import "./interfaces/IDexRoot.sol";

contract DexAccount is IUpgradableByRequest {

    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // Data
    address root;
    uint32 current_version;
    address owner;
    /* root -> wallet */
    mapping(address => address) _wallets;
    /* root -> balance */
    mapping(address => uint128) _balances;

    TvmCell platform_code;

    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // Base functions

    // Cant be deployed directly
    constructor() public { revert(); }

    // Prevent manual transfers
    receive() external pure { revert(); }

    // Allow fallback, for save user gas, if he call Root.deployAccount when already deployed ...
    fallback() external pure {  }

    // ...and allow user to get surplus gas
    function resetGas(address receiver) external view onlyOwner {
        tvm.rawReserve(GasConstants.ACCOUNT_INITIAL_BALANCE, 2);
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

    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // Withdraw

    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // Code upgrade
    function requestUpgrade(address send_gas_to) external view onlyOwner {
        tvm.rawReserve(GasConstants.ACCOUNT_INITIAL_BALANCE, 2);
        IDexRoot(root).requestUpgradeAccount{ value: 0, flag: 128 }(current_version, owner, send_gas_to);
    }

    function upgrade(TvmCell code, uint32 new_version, address send_gas_to) override external onlyRoot {
        TvmBuilder builder;

        builder.store(root);
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
        (address original_root, uint32 old_version, uint32 new_version, address send_gas_to) =
            s.decode(address, uint32, uint32, address);

        if (old_version == 0) {
            tvm.resetStorage();
        }

        root = original_root;
        current_version = new_version;

        platform_code = s.loadRef();        // ref 1
        TvmSlice data = s.loadRefAsSlice(); // ref 2

        owner = data.decode(address);

        tvm.rawReserve(GasConstants.ACCOUNT_INITIAL_BALANCE, 2);
        send_gas_to.transfer({ value: 0, flag: 128 });
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
}
