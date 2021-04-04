pragma ton-solidity ^0.39.0;

library LiquidityPoolMath {

    function expectedFee(
        uint128 amount,
        uint16 fee_nominator,
        uint16 fee_denominator
    ) public pure returns (uint128 expected_fee) {
        return math.muldiv(amount, fee_nominator, fee_denominator);
    }

    function expectedExchange(
        uint128 a_amount,
        uint128 a_pool,
        uint128 b_pool,
        uint16 fee_nominator,
        uint16 fee_denominator
    ) public pure returns (uint128 expected_amount, uint128 expected_fee) {
        uint128 a_fee = expectedFee(a_amount, fee_nominator, fee_denominator);

        uint128 new_a_pool = a_pool + a_amount;
        uint128 new_b_pool = math.muldiv(a_pool, b_pool, new_a_pool - a_fee);
        uint128 expected_b_amount = b_pool - new_b_pool;

        return (expected_b_amount, a_fee);
    }
    
    
    function expectedDepositLiquidity(
        uint128 a_amount,
        uint128 b_amount,
        uint128 a_pool,
        uint128 b_pool,
        uint128 lp_supply,
        uint16 fee_nominator,
        uint16 fee_denominator,
        bool auto_change
    ) public pure returns (
        uint128 step_1_a_deposit,
        uint128 step_1_b_deposit,
        uint128 step_1_lp_reward,

        bool step_2_a_to_b,
        bool step_2_b_to_a,
        uint128 step_2_spent,
        uint128 step_2_fee,
        uint128 step_2_received,

        uint128 step_3_a_deposit,
        uint128 step_3_b_deposit,
        uint128 step_3_lp_reward
    ) {
        // step 1 (first deposit)
        uint128 s1_a_deposit = math.min(a_amount, math.muldiv(a_pool, b_amount, b_pool));
        uint128 s1_b_deposit = math.min(b_amount, math.muldiv(b_pool, a_amount, a_pool));
        uint128 s1_lp_reward = math.max(
            math.muldiv(s1_b_deposit, lp_supply, b_pool),
            math.muldiv(s1_a_deposit, lp_supply, a_pool)
        );

        uint128 current_a_amount = a_amount - s1_a_deposit;
        uint128 current_b_amount = b_amount - s1_b_deposit;
        uint128 current_a_pool = a_pool + s1_a_deposit;
        uint128 current_b_pool = b_pool + s1_b_deposit;
        uint128 current_lp_supply = lp_supply + s1_lp_reward;

        bool s2_a_to_b = false;
        bool s2_b_to_a = false;
        uint128 s2_spent = 0;
        uint128 s2_fee = 0;
        uint128 s2_received = 0;

        uint128 s3_a_deposit = 0;
        uint128 s3_b_deposit = 0;
        uint128 s3_lp_reward = 0;

        uint256 fee_d_minus_n = uint256(fee_denominator - fee_nominator);

        if (auto_change && current_b_amount > 0) {
            // step 2 (surplus TON exchange)
            s2_b_to_a = true;
            uint256 p = math.muldiv(current_b_pool, fee_d_minus_n + fee_denominator, fee_d_minus_n);
            uint256 q = math.muldiv(current_b_amount * current_b_pool, fee_denominator, fee_d_minus_n);
            s2_spent = solveQuadraticEquationPQ(p, q);
            (s2_received, s2_fee) = expectedExchange(s2_spent, current_b_pool, current_a_pool, fee_nominator, fee_denominator);

            current_b_amount = current_b_amount - s2_spent;
            current_b_pool = current_b_pool + s2_spent;

            // step 3 (deposit exchanged amounts)
            s3_b_deposit = current_b_amount;
            s3_a_deposit = s2_received;

            s3_lp_reward = math.muldiv(current_b_amount, current_lp_supply, current_b_pool);
        } else if (auto_change && current_a_amount > 0) {
            // step 2 (surplus tokens exchange)
            s2_a_to_b = true;
            uint256 p = math.muldiv(current_a_pool, fee_d_minus_n + fee_denominator, fee_d_minus_n);
            uint256 q = math.muldiv(current_a_amount * current_a_pool, fee_denominator, fee_d_minus_n);
            s2_spent = solveQuadraticEquationPQ(p, q);
            (s2_received, s2_fee) = expectedExchange(s2_spent, current_a_pool, current_b_pool, fee_nominator, fee_denominator);

            current_a_amount = current_a_amount - s2_spent;
            current_a_pool = current_a_pool + s2_spent;

            // step 3 (deposit exchanged amounts)
            s3_a_deposit = current_a_amount;
            s3_b_deposit = s2_received;

            s3_lp_reward = math.muldiv(current_a_amount, current_lp_supply, current_a_pool);
        }

        return (
            s1_a_deposit,
            s1_b_deposit,
            s1_lp_reward,

            s2_a_to_b,
            s2_b_to_a,
            s2_spent,
            s2_fee,
            s2_received,

            s3_a_deposit,
            s3_b_deposit,
            s3_lp_reward
        );
    }

    // Solve x*x + p*x - q*x = 0; and return max(x1, x2))
    function solveQuadraticEquationPQ(uint256 p, uint256 q) public pure returns (uint128) {
        uint256 D = math.muldiv(p, p, 4) + q;
        uint256 Dsqrt = sqrt(D);
        if (Dsqrt > (p/2)) {
            return uint128(Dsqrt - (p/2));
        } else {
            return uint128((p/2) - Dsqrt);
        }
    }

    // Babylonian method for finding sqrt
    function sqrt(uint256 x) public pure returns (uint256) {
        if (x == 0) return 0;
        else if (x <= 3) return 1;
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        while (z < y)
        {
            y = z;
            z = (x / z + z) / 2;
        }
        return y;
    }
}
