pragma ton-solidity ^0.39.0;

import "./libraries/PlatformTypes.sol";
import "./libraries/DexErrors.sol";
import "./libraries/Gas.sol";
import "./libraries/MsgFlag.sol";

import "./DexPlatform.sol";
import "./DexVaultLpTokenPending.sol";
import "./interfaces/IDexVault.sol";
import "./interfaces/IDexPair.sol";
import "./interfaces/IUpgradable.sol";
import "./interfaces/IResetGas.sol";
import "../node_modules/ton-eth-bridge-token-contracts/free-ton/contracts/interfaces/ITokenWalletDeployedCallback.sol";



contract DexVault is IDexVault, IResetGas, IUpgradable, ITokenWalletDeployedCallback {

    uint32 static _nonce;

    TvmCell public platform_code;
    bool has_platform_code;

    TvmCell public lp_token_pending_code;

    address public root;
    address public owner;
    address public pending_owner;

    address public token_factory;

    modifier onlyOwner() {
        require(msg.sender == owner, DexErrors.NOT_MY_OWNER);
        _;
    }

    modifier onlyPair(address left_root_, address right_root_) {
        address expected = address(tvm.hash(_buildInitData(
                PlatformTypes.Pair,
                _buildPairParams(left_root_, right_root_)
            )));
        require(msg.sender == expected, DexErrors.NOT_PAIR);
        _;
    }

    modifier onlyLpTokenPending(uint32 nonce, address pair, address left_root, address right_root) {
        address expected = address(tvm.hash(_buildLpTokenPendingInitData(nonce, pair, left_root, right_root)));
        require(msg.sender == expected, DexErrors.NOT_LP_PENDING_CONTRACT);
        _;
    }

    constructor (address owner_, address root_, address token_factory_) public {
        tvm.accept();
        root = root_;
        owner = owner_;
        token_factory = token_factory_;

    }

    function transferOwner(address new_owner) public override onlyOwner {
        tvm.rawReserve(Gas.VAULT_INITIAL_BALANCE, 2);
        pending_owner = new_owner;
        owner.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED });
    }

    function acceptOwner() public override {
        require(msg.sender == pending_owner, DexErrors.NOT_PENDING_OWNER);
        tvm.rawReserve(Gas.VAULT_INITIAL_BALANCE, 2);
        owner = pending_owner;
        pending_owner = address(0);
        owner.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED });
    }

    function setTokenFactory(address new_token_factory) public override onlyOwner {
        tvm.rawReserve(Gas.VAULT_INITIAL_BALANCE, 2);
        token_factory = new_token_factory;
        owner.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED });
    }

    function installPlatformOnce(TvmCell code) external onlyOwner {
        require(!has_platform_code, DexErrors.PLATFORM_CODE_NON_EMPTY);
        tvm.rawReserve(Gas.VAULT_INITIAL_BALANCE, 2);
        platform_code = code;
        owner.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED });
    }

    function installOrUpdateLpTokenPendingCode(TvmCell code) public onlyOwner {
        tvm.rawReserve(Gas.VAULT_INITIAL_BALANCE, 2);
        lp_token_pending_code = code;
        owner.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED });
    }


    function addLiquidityToken(
        address pair,
        address left_root,
        address right_root,
        address send_gas_to
    ) public override onlyPair(left_root, right_root) {
        tvm.rawReserve(address(this).balance - msg.value, 2);
        new DexVaultLpTokenPending{
            stateInit: _buildLpTokenPendingInitData(now, pair, left_root, right_root),
            value: 0,
            flag: MsgFlag.ALL_NOT_RESERVED
        }(token_factory, msg.value, send_gas_to);
    }

    function onLiquidityTokenDeployed(
        uint32 nonce,
        address pair,
        address left_root,
        address right_root,
        address lp_root,
        address send_gas_to
    ) public override onlyLpTokenPending(nonce, pair, left_root, right_root) {
        tvm.rawReserve(address(this).balance - msg.value, 2);
        IDexPair(pair).liquidityTokenRootDeployed{value: 0, flag: MsgFlag.ALL_NOT_RESERVED}(lp_root, send_gas_to);
    }

    function onLiquidityTokenNotDeployed(
        uint32 nonce,
        address pair,
        address left_root,
        address right_root,
        address lp_root,
        address send_gas_to
    ) public override onlyLpTokenPending(nonce, pair, left_root, right_root) {
        tvm.rawReserve(address(this).balance - msg.value, 2);
        IDexPair(pair).liquidityTokenRootNotDeployed{value: 0, flag: MsgFlag.ALL_NOT_RESERVED}(lp_root, send_gas_to);
    }

    function notifyWalletDeployed(address token_root) public override {}


    function withdraw(
        uint64 call_id,
        uint128 amount,
        address token_root,
        address vault_wallet,
        address account_owner,
        uint32 account_version,
        address send_gas_to
    ) external override {
        //todo transfer to recipient
    }

    function _buildLpTokenPendingInitData(
        uint32 nonce,
        address pair,
        address left_root,
        address right_root
    ) private inline view returns (TvmCell) {
        return tvm.buildStateInit({
            contr: DexVaultLpTokenPending,
            varInit: {
                _nonce: nonce,
                vault: address(this),
                pair: pair,
                left_root: left_root,
                right_root: right_root
            },
            pubkey: 0,
            code: lp_token_pending_code
        });
    }

    function _buildInitData(uint8 type_id, TvmCell params) private inline view returns (TvmCell) {
        return tvm.buildStateInit({
            contr: DexPlatform,
            varInit: {
                root: root,
                type_id: type_id,
                params: params
            },
            pubkey: 0,
            code: platform_code
        });
    }

    function _buildPairParams(address left_root, address right_root) private inline pure returns (TvmCell) {
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

    function upgrade(TvmCell code) public override onlyOwner {
        tvm.rawReserve(address(this).balance - msg.value, 2);

        TvmBuilder builder;

        builder.store(platform_code);
        builder.store(has_platform_code);
        builder.store(lp_token_pending_code);
        builder.store(root);
        builder.store(owner);
        builder.store(pending_owner);
        builder.store(token_factory);

        tvm.setcode(code);
        tvm.setCurrentCode(code);

        onCodeUpgrade(builder.toCell());
    }

    function onCodeUpgrade(TvmCell upgrade_data) private {}

    function resetGas(address receiver) override external view onlyOwner {
        tvm.rawReserve(Gas.VAULT_INITIAL_BALANCE, 2);
        receiver.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED });
    }

    function resetTargetGas(address target, address receiver) external view onlyOwner {
        tvm.rawReserve(math.max(Gas.VAULT_INITIAL_BALANCE, address(this).balance - msg.value), 2);
        IResetGas(target).resetGas{ value: 0, flag: MsgFlag.ALL_NOT_RESERVED }(receiver);
    }


}
