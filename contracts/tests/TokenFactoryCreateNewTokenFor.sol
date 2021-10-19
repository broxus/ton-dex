pragma ton-solidity >= 0.39.0;

pragma AbiHeader time;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

import "../interfaces/ITokenFactory.sol";
import "../interfaces/ITokenRootDeployedCallback.sol";

contract TokenFactoryCreateNewTokenFor is ITokenRootDeployedCallback {

    uint256 static _randomNonce;

    address _factory;

    mapping(uint32 => address) deployedTokens;

    event RootDepoyed(address root);
    event RootNotDepoyed(uint32 answer_id, address root);

    constructor(address factory) public {
        tvm.accept();
        _factory = factory;
    }

    function newToken(
        uint32 answer_id,
        uint128 value,
        address owner,
        bytes name,
        bytes symbol,
        uint8 decimals
    ) public view {
        tvm.accept();
        ITokenFactory(_factory).Token{value: value}(answer_id, 0, owner, name, symbol, decimals);
    }

    function notifyTokenRootDeployed(uint32 answer_id, address token_root) public override {
        require(msg.sender == _factory, 100);
        emit RootDepoyed(token_root);
        deployedTokens[answer_id] = token_root;
    }
    function notifyTokenRootNotDeployed(uint32 answer_id, address token_root) public override {
        require(msg.sender == _factory, 100);
        emit RootNotDepoyed(answer_id, token_root);
    }

    function getDeployedToken(uint32 answer_id) public view returns (address) {
        return deployedTokens[answer_id];
    }

}
