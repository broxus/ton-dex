pragma ton-solidity ^0.39.0;

interface IDexPair {

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

    //////////////////////////////////////////////////////////////////////////////////////////////////////
    // INTERNAL

    function checkPair(
        uint64 call_id,
        address account_owner,
        uint32 account_version,
        address send_gas_to
    ) external;

    function liquidityTokenRootDeployed(address lp_root, address send_gas_to) external;

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

    function expectedDepositLiquidity(
        uint128 left_amount,
        uint128 right_amount,
        bool auto_change
    ) external view responsible returns (DepositLiquidityResult);

    function depositLiquidity(
        uint64 call_id,
        uint128 left_amount,
        uint128 right_amount,
        address account_owner,
        uint32 account_version,
        address send_gas_to
    ) external;
}
