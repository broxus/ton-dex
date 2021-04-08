pragma ton-solidity ^0.39.0;

interface IDexPair {

    event DepositLiquidity(uint128 left, uint128 right, uint128 lp);
    event WithdrawLiquidity(uint128 lp, uint128 left, uint128 right);
    event ExchangeLeftToRight(uint128 left, uint128 fee, uint128 right);
    event ExchangeRightToLeft(uint128 right, uint128 fee, uint128 left);

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

    function getRoot() external view responsible returns (address);

    function getTokenRoots() external view responsible returns (address left_root, address right_root, address lp_root);

    function getVersion() external view responsible returns (uint32);

    function getVault() external view responsible returns (address);

    function getFeeParams() external view responsible returns (uint16 nominator, uint16 denominator);

    function isActive() external view responsible returns (bool);

    function expectedExchange(
        uint128 amount,
        bool is_left_to_right
    ) external view responsible returns (uint128 expected_amount, uint128 expected_fee);

    function expectedDepositLiquidity(
        uint128 left_amount,
        uint128 right_amount,
        bool auto_change
    ) external view responsible returns (DepositLiquidityResult);

    function expectedWithdrawLiquidity(
        uint128 lp_amount
    ) external view responsible returns (uint128 expected_left_amount, uint128 expected_right_amount);

    //////////////////////////////////////////////////////////////////////////////////////////////////////
    // INTERNAL

    function checkPair(
        uint64 call_id,
        address account_owner,
        uint32 account_version,
        address send_gas_to
    ) external;

    function liquidityTokenRootDeployed(address lp_root, address send_gas_to) external;
    function liquidityTokenRootNotDeployed(address lp_root, address send_gas_to) external;

    function exchange(
        uint64 call_id,
        uint128 spent_amount,
        address spent_token_root,
        address receive_token_root,
        uint128 expected_amount,
        address account_owner,
        uint32 account_version,
        address send_gas_to
    ) external;

    function depositLiquidity(
        uint64 call_id,
        uint128 left_amount,
        uint128 right_amount,
        bool    auto_change,
        address account_owner,
        uint32 account_version,
        address send_gas_to
    ) external;

    function withdrawLiquidity(
        uint64 call_id,
        uint128 lp_amount,
        address expected_lp_root,
        address account_owner,
        uint32 account_version,
        address send_gas_to
    ) external;
}
