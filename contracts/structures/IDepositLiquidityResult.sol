pragma ton-solidity >= 0.56.0;

interface IDepositLiquidityResult {
    struct DepositLiquidityResult {
        uint128 step_1_left_deposit;
        uint128 step_1_right_deposit;
        uint128 step_1_lp_reward;

        bool step_2_left_to_right;
        bool step_2_right_to_left;
        uint128 step_2_spent;
        uint128 step_2_fee;
        uint128 step_2_received;

        uint128 step_3_left_deposit;
        uint128 step_3_right_deposit;
        uint128 step_3_lp_reward;
    }
}
