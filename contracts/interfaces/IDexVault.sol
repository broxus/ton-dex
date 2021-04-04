pragma ton-solidity ^0.39.0;

interface IDexVault {
    /*
        1) спарвшивает детали у рутов
        2) деплоит новый рут, где пул является овнером
        3) у нового рута деплоит кошельки для
           пула
           субя
        4) у переданных рутов деплоит кошельки
           для пула
           для себя
        5) запрашивает expected address для себя в каждом руте
        6) проставляет receiveCallback
        7) уведомляет пул о lp-руте.
    */
    function addLiquidityToken(address pair, address left_root, address right_root, address send_gas_to) external;



    function deployTokenWallet(address owner, address token_root, address send_gas_to) external;
    function withdrawRequest(uint64 callbackId, uint128 amount, address token_root, address owner) external;
}
