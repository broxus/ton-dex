pragma ton-solidity ^0.39.0;

interface IDexVault {

    event VaultCodeUpgraded();

    event RequestedOwnerTransfer(address old_owner, address new_owner);
    event OwnerTransferAccepted(address old_owner, address new_owner);

    event TokenFactoryAddressUpdated(address old_token_factory, address new_token_factory);

    event WithdrawTokens(
        address vault_token_wallet,
        uint128 amount,
        address account_owner,
        uint256 recipient_public_key,
        address recipient_address
    );

    event PairTransferTokens(
        address vault_token_wallet,
        uint128 amount,
        address pair_left_root,
        address pair_right_root,
        uint256 recipient_public_key,
        address recipient_address
    );


    function addLiquidityToken(address pair, address left_root, address right_root, address send_gas_to) external;

    function onLiquidityTokenDeployed(
        uint32 nonce,
        address pair,
        address left_root,
        address right_root,
        address lp_root,
        address send_gas_to
    ) external;

    function onLiquidityTokenNotDeployed(
        uint32 nonce,
        address pair,
        address left_root,
        address right_root,
        address lp_root,
        address send_gas_to
    ) external;

    function withdraw(
        uint64 call_id,
        uint128 amount,
        address token_root,
        address vault_wallet,
        uint256 recipient_public_key,
        address recipient_address,
        uint128 deploy_wallet_grams,
        address account_owner,
        uint32  account_version,
        address send_gas_to
    ) external;

    function transfer(
        uint128 amount,
        address token_root,
        address vault_wallet,
        uint256 recipient_public_key,
        address recipient_address,
        uint128 deploy_wallet_grams,
        bool    notify_receiver,
        TvmCell payload,
        address left_root,
        address right_root,
        uint32  pair_version,
        address send_gas_to
    ) external;

    function transferOwner(address new_owner) external;
    function acceptOwner() external;

    function setTokenFactory(address new_token_factory) external;

}
