pragma ton-solidity >= 0.39.0;

interface ISuccessCallback {
    function successCallback(
        uint64 call_id
    ) external;
}
