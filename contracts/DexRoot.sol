pragma ton-solidity >= 0.57.0;

pragma AbiHeader time;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

import "./abstract/DexContractBase.sol";
import "@broxus/contracts/contracts/libraries/MsgFlag.sol";

import "./libraries/DexPlatformTypes.sol";
import "./libraries/DexErrors.sol";
import "./libraries/DexGas.sol";

import "./DexPlatform.sol";
import "./interfaces/IUpgradable.sol";
import "./interfaces/IUpgradableByRequest.sol";
import "./interfaces/IDexRoot.sol";
import "./interfaces/IResetGas.sol";

contract DexRoot is DexContractBase, IDexRoot, IResetGas, IUpgradable {

    uint32 static _nonce;

    TvmCell public account_code;
    uint32 account_version;
    TvmCell public pair_code;
    uint32 pair_version;

    bool active;

    address owner;
    address vault;
    address pending_owner;

    constructor(address initial_owner, address initial_vault) public {
        tvm.rawReserve(DexGas.ROOT_INITIAL_BALANCE, 2);
        tvm.accept();
        owner = initial_owner;
        vault = initial_vault;
        owner.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED });
    }

    function _dexRoot() override internal view returns(address) {
        return address(this);
    }

    // Install

    function installPlatformOnce(TvmCell code) external onlyOwner {
        // can be installed only once
        require(platform_code.toSlice().empty(), DexErrors.PLATFORM_CODE_NON_EMPTY);
        tvm.rawReserve(DexGas.ROOT_INITIAL_BALANCE, 2);
        platform_code = code;
        owner.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED });
    }

    function installOrUpdateAccountCode(TvmCell code) external onlyOwner {
        tvm.rawReserve(DexGas.ROOT_INITIAL_BALANCE, 2);
        account_code = code;
        account_version++;
        emit AccountCodeUpgraded(account_version);
        owner.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED });
    }

    function installOrUpdatePairCode(TvmCell code) external onlyOwner {
        tvm.rawReserve(DexGas.ROOT_INITIAL_BALANCE, 2);
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
        tvm.rawReserve(DexGas.ROOT_INITIAL_BALANCE, 2);
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
        tvm.rawReserve(DexGas.ROOT_INITIAL_BALANCE, 2);
        if (new_active && !platform_code.toSlice().empty() && vault.value != 0 && account_version > 0 && pair_version > 0) {
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

        require(msg.value > DexGas.UPGRADE_ACCOUNT_MIN_VALUE, DexErrors.VALUE_TOO_LOW);

        tvm.rawReserve(DexGas.ROOT_INITIAL_BALANCE, 2);

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
        tvm.rawReserve(math.max(DexGas.ROOT_INITIAL_BALANCE, address(this).balance - msg.value), 2);
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
        require(msg.value >= DexGas.UPGRADE_ACCOUNT_MIN_VALUE, DexErrors.VALUE_TOO_LOW);
        tvm.rawReserve(math.max(DexGas.ROOT_INITIAL_BALANCE, address(this).balance - msg.value), 2);
        emit RequestedForceAccountUpgrade(account_owner);
        IUpgradableByRequest(_expectedAccountAddress(account_owner)).upgrade{
            value: 0,
            flag: MsgFlag.ALL_NOT_RESERVED
        }(account_code, account_version, send_gas_to);
    }

    function upgradePair(
        address left_root,
        address right_root,
        address send_gas_to
    ) external view onlyOwner {
        require(msg.value >= DexGas.UPGRADE_PAIR_MIN_VALUE, DexErrors.VALUE_TOO_LOW);
        tvm.rawReserve(math.max(DexGas.ROOT_INITIAL_BALANCE, address(this).balance - msg.value), 2);
        emit RequestedPairUpgrade(left_root, right_root);
        IUpgradableByRequest(_expectedPairAddress(left_root, right_root)).upgrade{
            value: 0,
            flag: MsgFlag.ALL_NOT_RESERVED
        }(pair_code, pair_version, send_gas_to);
    }

    // Reset balance to ROOT_INITIAL_BALANCE
    function resetGas(address receiver) override external view onlyOwner {
        tvm.rawReserve(DexGas.ROOT_INITIAL_BALANCE, 2);
        receiver.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED });
    }

    function resetTargetGas(address target, address receiver) external view onlyOwner {
        tvm.rawReserve(math.max(DexGas.ROOT_INITIAL_BALANCE, address(this).balance - msg.value), 2);
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
        require(msg.sender == pending_owner && msg.sender.value != 0, DexErrors.NOT_PENDING_OWNER);
        emit OwnerTransferAccepted(owner, pending_owner);
        owner = pending_owner;
        pending_owner = address.makeAddrStd(0, 0);
    }

    // Expected address functions

    function getExpectedAccountAddress(address account_owner) override external view responsible returns (address) {
        return { value: 0, bounce: false, flag: MsgFlag.REMAINING_GAS } _expectedAccountAddress(account_owner);
    }

    function getExpectedPairAddress(address left_root, address right_root) override external view responsible returns (address) {
        return { value: 0, bounce: false, flag: MsgFlag.REMAINING_GAS } _expectedPairAddress(left_root, right_root);
    }

    // Deploy child contracts

    function deployAccount(address account_owner, address send_gas_to) override external onlyActive {
        require(msg.value >= DexGas.DEPLOY_ACCOUNT_MIN_VALUE, DexErrors.VALUE_TOO_LOW);
        require(account_owner.value != 0, DexErrors.INVALID_ADDRESS);

        tvm.rawReserve(math.max(DexGas.ROOT_INITIAL_BALANCE, address(this).balance - msg.value), 2);

        new DexPlatform{
            stateInit: _buildInitData(DexPlatformTypes.Account, _buildAccountParams(account_owner)),
            value: 0,
            flag: MsgFlag.ALL_NOT_RESERVED
        }(
            account_code,
            account_version,
            vault,
            send_gas_to
        );
    }

    function deployPair(address left_root, address right_root, address send_gas_to) override external onlyActive {
        require(msg.value >= DexGas.DEPLOY_PAIR_MIN_VALUE, DexErrors.VALUE_TOO_LOW);
        require(left_root.value != right_root.value, DexErrors.WRONG_PAIR);
        require(left_root.value != 0, DexErrors.WRONG_PAIR);
        require(right_root.value != 0, DexErrors.WRONG_PAIR);

        tvm.rawReserve(math.max(DexGas.ROOT_INITIAL_BALANCE, address(this).balance - msg.value), 2);

        new DexPlatform{
            stateInit: _buildInitData(DexPlatformTypes.Pair, _buildPairParams(left_root, right_root)),
            value: 0,
            flag: MsgFlag.ALL_NOT_RESERVED
        }(
            pair_code,
            pair_version,
            vault,
            send_gas_to
        );
    }

    function onPairCreated(
        address left_root,
        address right_root,
        address send_gas_to
    ) override external onlyPair(left_root, right_root) {
        tvm.rawReserve(math.max(DexGas.ROOT_INITIAL_BALANCE, address(this).balance - msg.value), 2);
        emit NewPairCreated(left_root, right_root);
        send_gas_to.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED + MsgFlag.IGNORE_ERRORS });
    }
}
