pragma ton-solidity ^0.39.0;

interface IDexPair {
    function liquidityTokenRootDeployed(address lp_root, address send_gas_to) external;
}
