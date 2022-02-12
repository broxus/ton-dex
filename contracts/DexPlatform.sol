pragma ton-solidity >= 0.57.0;

pragma AbiHeader time;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

import "./libraries/DexErrors.sol";
import "@broxus/contracts/contracts/libraries/MsgFlag.sol";

contract DexPlatform {

    address static root;
    uint8 static type_id;
    TvmCell static params;

    constructor(TvmCell code, uint32 version, address vault, address send_gas_to) public {
        if (msg.sender == root) {
           _initialize(code, version, vault, send_gas_to);
        } else {
            send_gas_to.transfer({
                value: 0,
                flag: MsgFlag.ALL_NOT_RESERVED + MsgFlag.DESTROY_IF_ZERO,
                bounce: false
            });
        }
    }

    function _initialize(TvmCell code, uint32 version, address vault, address send_gas_to) private {
        TvmBuilder builder;

        builder.store(root);
        builder.store(vault);
        builder.store(uint32(0));
        builder.store(version);
        builder.store(send_gas_to);

        builder.store(tvm.code());    // ref 1
        builder.store(params);        // ref 2

        // set code after complete this method
        tvm.setcode(code);

        // run onCodeUpgrade from new code
        tvm.setCurrentCode(code);
        onCodeUpgrade(builder.toCell());
    }

    function onCodeUpgrade(TvmCell data) private {}
}
