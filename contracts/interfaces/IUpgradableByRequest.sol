pragma ton-solidity >= 0.57.0;

interface IUpgradableByRequest {
    function upgrade(TvmCell code, uint32 new_version, address send_gas_to) external;
}
