pragma ton-solidity >= 0.57.0;

interface ISwapEver {
    function swapEvers (
        address user, 
        TvmCell payload
    ) external;
}