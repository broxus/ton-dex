pragma ton-solidity ^0.39.0;

pragma AbiHeader time;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

contract Test {

    uint32 static _nonce;

    constructor() public {
        tvm.accept();
    }

    function test1() public {
        tvm.accept();
        uint128 a = 303424019600764;
        uint128 b = 1000;
        uint128 c = 67374462762615477834925;
        math.muldiv(a, b, c);
    }
}
