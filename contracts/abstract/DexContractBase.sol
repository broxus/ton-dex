pragma ton-solidity >= 0.57.0;

pragma AbiHeader time;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

import "../libraries/DexPlatformTypes.sol";
import "../DexPlatform.sol";


abstract contract DexContractBase  {

    TvmCell public platform_code;

    modifier onlyPlatform(uint8 type_id, TvmCell params) {
        address expected = address(tvm.hash(_buildInitData(type_id, params)));
        require(msg.sender == expected, DexErrors.NOT_PLATFORM);
        _;
    }

    modifier onlyAccount(address account_owner) {
        require(msg.sender == _expectedAccountAddress(account_owner), DexErrors.NOT_ACCOUNT);
        _;
    }

    modifier onlyPair(address left_root, address right_root) {
        require(msg.sender == _expectedPairAddress(left_root, right_root), DexErrors.NOT_PAIR);
        _;
    }

    function _expectedAccountAddress(address account_owner) internal view returns (address) {
        return address(tvm.hash(_buildInitData(
            DexPlatformTypes.Account,
            _buildAccountParams(account_owner)
        )));
    }

    function _expectedPairAddress(address left_root, address right_root) internal view returns (address) {
        return address(tvm.hash(_buildInitData(
            DexPlatformTypes.Pair,
            _buildPairParams(left_root, right_root)
        )));
    }

    function _buildAccountParams(address account_owner) internal pure returns (TvmCell) {
        TvmBuilder builder;
        builder.store(account_owner);
        return builder.toCell();
    }

    function _buildPairParams(address left_root, address right_root) internal pure returns (TvmCell) {
        TvmBuilder builder;
        if (left_root.value < right_root.value) {
            builder.store(left_root);
            builder.store(right_root);
        } else {
            builder.store(right_root);
            builder.store(left_root);
        }
        return builder.toCell();
    }

    function _buildInitData(uint8 type_id, TvmCell params) internal view returns (TvmCell) {
        return tvm.buildStateInit({
            contr: DexPlatform,
            varInit: {
                root: _dexRoot(),
                type_id: type_id,
                params: params
            },
            pubkey: 0,
            code: platform_code
        });
    }

    function _dexRoot() virtual internal view returns (address);

}
