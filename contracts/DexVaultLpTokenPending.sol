pragma ton-solidity ^0.39.0;

import "./libraries/DexErrors.sol";
import "./libraries/Gas.sol";
import "./libraries/MsgFlag.sol";

import "./interfaces/ITokenFactory.sol";
import "./interfaces/IDexVault.sol";
import "./interfaces/ITokenRootDeployedCallback.sol";

import "../node_modules/ton-eth-bridge-token-contracts/free-ton/contracts/interfaces/IRootTokenContract.sol";

contract DexVaultLpTokenPending is ITokenRootDeployedCallback {

    string LP_TOKEN_SYMBOL_PREFIX = "BROXUS-LP-";
    string LP_TOKEN_SYMBOL_SEPARATOR = "-";
    uint8 LP_TOKEN_DECIMALS = 9;

    struct TokenDetails {
        bytes name;
        bytes symbol;
        uint8 decimals;
    }

    uint32 static _nonce;

    address static vault;
    address static pair;
    address static left_root;
    address static right_root;

    address token_factory;

    address lp_token_root;

    uint128 deploy_value;
    address send_gas_to;

    bool need_to_terminate;
    uint8 pending_messages;

    TokenDetails left_root_details;
    bool left_root_details_received;

    TokenDetails right_root_details;
    bool right_root_details_received;

    modifier onlyVault {
        require(msg.sender == vault, DexErrors.NOT_ROOT);
        _;
    }

    modifier onlyTokenFactory {
        require(msg.sender == token_factory, DexErrors.NOT_TOKEN_FACTORY);
        _;
    }

    modifier onlyExpectedToken {
        require(isSenderExpectedToken(), DexErrors.NOT_EXPECTED_TOKEN);
        _;
    }

    constructor(address token_factory_, uint128 value_, address send_gas_to_) public onlyVault {
        token_factory = token_factory_;
        send_gas_to = send_gas_to_;
        deploy_value = value_;

        IRootTokenContract(left_root).getDetails{
            value: Gas.GET_TOKEN_DETAILS_VALUE,
            flag: MsgFlag.SENDER_PAYS_FEES,
            callback: onGetDetails
        }();
        IRootTokenContract(right_root).getDetails{
            value: Gas.GET_TOKEN_DETAILS_VALUE,
            flag: MsgFlag.SENDER_PAYS_FEES,
            callback: onGetDetails
        }();
        pending_messages+=2;
    }

    function onGetDetails(IRootTokenContract.IRootTokenContractDetails details) public onlyExpectedToken {
        pending_messages--;
        if (msg.sender == left_root) {
            left_root_details = simplifyTokenDetails(details);
            left_root_details_received = true;
            if (right_root_details_received) {
                createLpTokenAndWallets();
            }
        } else if (msg.sender == right_root) {
            right_root_details = simplifyTokenDetails(details);
            right_root_details_received = true;
            if (left_root_details_received) {
                createLpTokenAndWallets();
            }
        }
        terminateIfEmptyQueue();
    }

    function notifyTokenRootDeployed(
        uint32 /*answer_id*/,
        address token_root
    ) override public onlyTokenFactory {
        lp_token_root = token_root;
        deployEmptyWallet(token_root, vault, send_gas_to);
        IDexVault(vault).onLiquidityTokenDeployed{
            value: 0,
            flag: MsgFlag.ALL_NOT_RESERVED + MsgFlag.DESTROY_IF_ZERO
        }(_nonce, pair, left_root, right_root, lp_token_root, send_gas_to);
    }

    function notifyTokenRootNotDeployed(
        uint32 /*answer_id*/,
        address /*token_root*/
    ) override public onlyTokenFactory {
        _onLiquidityTokenNotDeployed();
    }

    function _onLiquidityTokenNotDeployed() private inline view {
        IDexVault(vault).onLiquidityTokenNotDeployed{
            value: 0,
            flag: MsgFlag.ALL_NOT_RESERVED + MsgFlag.DESTROY_IF_ZERO
        }(_nonce, pair, left_root, right_root, lp_token_root, send_gas_to);
    }

    function createLpTokenAndWallets() private {
        bytes lp_token_sybmol = lpTokenSymbol(left_root_details.symbol, right_root_details.symbol);
        deployLpToken(lp_token_sybmol, LP_TOKEN_DECIMALS);
        deployEmptyWallet(left_root, vault, address(this));
        deployEmptyWallet(right_root, vault, address(this));
    }

    function deployLpToken(bytes symbol, uint8 decimals) private inline {
        pending_messages++;
        ITokenFactory(token_factory).Token{
            value: Gas.DEPLOY_TOKEN_ROOT_MIN_VALUE + Gas.TOKEN_FACTORY_FEE,
            flag: MsgFlag.SENDER_PAYS_FEES
        }(
            0,          /*answer_id*/
            0,          /*root_public_key*/
            pair,       /*root_owner_address*/
            symbol,     /*name*/
            symbol,     /*symbol*/
            decimals    /*decimals*/
        );
    }

    function deployEmptyWallet(address token_root, address wallet_owner, address gas_back_address) private pure {
        IRootTokenContract(token_root).deployEmptyWallet{
            value: Gas.DEPLOY_EMPTY_WALLET_VALUE,
            flag: MsgFlag.SENDER_PAYS_FEES
        }(
            Gas.DEPLOY_EMPTY_WALLET_GRAMS, /*deploy_grams*/
            0,                             /*wallet_public_key*/
            wallet_owner,                  /*owner_address*/
            gas_back_address               /*gas_back_address*/
        );
    }

    function simplifyTokenDetails(
        IRootTokenContract.IRootTokenContractDetails details
    ) private inline pure returns (TokenDetails) {
        return TokenDetails({
            name: details.name,
            symbol: details.symbol,
            decimals: details.decimals
        });
    }

    function lpTokenSymbol(bytes left_symbol, bytes right_symbol) private inline view returns (bytes) {
        string name = LP_TOKEN_SYMBOL_PREFIX;
        name.append(left_symbol);
        name.append(LP_TOKEN_SYMBOL_SEPARATOR);
        name.append(right_symbol);
        return bytes(name);
    }

    function isSenderExpectedToken() private view returns (bool) {
        return msg.sender == left_root || msg.sender == right_root;
    }

    function terminateIfEmptyQueue() private inline view {
        if (pending_messages == 0) {
            _onLiquidityTokenNotDeployed();
        }
    }

    onBounce(TvmSlice /*body*/) external {
        if (isSenderExpectedToken() && msg.sender == token_factory) {
            pending_messages--;
            terminateIfEmptyQueue();
        }
      }

    receive() external pure {}
}
