pragma ton-solidity >= 0.56.0;

interface IResetGas {
    function resetGas(address receiver) external view;
}
