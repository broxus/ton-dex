pragma ton-solidity >= 0.56.0;

interface ITokenOperationStructure {
    struct TokenOperation {
        uint128 amount;
        address root;
    }
}
