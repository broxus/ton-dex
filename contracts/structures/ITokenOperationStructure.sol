pragma ton-solidity >= 0.57.0;

interface ITokenOperationStructure {
    struct TokenOperation {
        uint128 amount;
        address root;
    }
}
