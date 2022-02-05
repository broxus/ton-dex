pragma ton-solidity >= 0.57.0;

interface IWithdrawResult {
    struct WithdrawResult {
        uint128 lp;
        uint128 left;
        uint128 right;
    }
}
