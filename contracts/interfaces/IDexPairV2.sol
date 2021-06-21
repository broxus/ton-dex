pragma ton-solidity ^0.39.0;

import "./ISuccessCallback.sol";
import "./IDexPair.sol";
import "../structures/ITokenOperationStructure.sol";

interface IDexPairV2 is IDexPair {
    function crossPairExchange(
        uint64 id,

        uint32 prev_pair_version,
        address prev_pair_left_root,
        address prev_pair_right_root,

        address spent_token_root,
        uint128 spent_amount,

        uint256 sender_public_key,
        address sender_address,

        address original_gas_to,
        uint128 deploy_wallet_grams,

        TvmCell payload
    ) external;
}
