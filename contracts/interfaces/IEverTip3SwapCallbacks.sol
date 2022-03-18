pragma ton-solidity >= 0.57.0;

interface IEverTip3SwapCallbacks {
    function onSwapEverToTip3Cancel(
        uint64 id
     ) external;

    function onSwapEverToTip3Success(
        uint64 id,
        uint128 amount
     ) external;

     function onSwapTip3ToEverCancel(
         uint64 id
     ) external;

     function onSwapTip3ToEverSuccess(
         uint64 id,
         uint128 amount
     ) external;
}