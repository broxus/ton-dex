pragma ton-solidity ^0.39.0;

library Gas {

    // ABSOLUTE

    uint128 constant ROOT_INITIAL_BALANCE = 1 ton;
    uint128 constant ACCOUNT_INITIAL_BALANCE = 0.1 ton;
    uint128 constant PAIR_INITIAL_BALANCE = 1 ton;

    // GAS

    uint128 constant DEPLOY_ACCOUNT_MIN_VALUE = 1 micro;
    uint128 constant DEPLOY_PAIR_MIN_VALUE = 5 micro;

    uint128 constant PLATFORM_DEPLOY_VALUE = 0.1 micro;
    uint128 constant SET_PLATFORM_CODE_VALUE = 0.1 micro;

    uint128 constant ACCOUNT_INITIALIZE_VALUE = 0.5 micro;
    uint128 constant PAIR_INITIALIZE_VALUE = 1 micro;

    uint128 constant UPGRADE_ROOT_MIN_VALUE = 10 micro;
    uint128 constant UPGRADE_ACCOUNT_MIN_VALUE = 5 micro;
    uint128 constant UPGRADE_PAIR_MIN_VALUE = 5 micro;

}
