pragma ton-solidity ^0.39.0;

library GasConstants {
    uint128 constant ROOT_INITIAL_BALANCE = 1 ton;
    uint128 constant ACCOUNT_INITIAL_BALANCE = 0.1 ton;
    uint128 constant PAIR_INITIAL_BALANCE = 1 ton;
    uint128 constant DEPLOY_ACCOUNT_MIN_VALUE = 1 ton;
    uint128 constant DEPLOY_PAIR_MIN_VALUE = 5 ton;
    uint128 constant UPGRADE_ACCOUNT_MIN_VALUE = 5 ton;
    uint128 constant UPGRADE_PAIR_MIN_VALUE = 10 ton;
    uint128 constant UPGRADE_ROOT_MIN_VALUE = 10 ton;
}
