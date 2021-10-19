pragma ton-solidity >= 0.39.0;

library DexErrors {
    uint8 constant NOT_MY_OWNER                     = 100;
    uint8 constant NOT_ROOT                         = 101;
    uint8 constant NOT_PENDING_OWNER                = 102;
    uint8 constant VALUE_TOO_LOW                    = 103;
    uint8 constant NOT_PLATFORM                     = 104;
    uint8 constant NOT_ACCOUNT                      = 105;
    uint8 constant NOT_PAIR                         = 106;
    uint8 constant PLATFORM_CODE_EMPTY              = 107;
    uint8 constant PLATFORM_CODE_NON_EMPTY          = 108;
    uint8 constant ACCOUNT_CODE_EMPTY               = 109;
    uint8 constant PAIR_CODE_EMPTY                  = 110;
    uint8 constant INVALID_ADDRESS                  = 111;
    uint8 constant NOT_TOKEN_ROOT                   = 112;
    uint8 constant NOT_LP_TOKEN_ROOT                = 113;
    uint8 constant NOT_ACTIVE                       = 114;
    uint8 constant NOT_VAULT                        = 115;
    uint8 constant AMOUNT_TOO_LOW                   = 116;
    uint8 constant UNKNOWN_TOKEN_ROOT               = 117;
    uint8 constant NOT_ENOUGH_FUNDS                 = 118;
    uint8 constant INVALID_CALLBACK                 = 119;
    uint8 constant INVALID_CALLBACK_SENDER          = 120;
    uint8 constant WRONG_PAIR                       = 121;
    uint8 constant ANOTHER_WITHDRAWAL_IN_PROGRESS   = 122;
    uint8 constant LOW_EXCHANGE_RATE                = 123;
    uint8 constant NOT_LP_PENDING_CONTRACT          = 124;
    uint8 constant NOT_TOKEN_FACTORY                = 125;
    uint8 constant NOT_EXPECTED_TOKEN               = 126;
    uint8 constant WRONG_LIQUIDITY                  = 127;
    uint8 constant WRONG_RECIPIENT                  = 128;
    uint8 constant WRONG_PAIR_VERSION               = 129;
}
