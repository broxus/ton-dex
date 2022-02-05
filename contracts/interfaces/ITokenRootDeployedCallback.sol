pragma ton-solidity >= 0.57.0;

interface ITokenRootDeployedCallback {
    function onTokenRootDeployed(uint32 callId, address tokenRoot) external;
}
