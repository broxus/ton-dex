pragma ton-solidity ^0.39.0;

import "../../node_modules/ton-eth-bridge-token-contracts/free-ton/contracts/interfaces/IRootTokenContract.sol";

interface ITokenFactory {

    struct StorageData {
        uint32 answer_id;
        address pending_token;
        uint256 root_public_key;
        address root_owner_address;
        bytes name;
        bytes symbol;
        uint8 decimals;
        address sender;
    }

    function Token(
        uint32 answer_id,
        uint256 root_public_key,
        address root_owner_address,
        bytes name,
        bytes symbol,
        uint8 decimals
    ) external;

    function transferOwner(address new_owner) external;
    function acceptOwner() external;

    function setRootCode(TvmCell root_code_) external;
    function setWalletCode(TvmCell wallet_code_) external;

    function onTokenGetDetails(IRootTokenContract.IRootTokenContractDetails details) external view;
    function onStorageReadWithDetails(StorageData data, TvmCell meta) external view;
    function onStoragePruneNotify(StorageData data) external view;
    function onStoragePruneReturn(StorageData data) external view;




}
