pragma ton-solidity >= 0.56.0;

interface IDexAccountOwner {
    function dexAccountOnSuccess(uint64 nonce) external;
    function dexAccountOnBounce(uint64 nonce, uint32 functionId) external;
}
