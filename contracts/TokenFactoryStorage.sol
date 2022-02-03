pragma ton-solidity >= 0.56.0;

import "./interfaces/ITokenFactory.sol";
import "./libraries/MsgFlag.sol";

contract TokenFactoryStorage {
    address static root;
    address static pending_token;

    ITokenFactory.StorageData _data;

    modifier onlyRoot {
        require(msg.sender == root, 101);
        _;
    }

    constructor (ITokenFactory.StorageData data) public onlyRoot {
        _data = data;
    }

    function getData(TvmCell meta) public responsible view returns (ITokenFactory.StorageData, TvmCell) {
        return{value: 0, flag: MsgFlag.REMAINING_GAS} (_data, meta);
    }

    function prune() public responsible view onlyRoot returns (ITokenFactory.StorageData) {
        return{value: 0, flag: MsgFlag.ALL_NOT_RESERVED + MsgFlag.DESTROY_IF_ZERO} _data;
    }
}
