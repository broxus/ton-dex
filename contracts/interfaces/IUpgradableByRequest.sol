pragma ton-solidity ^0.39.0;

interface IUpgradableByRequest {
    function upgrade(TvmCell code, uint32 new_version, address send_gas_to) external;
}
