pragma ton-solidity ^0.39.0;

pragma AbiHeader time;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

import "./libraries/DexErrors.sol";

contract DexPlatform {

    address public static root;
    uint8 public static type_id;
    TvmCell public static params;

    TvmCell platform_code;
    bool has_platform_code;

    constructor() public onlyRoot {
        tvm.accept();
    }

    function setPlatformCode(TvmCell code) external onlyRoot {
        require(!has_platform_code, DexErrors.PLATFORM_CODE_NON_EMPTY);
        platform_code = code;
        has_platform_code = true;
    }

    function initialize(TvmCell code, uint32 version, address vault, address send_gas_to) external onlyRoot {
        require(has_platform_code, DexErrors.PLATFORM_CODE_EMPTY);

        TvmBuilder builder;

        builder.store(root);
        builder.store(vault);
        builder.store(uint32(0));
        builder.store(version);
        builder.store(send_gas_to);

        builder.store(platform_code); // ref 1
        builder.store(params);        // ref 2

        // set code after complete this method
        tvm.setcode(code);

        // run onCodeUpgrade from new code
        tvm.setCurrentCode(code);
        onCodeUpgrade(builder.toCell());
    }

    function onCodeUpgrade(TvmCell data) private {}

    modifier onlyRoot() {
        require(msg.sender == root, DexErrors.NOT_ROOT);
        _;
    }
}
