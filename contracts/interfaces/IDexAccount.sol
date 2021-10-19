pragma ton-solidity >= 0.39.0;

import "./ISuccessCallback.sol";

interface IDexAccount is ISuccessCallback {

    event AddPair(address left_root, address right_root, address pair);

    event WithdrawTokens(address root, uint128 amount, uint128 balance);
    event TransferTokens(address root, uint128 amount, uint128 balance);
    event ExchangeTokens(address from, address to, uint128 spent_amount, uint128 expected_amount, uint128 balance);
    event DepositLiquidity(
        address left_root,
        uint128 left_amount,
        address right_root,
        uint128 right_amount,
        bool auto_change
    );

    event WithdrawLiquidity(
        uint128 lp_amount,
        uint128 lp_balance,
        address lp_root,
        address left_root,
        address right_root
    );

    event TokensReceived(address token_root, uint128 tokens_amount, uint128 balance, address sender_wallet);
    event TokensReceivedFromAccount(address token_root, uint128 tokens_amount, uint128 balance, address sender);
    event TokensReceivedFromPair(
        address token_root,
        uint128 tokens_amount,
        uint128 balance,
        address left_root,
        address right_root
    );


    event OperationRollback(address token_root, uint128 amount, uint128 balance, address from);
    event ExpectedPairNotExist(address pair);

    event AccountCodeUpgraded(uint32 version);
    event CodeUpgradeRequested();
    event GarbageCollected();

    function getNonce() external view responsible returns (uint64);

    function getRoot() external view responsible returns (address);

    function getOwner() external view responsible returns (address);

    function getVersion() external view responsible returns (uint32);

    function getVault() external view responsible returns (address);

    function getWalletData(address token_root) external view responsible returns (address wallet, uint128 balance);

    function withdraw(
        uint128 amount,
        address token_root,
        uint256 recipient_public_key,
        address recipient_address,
        uint128 deploy_wallet_grams,
        address send_gas_to
    ) external;

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

    function withdrawLiquidity(
        uint128 lp_amount,
        address lp_root,
        address left_root,
        address right_root,
        address send_gas_to
    ) external;

    function depositLiquidity(
        address left_root,
        uint128 left_amount,
        address right_root,
        uint128 right_amount,
        address expected_lp_root,
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

    function internalAccountTransfer(
        uint64 call_id,
        uint128 amount,
        address token_root,
        address sender_owner,
        bool    willing_to_deploy,
        address send_gas_to
    ) external;

    function internalPairTransfer(
        uint128 amount,
        address token_root,
        address sender_left_root,
        address sender_right_root,
        address send_gas_to
    ) external;
}
