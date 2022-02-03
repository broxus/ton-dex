pragma ton-solidity >= 0.56.0;

library Gas {

    // ABSOLUTE

    uint128 constant ROOT_INITIAL_BALANCE           = 1 ton;
    uint128 constant ACCOUNT_INITIAL_BALANCE        = 1 ton;
    uint128 constant PAIR_INITIAL_BALANCE           = 1 ton;
    uint128 constant VAULT_INITIAL_BALANCE          = 1 ton;
    uint128 constant TOKEN_FACTORY_INITIAL_BALANCE  = 1 ton;

    uint128 constant DEPLOY_ACCOUNT_MIN_VALUE       = 2 ton;
    uint128 constant DEPLOY_PAIR_MIN_VALUE          = 5 ton;

    uint128 constant TOKEN_FACTORY_FEE              = 1 ton;
    uint128 constant DEPLOY_TOKEN_ROOT_MIN_VALUE    = 1 ton;
    uint128 constant GET_TOKEN_DETAILS_VALUE        = 0.5 ton;

    uint128 constant PLATFORM_DEPLOY_VALUE          = 0.1 ton;
    uint128 constant SET_PLATFORM_CODE_VALUE        = 0.1 ton;

    uint128 constant ACCOUNT_INITIALIZE_VALUE       = 1 ton;
    uint128 constant PAIR_INITIALIZE_VALUE          = 1 ton;

    uint128 constant UPGRADE_ROOT_MIN_VALUE         = 10 ton;
    uint128 constant UPGRADE_ACCOUNT_MIN_VALUE      = 5 ton;
    uint128 constant UPGRADE_PAIR_MIN_VALUE         = 5 ton;
    uint128 constant UPGRADE_VAULT_MIN_VALUE        = 5 ton;

    uint128 constant WITHDRAW_MIN_VALUE_BASE        = 1 ton;
    uint128 constant TRANSFER_MIN_VALUE             = 1 ton;
    uint128 constant EXCHANGE_MIN_VALUE             = 1 ton;
    uint128 constant DEPOSIT_LIQUIDITY_MIN_VALUE    = 1 ton;
    uint128 constant WITHDRAW_LIQUIDITY_MIN_VALUE   = 1 ton;
    uint128 constant INTERNAL_PAIR_TRANSFER_VALUE   = 0.15 ton;

    uint128 constant DIRECT_PAIR_OP_MIN_VALUE       = 1.5 ton;
    uint128 constant DIRECT_PAIR_OP_MIN_VALUE_V2    = 2 ton;
    uint128 constant SUCCESS_CALLBACK_VALUE         = 0.1 ton;

    uint128 constant VAULT_TRANSFER_BASE_VALUE      = 0.25 ton;
    uint128 constant VAULT_TRANSFER_BASE_VALUE_V2   = 0.5 ton;

    // TOKENS
    uint128 constant TRANSFER_TOKENS_VALUE          = 0.2 ton;
    uint128 constant DEPLOY_MINT_VALUE_BASE         = 0.5 ton;
    uint128 constant BURN_VALUE                     = 0.1 ton;
    uint128 constant DEPLOY_EMPTY_WALLET_VALUE      = 0.5 ton;
    uint128 constant DEPLOY_EMPTY_WALLET_GRAMS      = 0.2 ton;
    uint128 constant SEND_EXPECTED_WALLET_VALUE     = 0.1 ton;

    uint128 constant ADD_PAIR_MIN_VALUE             = 3 ton;

    uint128 constant OPERATION_CALLBACK_BASE        = 0.01 ton;

}
