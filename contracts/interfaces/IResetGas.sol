pragma ton-solidity >= 0.57.0;

interface IResetGas {
    function resetGas(address receiver) external view;
}
