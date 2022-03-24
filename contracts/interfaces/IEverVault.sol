pragma ton-solidity >= 0.57.0;

interface IEverVault {
    function wrap(
        uint128 tokens,
        address owner_address,
        address gas_back_address,
        TvmCell payload
    ) external;
}