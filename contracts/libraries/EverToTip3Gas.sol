pragma ton-solidity >= 0.57.0;

library EverToTip3Gas {
    uint128 constant TARGET_BALANCE                 = 1 ton;
    uint128 constant DEPLOY_EMPTY_WALLET_VALUE      = 0.5 ton;
    uint128 constant DEPLOY_EMPTY_WALLET_GRAMS      = 0.1 ton;
    uint128 constant SWAP_TIP3_TO_EVER_MIN_VALUE    = 3 ton;
    uint128 constant SWAP_EVER_TO_TIP3_MIN_VALUE    = 4 ton;
}
