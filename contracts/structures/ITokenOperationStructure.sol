pragma ton-solidity ^0.39.0;

interface ITokenOperationStructure {
    struct TokenOperation {
        uint128 amount;
        address root;
    }
}
