pragma ton-solidity >= 0.57.0;

import "../libraries/DexErrors.sol";
import "../libraries/DexGas.sol";
import "@broxus/contracts/contracts/libraries/MsgFlag.sol";

// This is just for test purposes, this is not a real contract!
contract NewDexVault {
    uint32 static _nonce;

    TvmCell public platform_code;

    TvmCell public lp_token_pending_code;

    address public root;
    address public owner;
    address public pending_owner;

    address public token_factory;

    string newTestField;

    constructor() public {revert();}

    function onCodeUpgrade(TvmCell data) private {
        tvm.resetStorage();
        TvmSlice s = data.toSlice();
        (root, token_factory) = s.decode(address, address);

        TvmCell owners_data = s.loadRef();
        (owner, pending_owner) = owners_data.toSlice().decode(address, address);

        platform_code = s.loadRef();
        lp_token_pending_code = s.loadRef();

        newTestField = "New Vault";

        owner.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED });
    }

    function newFunc() public view returns (string) {
        return newTestField;
    }
}
