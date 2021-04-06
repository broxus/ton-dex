pragma ton-solidity ^0.39.0;

interface IDexAccount {

    function getRoot() external view responsible returns (address);

    function getOwner() external view responsible returns (address);

    function getVersion() external view responsible returns (uint32);

    function getVault() external view responsible returns (address);

    function getWalletData(address token_root) external view responsible returns (address wallet, uint128 balance);

    function transfer(
        uint128 amount,
        address token_root,
        address to_dex_account,
        bool    willing_to_deploy,
        address send_gas_to
    ) external;

    function exchange(
        uint128 spent_amount,
        address spent_token_root,
        address receive_token_root,
        uint128 expected_amount,
        address send_gas_to
    ) external;

    function depositLiquidity(
        address left_root,
        uint128 left_amount,
        address right_root,
        uint128 right_amount,
        bool    auto_change,
        address send_gas_to
    ) external;

    function addPair(
        address left_root,
        address right_root,
        address send_gas_to
    ) external;

    //////////////////////////////////////////////////////////////////////////////////////////////////////
    // INTERNAL

    function checkPairCallback(
        uint64 original_call_id,
        address left_root,
        address right_root,
        address lp_root,
        address send_gas_to
    ) external;

    function internalTransfer(
        uint64 call_id,
        uint128 amount,
        address token_root,
        address sender_owner,
        bool    willing_to_deploy,
        address send_gas_to
    ) external;

    function successCallback(
        uint64 call_id
    ) external;
}
