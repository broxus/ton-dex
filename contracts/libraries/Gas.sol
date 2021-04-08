pragma ton-solidity ^0.39.0;

library Gas {

    // ABSOLUTE

    uint128 constant ROOT_INITIAL_BALANCE           = 1 ton;
    uint128 constant ACCOUNT_INITIAL_BALANCE        = 0.1 ton;
    uint128 constant PAIR_INITIAL_BALANCE           = 1 ton;

    uint128 constant DEPLOY_ACCOUNT_MIN_VALUE       = 1 ton;
    uint128 constant DEPLOY_PAIR_MIN_VALUE          = 5 ton;

    uint128 constant TOKEN_FACTORY_FEE = 1 ton;
    uint128 constant DEPLOY_TOKEN_ROOT_MIN_VALUE = 1 ton;

    uint128 constant PLATFORM_DEPLOY_VALUE          = 0.1 ton;
    uint128 constant SET_PLATFORM_CODE_VALUE        = 0.1 ton;

    uint128 constant ACCOUNT_INITIALIZE_VALUE       = 0.5 ton;
    uint128 constant PAIR_INITIALIZE_VALUE          = 1 ton;

    uint128 constant UPGRADE_ROOT_MIN_VALUE         = 10 ton;
    uint128 constant UPGRADE_ACCOUNT_MIN_VALUE      = 5 ton;
    uint128 constant UPGRADE_PAIR_MIN_VALUE         = 5 ton;

    uint128 constant WITHDRAW_MIN_VALUE             = 1 ton;
    uint128 constant TRANSFER_MIN_VALUE             = 1 ton;
    uint128 constant EXCHANGE_MIN_VALUE             = 1 ton;
    uint128 constant DEPOSIT_LIQUIDITY_MIN_VALUE    = 1 ton;
    uint128 constant WITHDRAW_LIQUIDITY_MIN_VALUE   = 1 ton;
    uint128 constant INTERNAL_PAIR_TRANSFER_VALUE   = 0.1 ton;

    // TOKENS
    uint128 constant TRANSFER_VALUE                 = 0.1 ton;
    uint128 constant TRANSFER_TO_RECIPIENT_VALUE    = 0.2 ton;
    uint128 constant MINT_VALUE                     = 0.03 ton;
    uint128 constant BURN_VALUE                     = 0.1 ton;
    uint128 constant DEPLOY_EMPTY_WALLET_VALUE      = 0.1 ton;
    uint128 constant DEPLOY_EMPTY_WALLET_GRAMS      = 0.2 ton;
    uint128 constant SEND_EXPECTED_WALLET_VALUE     = 0.1 ton;

    uint128 constant ADD_PAIR_MIN_VALUE             = 3 ton;

}
