pragma ton-solidity >= 0.56.0;

interface IWithdrawResult {
    struct WithdrawResult {
        uint128 lp;
        uint128 left;
        uint128 right;
    }
}
