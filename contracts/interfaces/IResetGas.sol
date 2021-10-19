pragma ton-solidity >= 0.39.0;

interface IResetGas {
    function resetGas(address receiver) external view;
}
