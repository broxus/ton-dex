pragma ton-solidity ^0.39.0;

interface ITokenRootDeployedCallback {
    function notifyTokenRootDeployed(uint32 answer_id, address token_root) external;
    function notifyTokenRootNotDeployed(uint32 answer_id, address token_root) external;
}
