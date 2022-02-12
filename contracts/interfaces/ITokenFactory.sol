pragma ton-solidity >= 0.57.0;

import "ton-eth-bridge-token-contracts/contracts/interfaces/ITokenRoot.sol";

interface ITokenFactory {

    event TokenCreated(address tokenRoot);

    function createToken(
        uint32 callId,
        string name,
        string symbol,
        uint8 decimals,
        address initialSupplyTo,
        uint128 initialSupply,
        uint128 deployWalletValue,
        bool mintDisabled,
        bool burnByRootDisabled,
        bool burnPaused,
        address remainingGasTo
    ) external;
}
