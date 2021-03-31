pragma ton-solidity ^0.39.0;

pragma AbiHeader time;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

import "./libraries/PlatformTypes.sol";
import "./libraries/DexErrors.sol";
import "./libraries/GasConstants.sol";

import "./DexPlatform.sol";
import "./interfaces/IUpgradable.sol";
import "./interfaces/IUpgradableByRequest.sol";
import "./interfaces/IDexRoot.sol";

contract DexRoot is IDexRoot, IUpgradable {

    uint32 static _nonce;

    TvmCell platform_code;
    bool has_platform_code;
    TvmCell account_code;
    uint32 account_version;
    TvmCell pair_code;
    uint32 pair_version;

    address owner;
    address pending_owner;

    constructor(address initial_owner) public {
        tvm.accept();
        owner = initial_owner;
    }

    /* Install / upgrade code */

    function installPlatformOnce(TvmCell code) external onlyOwner {
        // can be installed only once
        require(!has_platform_code, DexErrors.PLATFORM_CODE_NON_EMPTY);
        tvm.rawReserve(GasConstants.ROOT_INITIAL_BALANCE, 2);
        platform_code = code;
        has_platform_code = true;
        owner.transfer({ value: 0, flag: 128 });
    }

    function installOrUpdateAccountCode(TvmCell code) external onlyOwner {
        tvm.rawReserve(GasConstants.ROOT_INITIAL_BALANCE, 2);
        account_code = code;
        account_version++;
        owner.transfer({ value: 0, flag: 128 });
    }

    function installOrUpdatePairCode(TvmCell code) external onlyOwner {
        tvm.rawReserve(GasConstants.ROOT_INITIAL_BALANCE, 2);
        pair_code = code;
        pair_version++;
        owner.transfer({ value: 0, flag: 128 });
    }

    function getAccountVersion() external view responsible returns (uint32) {
        return{ value: 0, bounce: false, flag: 64 } account_version;
    }

    function getPairVersion() external view responsible returns (uint32) {
        return{ value: 0, bounce: false, flag: 64 } pair_version;
    }

    // Upgrade the root contract itself (IUpgradable)

    function upgrade(TvmCell code) override external onlyOwner {
        TvmBuilder builder;

        builder.store(owner);

        builder.store(platform_code);
        builder.store(account_code);
        builder.store(pair_code);

        tvm.setcode(code);
        tvm.setCurrentCode(code);

        onCodeUpgrade(builder.toCell());
    }

    function onCodeUpgrade(TvmCell data) private {}

    function requestUpgradeAccount(uint32 current_version, address account_owner, address send_gas_to) override external onlyAccount(account_owner) {
        tvm.rawReserve(math.max(GasConstants.ROOT_INITIAL_BALANCE, address(this).balance - msg.value), 2);
        if (current_version == account_version) {
            send_gas_to.transfer({ value: 0, flag: 128 });
        } else {
            IUpgradableByRequest(msg.sender).upgrade{ value: 0, flag: 128 }(account_code, account_version, send_gas_to);
        }
    }

    /* Reset balance to ROOT_INITIAL_BALANCE */
    function resetGas(address receiver) external view onlyOwner {
        tvm.rawReserve(GasConstants.ROOT_INITIAL_BALANCE, 2);
        receiver.transfer({ value: 0, flag: 128 });
    }

    /* Owner */

    modifier onlyOwner() {
        require(msg.sender == owner, DexErrors.NOT_MY_OWNER);
        _;
    }

    function transferOwner(address new_owner) external onlyOwner {
        pending_owner = new_owner;
    }

    function acceptOwner() external {
        require(msg.sender == pending_owner, DexErrors.NOT_PENDING_OWNER);
        owner = pending_owner;
        pending_owner = address.makeAddrStd(0, 0);
    }

    /* Expected address functions */

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

    function getExpectedAccountAddress(address account_owner) external view responsible returns (address) {
        return { value: 0, bounce: false, flag: 64 } address(tvm.hash(_buildInitData(
            PlatformTypes.Account,
            _buildAccountParams(account_owner)
        )));
    }

    function getExpectedPairAddress(address left_root, address right_root) external view responsible returns (address) {
        return { value: 0, bounce: false, flag: 64 } address(tvm.hash(_buildInitData(
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
        if (left_root.value > right_root.value) {
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

    /* Create account */

    function deployAccount(address account_owner, address send_gas_to) external {
        require(account_version != 0, DexErrors.ACCOUNT_CODE_EMPTY);
        require(has_platform_code, DexErrors.PLATFORM_CODE_EMPTY);
        require(account_owner.value != 0, DexErrors.INVALID_ADDRESS);
        require(msg.value < GasConstants.DEPLOY_ACCOUNT_MIN_VALUE, DexErrors.VALUE_TOO_LOW);

        tvm.rawReserve(math.max(GasConstants.ROOT_INITIAL_BALANCE, address(this).balance - msg.value), 2);

        DexPlatform platform = new DexPlatform{
            stateInit: _buildInitData(PlatformTypes.Account, _buildAccountParams(account_owner)),
            value: 0.1 ton,
            flag: 1
        }();
        platform.setPlatformCode{value: 0.1 ton, flag: 1}(platform_code);
        platform.initialize{value: 0, flag: 128}(account_code, account_version, send_gas_to);
    }

    function deployPair(address left_root, address right_root, address send_gas_to) external {
        require(account_version > 0, DexErrors.PAIR_CODE_EMPTY);
        require(has_platform_code, DexErrors.PLATFORM_CODE_EMPTY);
        require(msg.value < GasConstants.DEPLOY_PAIR_MIN_VALUE, DexErrors.VALUE_TOO_LOW);

        tvm.rawReserve(math.max(GasConstants.ROOT_INITIAL_BALANCE, address(this).balance - msg.value), 2);

        DexPlatform platform = new DexPlatform{
            stateInit: _buildInitData(PlatformTypes.Pair, _buildPairParams(left_root, right_root)),
            value: 0.1 ton,
            flag: 1
        }();
        platform.setPlatformCode{value: 0.1 ton, flag: 1}(platform_code);
        platform.initialize{value: 0, flag: 128}(pair_code, pair_version, send_gas_to);
    }

}
