pragma ton-solidity >= 0.57.0;

interface IExchangeResult {
    struct ExchangeResult {
        bool left_to_right;
        uint128 spent;
        uint128 fee;
        uint128 received;
    }
}
