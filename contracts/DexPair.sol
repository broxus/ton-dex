pragma ton-solidity ^0.39.0;

pragma AbiHeader time;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

contract DexPair {
    // cant be deployed directly
    constructor() public { revert(); }
}
