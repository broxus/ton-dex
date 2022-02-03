pragma ton-solidity >= 0.56.0;

interface ISuccessCallback {
    function successCallback(
        uint64 call_id
    ) external;
}
