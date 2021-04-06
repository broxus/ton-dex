pragma ton-solidity ^0.39.0;

import "./interfaces/ITokenFactory.sol";

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
        return{value: 0, flag: 64} (_data, meta);
    }

    function prune() public responsible view onlyRoot returns (ITokenFactory.StorageData) {
        return{value: 0, flag: 160} _data;
    }
}
