pragma ton-solidity >= 0.57.0;

pragma AbiHeader time;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

import "../libraries/DexErrors.sol";
import "../libraries/DexGas.sol";
import "@broxus/contracts/contracts/libraries/MsgFlag.sol";

// This is just for test purposes, this is not a real contract!
contract NewDexRoot {
    uint32 static _nonce;

    TvmCell public platform_code;
    bool has_platform_code;
    TvmCell public account_code;
    uint32 account_version;
    TvmCell public pair_code;
    uint32 pair_version;

    bool active;

    address owner;
    address vault;
    address pending_owner;

    string newTestField;

    constructor() public {revert();}

    function getVault() external view responsible returns (address) {
        return {value : 0, bounce : false, flag : MsgFlag.REMAINING_GAS} vault;
    }

    function getOwner() external view responsible returns (address dex_owner) {
        return { value: 0, bounce: false, flag: MsgFlag.REMAINING_GAS } owner;
    }

    function getPendingOwner() external view responsible returns (address dex_pending_owner) {
        return { value: 0, bounce: false, flag: MsgFlag.REMAINING_GAS } pending_owner;
    }

    function getAccountVersion() external view responsible returns (uint32) {
        return{ value: 0, bounce: false, flag: MsgFlag.REMAINING_GAS } account_version;
    }

    function getPairVersion() external view responsible returns (uint32) {
        return{ value: 0, bounce: false, flag: MsgFlag.REMAINING_GAS } pair_version;
    }

    function setActive(bool new_active) external {
        tvm.rawReserve(DexGas.ROOT_INITIAL_BALANCE, 2);
        if (new_active && has_platform_code && vault.value != 0 && account_version > 0 && pair_version > 0) {
            active = true;
        } else {
            active = false;
        }
        owner.transfer({value : 0, flag : MsgFlag.ALL_NOT_RESERVED});
    }

    function isActive() external view responsible returns (bool) {
        return {value : 0, bounce : false, flag : MsgFlag.REMAINING_GAS} active;
    }

    function onCodeUpgrade(TvmCell data) private {
        tvm.resetStorage();
        TvmSlice s = data.toSlice();
        (account_version, pair_version, owner, vault, pending_owner) =
        s.decode(uint32, uint32, address, address, address);

        platform_code = s.loadRef();
        account_code = s.loadRef();
        pair_code = s.loadRef();

        has_platform_code = true;

        this.setActive(true);

        newTestField = "New Root";

        owner.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED });
    }

    function newFunc() public view returns (string) {
        return newTestField;
    }
}
