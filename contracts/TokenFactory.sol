pragma ton-solidity >= 0.39.0;

import "./TokenFactoryStorage.sol";

import "./libraries/Gas.sol";
import "./libraries/TokenFactoryErrors.sol";
import "./libraries/MsgFlag.sol";

import "./interfaces/IUpgradable.sol";
import "./interfaces/ITokenFactory.sol";
import "./interfaces/ITokenRootDeployedCallback.sol";
import "./interfaces/IResetGas.sol";

import "../node_modules/ton-eth-bridge-token-contracts/free-ton/contracts/RootTokenContract.sol";
import "../node_modules/ton-eth-bridge-token-contracts/free-ton/contracts/interfaces/IRootTokenContract.sol";

contract TokenFactory is IResetGas, ITokenFactory, IUpgradable {

    uint32 static _nonce;

    TvmCell public root_code;
    TvmCell public wallet_code;

    TvmCell public storage_code;

    address public owner;
    address public pending_owner;

    constructor(TvmCell storage_code_, address initial_owner) public {
        tvm.accept();
        storage_code = storage_code_;
        owner = initial_owner;
    }

    modifier onlyOwner {
        require(msg.sender == owner, TokenFactoryErrors.NOT_MY_OWNER);
        _;
    }

    modifier isEmpty(TvmCell code) {
        require(code.depth() == 0, TokenFactoryErrors.IMAGE_ALREADY_SET);
        tvm.accept();
        _;
    }

    function transferOwner(address new_owner) public override onlyOwner {
        pending_owner = new_owner;
        returnChange();
    }

    function acceptOwner() public override {
        require(msg.sender == pending_owner, TokenFactoryErrors.NOT_PENDING_OWNER);
        owner = pending_owner;
        pending_owner = address(0);
        returnChange();
    }

    function getOwner() external view responsible returns (address) {
        return { value: 0, bounce: false, flag: MsgFlag.REMAINING_GAS } owner;
    }

    function getPendingOwner() external view responsible returns (address) {
        return { value: 0, bounce: false, flag: MsgFlag.REMAINING_GAS } pending_owner;
    }

    function setRootCode(TvmCell root_code_) public override onlyOwner {
        root_code = root_code_;
        returnChange();
    }

    function setWalletCode(TvmCell wallet_code_) public override onlyOwner {
        wallet_code = wallet_code_;
        returnChange();
    }

    function Token(
        uint32 answer_id,
        uint256 root_public_key,
        address root_owner_address,
        bytes name,
        bytes symbol,
        uint8 decimals
    ) public override {
        uint128 expectedValue = Gas.TOKEN_FACTORY_FEE + Gas.DEPLOY_TOKEN_ROOT_MIN_VALUE;
        require(msg.value >= expectedValue, TokenFactoryErrors.VALUE_TOO_LOW);
        tvm.rawReserve(Gas.TOKEN_FACTORY_INITIAL_BALANCE, 2);

        address tokenRoot = new RootTokenContract{
            stateInit: _buildInitData(name, symbol, decimals),
            value: msg.value - Gas.TOKEN_FACTORY_FEE,
            flag: MsgFlag.SENDER_PAYS_FEES
        }(root_public_key, root_owner_address);

        RootTokenContract(tokenRoot).getDetails{value: Gas.GET_TOKEN_DETAILS_VALUE, callback: onTokenGetDetails}();

        new TokenFactoryStorage{
            stateInit: _buildStorageInitData(tokenRoot),
            value: 0,
            flag: MsgFlag.ALL_NOT_RESERVED
        }(StorageData({
            answer_id: answer_id,
            pending_token: tokenRoot,
            root_public_key: root_public_key,
            root_owner_address: root_owner_address,
            name: name,
            symbol: symbol,
            decimals: decimals,
            sender: msg.sender
        }));

    }

    function onTokenGetDetails(IRootTokenContract.IRootTokenContractDetails details) public view override {
        TvmBuilder b;
        b.store(details.root_public_key, details.root_owner_address);
        address tfStorage = address(tvm.hash(_buildStorageInitData(msg.sender)));
        TokenFactoryStorage(tfStorage).getData{
            value: 0,
            flag: MsgFlag.REMAINING_GAS,
            callback: onStorageReadWithDetails
        }(b.toCell());
    }

    function onStorageReadWithDetails(StorageData data, TvmCell meta) public view override {
        address expected = address(tvm.hash(_buildStorageInitData(data.pending_token)));
        require(msg.sender == expected, TokenFactoryErrors.NOT_MY_STORAGE);
        (uint256 root_public_key, address root_owner_address) = meta.toSlice().decode(uint256, address);
        if (root_public_key == data.root_public_key && root_owner_address == data.root_owner_address) {
            TokenFactoryStorage(msg.sender).prune{
                value: 0,
                flag: MsgFlag.REMAINING_GAS,
                callback: onStoragePruneNotify
            }();
        } else {
            TokenFactoryStorage(msg.sender).prune{
                value: 0,
                flag: MsgFlag.REMAINING_GAS,
                callback: onStoragePruneReturn
            }();
        }
    }

    function onStoragePruneNotify(StorageData data) public view override {
        address expected = address(tvm.hash(_buildStorageInitData(data.pending_token)));
        require(msg.sender == expected, TokenFactoryErrors.NOT_MY_STORAGE);
        ITokenRootDeployedCallback(data.sender).notifyTokenRootDeployed{
            value: 0,
            flag: MsgFlag.REMAINING_GAS,
            bounce: false
        }(data.answer_id, data.pending_token);
    }

    function onStoragePruneReturn(StorageData data) public view override {
        address expected = address(tvm.hash(_buildStorageInitData(data.pending_token)));
        require(msg.sender == expected, TokenFactoryErrors.NOT_MY_STORAGE);
        ITokenRootDeployedCallback(data.sender).notifyTokenRootNotDeployed{
            value: 0,
            flag: MsgFlag.REMAINING_GAS,
            bounce: false
        }(data.answer_id, data.pending_token);
    }

    function _buildInitData(
        bytes name,
        bytes symbol,
        uint8 decimals
    ) private inline view returns (TvmCell) {
        return tvm.buildStateInit({
            contr: RootTokenContract,
            varInit: {
            //  Bug with rnd in node se
            //  _randomNonce: rnd.next(uint32(0xFFFFFFFF)),
                _randomNonce: now,
                name: name,
                symbol: symbol,
                decimals: decimals,
                wallet_code: wallet_code
            },
            pubkey: 0,
            code: root_code
        });
    }

    function _buildStorageInitData(address tokenRoot) private view returns (TvmCell) {
        return tvm.buildStateInit({
            contr: TokenFactoryStorage,
            varInit: {
                root: address(this),
                pending_token: tokenRoot
            },
            pubkey: 0,
            code: storage_code
        });
    }

    function returnChange() private inline view {
        owner.transfer({value: 0, flag: MsgFlag.REMAINING_GAS});
    }

    function upgrade(TvmCell code) public override onlyOwner {
        tvm.rawReserve(address(this).balance - msg.value, 2);

        TvmBuilder builder;

        builder.store(root_code);
        builder.store(wallet_code);
        builder.store(storage_code);
        builder.store(owner);
        builder.store(pending_owner);

        tvm.setcode(code);
        tvm.setCurrentCode(code);

        onCodeUpgrade(builder.toCell());
    }

    function onCodeUpgrade(TvmCell upgrade_data) private {}

    function resetGas(address receiver) override external view onlyOwner {
        tvm.rawReserve(Gas.TOKEN_FACTORY_INITIAL_BALANCE, 2);
        receiver.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED });
    }

    function resetTargetGas(address target, address receiver) external view onlyOwner {
        tvm.rawReserve(math.max(Gas.TOKEN_FACTORY_INITIAL_BALANCE, address(this).balance - msg.value), 2);
        IResetGas(target).resetGas{ value: 0, flag: MsgFlag.ALL_NOT_RESERVED }(receiver);
    }
}
