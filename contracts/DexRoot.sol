pragma ton-solidity >= 0.39.0;

pragma AbiHeader time;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

import "./libraries/PlatformTypes.sol";
import "./libraries/DexErrors.sol";
import "./libraries/Gas.sol";
import "./libraries/MsgFlag.sol";

import "./DexPlatform.sol";
import "./interfaces/IUpgradable.sol";
import "./interfaces/IUpgradableByRequest.sol";
import "./interfaces/IAfterInitialize.sol";
import "./interfaces/IDexRoot.sol";
import "./interfaces/IResetGas.sol";

contract DexRoot is IDexRoot, IResetGas, IUpgradable {

    uint32 static _nonce;

    TvmCell public platform_code;
    bool has_platform_code;
    TvmCell public account_code;
    uint32 account_version;
    TvmCell public pair_code;
    uint32 pair_version;

    bool active;

    address owner;
    address vault;
    address pending_owner;

    constructor(address initial_owner, address initial_vault) public {
        tvm.rawReserve(Gas.ROOT_INITIAL_BALANCE, 2);
        tvm.accept();
        owner = initial_owner;
        vault = initial_vault;
        owner.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED });
    }

    // Install

    function installPlatformOnce(TvmCell code) external onlyOwner {
        // can be installed only once
        require(!has_platform_code, DexErrors.PLATFORM_CODE_NON_EMPTY);
        tvm.rawReserve(Gas.ROOT_INITIAL_BALANCE, 2);
        platform_code = code;
        has_platform_code = true;
        owner.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED });
    }

    function installOrUpdateAccountCode(TvmCell code) external onlyOwner {
        tvm.rawReserve(Gas.ROOT_INITIAL_BALANCE, 2);
        account_code = code;
        account_version++;
        emit AccountCodeUpgraded(account_version);
        owner.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED });
    }

    function installOrUpdatePairCode(TvmCell code) external onlyOwner {
        tvm.rawReserve(Gas.ROOT_INITIAL_BALANCE, 2);
        pair_code = code;
        pair_version++;
        emit PairCodeUpgraded(pair_version);
        owner.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED });
    }

    function getAccountVersion() override external view responsible returns (uint32) {
        return{ value: 0, bounce: false, flag: MsgFlag.REMAINING_GAS } account_version;
    }

    function getPairVersion() override external view responsible returns (uint32) {
        return{ value: 0, bounce: false, flag: MsgFlag.REMAINING_GAS } pair_version;
    }

    // Vault

    function setVaultOnce(address new_vault) external onlyOwner {
        require(vault.value == 0, DexErrors.PLATFORM_CODE_NON_EMPTY);
        tvm.rawReserve(Gas.ROOT_INITIAL_BALANCE, 2);
        vault = new_vault;
        owner.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED });
    }

    function getVault() override external view responsible returns (address) {
        return{ value: 0, bounce: false, flag: MsgFlag.REMAINING_GAS } vault;
    }

    modifier onlyVault() {
        require(msg.sender == vault, DexErrors.NOT_VAULT);
        _;
    }

    // Active

    function setActive(bool new_active) external onlyOwner {
        tvm.rawReserve(Gas.ROOT_INITIAL_BALANCE, 2);
        if (new_active && has_platform_code && vault.value != 0 && account_version > 0 && pair_version > 0) {
            active = true;
        } else {
            active = false;
        }
        emit ActiveUpdated(active);
        owner.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED });
    }

    function isActive() override external view responsible returns (bool) {
        return{ value: 0, bounce: false, flag: MsgFlag.REMAINING_GAS } active;
    }

    modifier onlyActive() {
        require(active, DexErrors.NOT_ACTIVE);
        _;
    }

    // Upgrade the root contract itself (IUpgradable)

    function upgrade(TvmCell code) override external onlyOwner {

        require(msg.value > Gas.UPGRADE_ACCOUNT_MIN_VALUE, DexErrors.VALUE_TOO_LOW);

        tvm.rawReserve(Gas.ROOT_INITIAL_BALANCE, 2);

        emit RootCodeUpgraded();

        active = false;

        TvmBuilder builder;

        builder.store(account_version);
        builder.store(pair_version);

        builder.store(owner);
        builder.store(vault);
        builder.store(pending_owner);

        builder.store(platform_code);
        builder.store(account_code);
        builder.store(pair_code);

        tvm.setcode(code);
        tvm.setCurrentCode(code);

        onCodeUpgrade(builder.toCell());
    }

    function onCodeUpgrade(TvmCell data) private {}

    function requestUpgradeAccount(
        uint32 current_version,
        address send_gas_to,
        address account_owner
    ) override external onlyAccount(account_owner) {
        tvm.rawReserve(math.max(Gas.ROOT_INITIAL_BALANCE, address(this).balance - msg.value), 2);
        if (current_version == account_version || !active) {
            send_gas_to.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED });
        } else {
            IUpgradableByRequest(msg.sender).upgrade{ value: 0, flag: MsgFlag.ALL_NOT_RESERVED }(
                account_code,
                account_version,
                send_gas_to
            );
        }
    }

    function forceUpgradeAccount(
        address account_owner,
        address send_gas_to
    ) external view onlyOwner {
        require(msg.value >= Gas.UPGRADE_ACCOUNT_MIN_VALUE, DexErrors.VALUE_TOO_LOW);
        tvm.rawReserve(math.max(Gas.ROOT_INITIAL_BALANCE, address(this).balance - msg.value), 2);
        emit RequestedForceAccountUpgrade(account_owner);
        IUpgradableByRequest(address(tvm.hash(_buildInitData(
            PlatformTypes.Account,
            _buildAccountParams(account_owner)
        )))).upgrade{ value: 0, flag: MsgFlag.ALL_NOT_RESERVED }(account_code, account_version, send_gas_to);
    }

    function upgradePair(
        address left_root,
        address right_root,
        address send_gas_to
    ) external view onlyOwner {
        require(msg.value >= Gas.UPGRADE_PAIR_MIN_VALUE, DexErrors.VALUE_TOO_LOW);
        tvm.rawReserve(math.max(Gas.ROOT_INITIAL_BALANCE, address(this).balance - msg.value), 2);
        emit RequestedPairUpgrade(left_root, right_root);
        IUpgradableByRequest(address(tvm.hash(_buildInitData(
            PlatformTypes.Pair,
            _buildPairParams(left_root, right_root)
        ))))
        .upgrade{ value: 0, flag: MsgFlag.ALL_NOT_RESERVED }(pair_code, pair_version, send_gas_to);
    }

    // Reset balance to ROOT_INITIAL_BALANCE
    function resetGas(address receiver) override external view onlyOwner {
        tvm.rawReserve(Gas.ROOT_INITIAL_BALANCE, 2);
        receiver.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED });
    }

    function resetTargetGas(address target, address receiver) external view onlyOwner {
        tvm.rawReserve(math.max(Gas.ROOT_INITIAL_BALANCE, address(this).balance - msg.value), 2);
        IResetGas(target).resetGas{ value: 0, flag: MsgFlag.ALL_NOT_RESERVED }(receiver);
    }

    // Owner

    modifier onlyOwner() {
        require(msg.sender == owner, DexErrors.NOT_MY_OWNER);
        _;
    }

    function getOwner() external view responsible returns (address dex_owner) {
        return { value: 0, bounce: false, flag: MsgFlag.REMAINING_GAS } owner;
    }

    function getPendingOwner() external view responsible returns (address dex_pending_owner) {
        return { value: 0, bounce: false, flag: MsgFlag.REMAINING_GAS } pending_owner;
    }

    function transferOwner(address new_owner) external onlyOwner {
        emit RequestedOwnerTransfer(owner, new_owner);
        pending_owner = new_owner;
    }

    function acceptOwner() external {
        require(msg.sender == pending_owner, DexErrors.NOT_PENDING_OWNER);
        emit OwnerTransferAccepted(owner, pending_owner);
        owner = pending_owner;
        pending_owner = address.makeAddrStd(0, 0);
    }

    // Expected address functions

    modifier onlyPlatform(uint8 type_id, TvmCell params) {
        address expected = address(tvm.hash(_buildInitData(type_id, params)));
        require(msg.sender == expected, DexErrors.NOT_PLATFORM);
        _;
    }

    modifier onlyAccount(address account_owner) {
        address expected = address(tvm.hash(_buildInitData(
            PlatformTypes.Account,
            _buildAccountParams(account_owner)
        )));
        require(msg.sender == expected, DexErrors.NOT_ACCOUNT);
        _;
    }

    modifier onlyPair(address left_root, address right_root) {
        address expected = address(tvm.hash(_buildInitData(
            PlatformTypes.Pair,
            _buildPairParams(left_root, right_root)
        )));
        require(msg.sender == expected, DexErrors.NOT_PAIR);
        _;
    }

    function getExpectedAccountAddress(address account_owner) override external view responsible returns (address) {
        return { value: 0, bounce: false, flag: MsgFlag.REMAINING_GAS } address(tvm.hash(_buildInitData(
            PlatformTypes.Account,
            _buildAccountParams(account_owner)
        )));
    }

    function getExpectedPairAddress(address left_root, address right_root) override external view responsible returns (address) {
        return { value: 0, bounce: false, flag: MsgFlag.REMAINING_GAS } address(tvm.hash(_buildInitData(
            PlatformTypes.Pair,
            _buildPairParams(left_root, right_root)
        )));
    }

    function _buildAccountParams(address account_owner) private inline pure returns (TvmCell) {
        TvmBuilder builder;
        builder.store(account_owner);
        return builder.toCell();
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

    function _buildInitData(uint8 type_id, TvmCell params) private inline view returns (TvmCell) {
        return tvm.buildStateInit({
            contr: DexPlatform,
            varInit: {
                root: address(this),
                type_id: type_id,
                params: params
            },
            pubkey: 0,
            code: platform_code
        });
    }

    // Deploy child contracts

    function deployAccount(address account_owner, address send_gas_to) override external onlyActive {
        require(msg.value >= Gas.DEPLOY_ACCOUNT_MIN_VALUE, DexErrors.VALUE_TOO_LOW);
        require(account_owner.value != 0, DexErrors.INVALID_ADDRESS);

        tvm.rawReserve(math.max(Gas.ROOT_INITIAL_BALANCE, address(this).balance - msg.value), 2);

        DexPlatform platform = new DexPlatform{
            stateInit: _buildInitData(PlatformTypes.Account, _buildAccountParams(account_owner)),
            value: Gas.PLATFORM_DEPLOY_VALUE,
            flag: MsgFlag.SENDER_PAYS_FEES
        }();
        platform.setPlatformCode{
            value: Gas.SET_PLATFORM_CODE_VALUE,
            flag: MsgFlag.SENDER_PAYS_FEES
        }(platform_code);
        platform.initialize{
            value: Gas.ACCOUNT_INITIALIZE_VALUE,
            flag: MsgFlag.SENDER_PAYS_FEES
        }(
            account_code,
            account_version,
            vault,
            send_gas_to
        );
        send_gas_to.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED });
    }

    function deployPair(address left_root, address right_root, address send_gas_to) override external onlyActive {
        require(msg.value >= Gas.DEPLOY_PAIR_MIN_VALUE, DexErrors.VALUE_TOO_LOW);
        require(left_root.value != right_root.value, DexErrors.WRONG_PAIR);
        require(left_root.value != 0, DexErrors.WRONG_PAIR);
        require(right_root.value != 0, DexErrors.WRONG_PAIR);

        tvm.rawReserve(math.max(Gas.ROOT_INITIAL_BALANCE, address(this).balance - msg.value), 2);

        address platform = new DexPlatform{
            stateInit: _buildInitData(PlatformTypes.Pair, _buildPairParams(left_root, right_root)),
            value: Gas.PLATFORM_DEPLOY_VALUE,
            flag: MsgFlag.SENDER_PAYS_FEES
        }();
        DexPlatform(platform).setPlatformCode{
            value: Gas.SET_PLATFORM_CODE_VALUE,
            flag: MsgFlag.SENDER_PAYS_FEES
        }(platform_code);
        DexPlatform(platform).initialize{
            value: Gas.PAIR_INITIALIZE_VALUE,
            flag: MsgFlag.SENDER_PAYS_FEES
        }(
            pair_code,
            pair_version,
            vault,
            send_gas_to
        );
        IAfterInitialize(platform).afterInitialize{ value: 0, flag: MsgFlag.ALL_NOT_RESERVED }(send_gas_to);
    }

    function onPairCreated(
        address left_root,
        address right_root,
        address send_gas_to
    ) override external onlyPair(left_root, right_root) {
        tvm.rawReserve(math.max(Gas.ROOT_INITIAL_BALANCE, address(this).balance - msg.value), 2);
        emit NewPairCreated(left_root, right_root);
        send_gas_to.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED + MsgFlag.IGNORE_ERRORS });
    }
}
