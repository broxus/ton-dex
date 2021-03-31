pragma ton-solidity ^0.39.0;

library DexErrors {
    uint8 constant NOT_MY_OWNER                 = 100;
    uint8 constant NOT_ROOT                     = 101;
    uint8 constant NOT_PENDING_OWNER            = 102;
    uint8 constant VALUE_TOO_LOW                = 103;
    uint8 constant NOT_PLATFORM                 = 104;
    uint8 constant NOT_ACCOUNT                  = 105;
    uint8 constant NOT_PAIR                     = 106;
    uint8 constant PLATFORM_CODE_EMPTY          = 107;
    uint8 constant PLATFORM_CODE_NON_EMPTY      = 108;
    uint8 constant ACCOUNT_CODE_EMPTY           = 109;
    uint8 constant PAIR_CODE_EMPTY              = 110;
    uint8 constant INVALID_ADDRESS              = 111;
}
