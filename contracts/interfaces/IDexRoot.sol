pragma ton-solidity ^0.39.0;

interface IDexRoot {
    function requestUpgradeAccount(uint32 current_version, address send_gas_to, address owner) external;
}
