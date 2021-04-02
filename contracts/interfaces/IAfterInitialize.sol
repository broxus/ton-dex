pragma ton-solidity ^0.39.0;

interface IAfterInitialize {
    function afterInitialize(address send_gas_to) external;
}
