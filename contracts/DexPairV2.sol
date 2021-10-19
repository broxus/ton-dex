pragma ton-solidity >= 0.39.0;

pragma AbiHeader time;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

import "../node_modules/ton-eth-bridge-token-contracts/free-ton/contracts/interfaces/IRootTokenContract.sol";
import "../node_modules/ton-eth-bridge-token-contracts/free-ton/contracts/interfaces/ITONTokenWallet.sol";
import "../node_modules/ton-eth-bridge-token-contracts/free-ton/contracts/interfaces/IExpectedWalletAddressCallback.sol";
import "../node_modules/ton-eth-bridge-token-contracts/free-ton/contracts/interfaces/IBurnableByRootTokenRootContract.sol";
import "../node_modules/ton-eth-bridge-token-contracts/free-ton/contracts/interfaces/IBurnableByOwnerTokenWallet.sol";
import "../node_modules/ton-eth-bridge-token-contracts/free-ton/contracts/interfaces/ITokensReceivedCallback.sol";

import "./libraries/PlatformTypes.sol";
import "./libraries/DexErrors.sol";
import "./libraries/Gas.sol";
import "./libraries/MsgFlag.sol";
import "./libraries/OperationTypes.sol";

import "./interfaces/IUpgradableByRequest.sol";
import "./interfaces/IDexRoot.sol";
import "./interfaces/IDexPairV2.sol";
import "./interfaces/ISuccessCallback.sol";
import "./interfaces/IDexAccount.sol";
import "./interfaces/IDexVault.sol";
import "./interfaces/IResetGas.sol";
import "./interfaces/IAfterInitialize.sol";
import "./structures/IExchangeResult.sol";
import "./structures/IWithdrawResult.sol";
import "./interfaces/IDexPairOperationCallback.sol";

import "./DexPlatform.sol";

contract DexPairV2 is IDexPairV2, ITokensReceivedCallback, IExpectedWalletAddressCallback,
                    IUpgradableByRequest, IAfterInitialize, IResetGas, ITokenOperationStructure {

    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // Data

    // Base:
    address root;
    address vault;
    uint32 current_version;
    TvmCell public platform_code;

    // Params:
    address left_root;
    address right_root;

    // Custom:
    bool active;
    // Wallets
    address public lp_wallet;
    address public left_wallet;
    address public right_wallet;
    // Vault wallets
    address public vault_left_wallet;
    address public vault_right_wallet;
    // Liquidity tokens
    address public lp_root;
    uint128 public lp_supply;
    // Balances
    uint128 public left_balance;
    uint128 public right_balance;
    // Fee
    uint16 fee_numerator;
    uint16 fee_denominator;

    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // Base functions

    // Cant be deployed directly
    constructor() public { revert(); }

    // Prevent manual transfers
    receive() external pure { revert(); }

    // Prevent undefined functions call, need for bounce future Account/Root functions calls, when not upgraded
    fallback() external pure { revert();  }

    // ...and allow root to get surplus gas
    function resetGas(address receiver) override external view onlyRoot {
        tvm.rawReserve(Gas.PAIR_INITIAL_BALANCE, 2);
        receiver.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED });
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // Getters

    function getRoot() override external view responsible returns (address dex_root) {
        return { value: 0, bounce: false, flag: MsgFlag.REMAINING_GAS } root;
    }

    function getTokenRoots() override external view responsible returns (address left, address right, address lp) {
        return { value: 0, bounce: false, flag: MsgFlag.REMAINING_GAS } (left_root, right_root, lp_root);
    }

    function getTokenWallets() override external view responsible returns (address left, address right, address lp) {
        return { value: 0, bounce: false, flag: MsgFlag.REMAINING_GAS } (left_wallet, right_wallet, lp_wallet);
    }

    function getVersion() override external view responsible returns (uint32 version) {
        return { value: 0, bounce: false, flag: MsgFlag.REMAINING_GAS } current_version;
    }

    function getVault() override external view responsible returns (address dex_vault) {
        return { value: 0, bounce: false, flag: MsgFlag.REMAINING_GAS } vault;
    }

    function getVaultWallets() override external view responsible returns (address left, address right) {
        return { value: 0, bounce: false, flag: MsgFlag.REMAINING_GAS } (vault_left_wallet, vault_right_wallet);
    }

    function setFeeParams(uint16 numerator, uint16 denominator) override external onlyRoot {
        fee_numerator = numerator;
        fee_denominator = denominator;
        emit FeesParamsUpdated(fee_numerator, fee_denominator);
    }

    function getFeeParams() override external view responsible returns (uint16 numerator, uint16 denominator) {
        return { value: 0, bounce: false, flag: MsgFlag.REMAINING_GAS } (fee_numerator, fee_denominator);
    }

    function isActive() override external view responsible returns (bool) {
        return { value: 0, bounce: false, flag: MsgFlag.REMAINING_GAS } active;
    }

    function getBalances() override external view responsible returns (IDexPairBalances) {
        return { value: 0, bounce: false, flag: MsgFlag.REMAINING_GAS } IDexPairBalances(
            lp_supply,
            left_balance,
            right_balance
        );
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // Direct operations

    function buildExchangePayload(uint64 id, uint128 deploy_wallet_grams, uint128 expected_amount) external pure returns (TvmCell) {
        TvmBuilder builder;
        builder.store(OperationTypes.EXCHANGE);
        builder.store(id);
        builder.store(deploy_wallet_grams);
        builder.store(expected_amount);
        return builder.toCell();
    }

    function buildDepositLiquidityPayload(uint64 id, uint128 deploy_wallet_grams) external pure returns (TvmCell) {
        TvmBuilder builder;
        builder.store(OperationTypes.DEPOSIT_LIQUIDITY);
        builder.store(id);
        builder.store(deploy_wallet_grams);
        return builder.toCell();
    }

    function buildWithdrawLiquidityPayload(uint64 id, uint128 deploy_wallet_grams) external pure returns (TvmCell) {
        TvmBuilder builder;
        builder.store(OperationTypes.WITHDRAW_LIQUIDITY);
        builder.store(id);
        builder.store(deploy_wallet_grams);
        return builder.toCell();
    }

    function buildCrossPairExchangePayload(
        uint64 id,
        uint128 deploy_wallet_grams,
        uint128 expected_amount,
        TokenOperation[] steps
    ) external pure responsible returns (TvmCell) {
        require(steps.length > 0);
        TvmBuilder builder;

        builder.store(OperationTypes.CROSS_PAIR_EXCHANGE);
        builder.store(id);
        builder.store(deploy_wallet_grams);
        builder.store(expected_amount);
        builder.store(steps[0].root);

        TvmBuilder next_step_builder;
        next_step_builder.store(steps[steps.length - 1].amount);

        for (uint i = steps.length - 1; i > 0; i--) {
            TvmBuilder current_step_builder;
            current_step_builder.store(steps[i - 1].amount, steps[i].root);
            current_step_builder.store(next_step_builder.toCell());
            next_step_builder = current_step_builder;
        }

        builder.store(next_step_builder.toCell());

        return builder.toCell();
    }

    function tokensReceivedCallback(
        address token_wallet,
        address token_root,
        uint128 tokens_amount,
        uint256 sender_public_key,
        address sender_address,
        address sender_wallet,
        address original_gas_to,
        uint128 /*updated_balance*/,
        TvmCell payload
    ) override external {
        tvm.rawReserve(Gas.PAIR_INITIAL_BALANCE, 2);
        TvmSlice payloadSlice = payload.toSlice();

        bool need_cancel = !active ||
            payloadSlice.bits() < 200 ||
            lp_supply == 0 ||
            (tokens_amount < fee_denominator && token_root != lp_root);

        bool notify_success = payloadSlice.refs() >= 1;
        bool notify_cancel = payloadSlice.refs() >= 2;
        TvmCell empty;
        TvmCell success_payload;
        TvmCell cancel_payload;
        if (notify_success) {
            success_payload = payloadSlice.loadRef();
        }
        if (notify_cancel) {
            cancel_payload = payloadSlice.loadRef();
        }

        if (!need_cancel) {

            (uint8 op, uint64 id, uint128 deploy_wallet_grams) = payloadSlice.decode(uint8, uint64, uint128);

            if (token_root == left_root && token_wallet == left_wallet && msg.sender == left_wallet &&
                msg.value >= Gas.DIRECT_PAIR_OP_MIN_VALUE_V2 + deploy_wallet_grams) {
                if (op == OperationTypes.EXCHANGE && payloadSlice.bits() >= 128) {
                    // exchange left to right
                    uint128 expected_amount = payloadSlice.decode(uint128);
                    (uint128 right_amount, uint128 left_fee) =
                    _expectedExchange(tokens_amount, left_balance, right_balance);
                    if (right_amount <= right_balance && right_amount >= expected_amount) {
                        left_balance += tokens_amount;
                        right_balance -= right_amount;

                        emit ExchangeLeftToRight(tokens_amount, left_fee, right_amount);

                        if (sender_address.value != 0) {
                            IDexPairOperationCallback(sender_address).dexPairExchangeSuccess{
                                value: 10,
                                flag: MsgFlag.SENDER_PAYS_FEES + MsgFlag.IGNORE_ERRORS
                            }(id, false, IExchangeResult.ExchangeResult(true, tokens_amount, left_fee, right_amount));
                        }

                        IDexVault(vault).transfer{
                            value: Gas.VAULT_TRANSFER_BASE_VALUE_V2 + deploy_wallet_grams,
                            flag: MsgFlag.SENDER_PAYS_FEES
                        }(
                            right_amount,
                            right_root,
                            vault_right_wallet,
                            sender_public_key,
                            sender_address,
                            deploy_wallet_grams,
                            notify_success,
                            success_payload,
                            left_root,
                            right_root,
                            current_version,
                            original_gas_to
                        );

                        ITONTokenWallet(token_wallet).transferToRecipient{ value: 0, flag: MsgFlag.ALL_NOT_RESERVED }(
                            0,
                            vault,
                            tokens_amount,
                            0,
                            0,
                            original_gas_to,
                            true,
                            empty
                        );
                    } else {
                        need_cancel = true;
                    }
                } else if (op == OperationTypes.DEPOSIT_LIQUIDITY) {
                    // deposit liquidity by left side with auto exchange
                    DepositLiquidityResult r = _expectedDepositLiquidity(tokens_amount, 0, true);
                    if (r.step_3_lp_reward > 0 && r.step_2_received <= right_balance) {
                        lp_supply = lp_supply + r.step_3_lp_reward;
                        left_balance += tokens_amount;

                        emit ExchangeLeftToRight(r.step_2_spent, r.step_2_fee, r.step_2_received);
                        emit DepositLiquidity(r.step_3_left_deposit, r.step_3_right_deposit, r.step_3_lp_reward);

                        if (sender_address.value != 0) {
                            IDexPairOperationCallback(sender_address).dexPairDepositLiquiditySuccess{
                                value: 20,
                                flag: MsgFlag.SENDER_PAYS_FEES + MsgFlag.IGNORE_ERRORS
                            }(id, false, r);
                        }

                        IRootTokenContract(lp_root).deployWallet{
                            value: Gas.DEPLOY_MINT_VALUE_BASE_V2 + deploy_wallet_grams,
                            flag: MsgFlag.SENDER_PAYS_FEES
                        }(
                            r.step_3_lp_reward,
                            deploy_wallet_grams,
                            sender_public_key,
                            sender_address,
                            original_gas_to
                        );

                        ITONTokenWallet(token_wallet).transferToRecipient{ value: 0, flag: MsgFlag.ALL_NOT_RESERVED }(
                            0,
                            vault,
                            tokens_amount,
                            0,
                            0,
                            original_gas_to,
                            true,
                            empty
                        );
                    } else {
                        need_cancel = true;
                    }
                } else if (op == OperationTypes.CROSS_PAIR_EXCHANGE &&
                           payloadSlice.bits() >= 395 &&
                            notify_success &&
                           success_payload.toSlice().bits() >= 128) {
                    (uint128 expected_amount, address next_token_root) = payloadSlice.decode(uint128, address);
                    (uint128 right_amount, uint128 left_fee) =
                        _expectedExchange(tokens_amount, left_balance, right_balance);
                    if (right_amount <= right_balance && right_amount >= expected_amount &&
                        next_token_root.value != 0 && next_token_root != right_root && next_token_root != left_root) {

                        left_balance += tokens_amount;
                        right_balance -= right_amount;

                        emit ExchangeLeftToRight(tokens_amount, left_fee, right_amount);

                        if (sender_address.value != 0) {
                            IDexPairOperationCallback(sender_address).dexPairExchangeSuccess{
                            value: 40,
                            flag: MsgFlag.SENDER_PAYS_FEES + MsgFlag.IGNORE_ERRORS
                            }(id, false, IExchangeResult.ExchangeResult(true, tokens_amount, left_fee, right_amount));
                        }

                        ITONTokenWallet(token_wallet).transferToRecipient{
                            value: Gas.TRANSFER_TO_RECIPIENT_VALUE,
                            flag: MsgFlag.SENDER_PAYS_FEES
                        }(
                            0,
                            vault,
                            tokens_amount,
                            0,
                            0,
                            original_gas_to,
                            true,
                            empty
                        );

                        address next_pair = _expectedPairAddress(right_root, next_token_root);

                        IDexPairV2(next_pair).crossPairExchange{
                            value: 0,
                            flag: MsgFlag.ALL_NOT_RESERVED
                        }(
                            id,

                            current_version,
                            left_root,
                            right_root,

                            right_root,
                            right_amount,

                            sender_public_key,
                            sender_address,

                            original_gas_to,
                            deploy_wallet_grams,

                            success_payload
                        );
                    } else {
                        need_cancel = true;
                    }
                } else {
                    need_cancel = true;
                }
            } else if (token_root == right_root && token_wallet == right_wallet && msg.sender == right_wallet &&
                        msg.value >= Gas.DIRECT_PAIR_OP_MIN_VALUE_V2 + deploy_wallet_grams) {
                if (op == OperationTypes.EXCHANGE && payloadSlice.bits() >= 128) {
                    // exchange right to left
                    uint128 expected_amount = payloadSlice.decode(uint128);
                    (uint128 left_amount, uint128 right_fee) =
                    _expectedExchange(tokens_amount, right_balance, left_balance);
                    if (left_amount <= left_balance && left_amount >= expected_amount) {
                        right_balance += tokens_amount;
                        left_balance -= left_amount;

                        emit ExchangeRightToLeft(tokens_amount, right_fee, left_amount);

                        if (sender_address.value != 0) {
                            IDexPairOperationCallback(sender_address).dexPairExchangeSuccess{
                                value: 10,
                                flag: MsgFlag.SENDER_PAYS_FEES + MsgFlag.IGNORE_ERRORS
                            }(id, false, IExchangeResult.ExchangeResult(false, tokens_amount, right_fee, left_amount));
                        }

                        IDexVault(vault).transfer{
                            value: Gas.VAULT_TRANSFER_BASE_VALUE_V2 + deploy_wallet_grams,
                            flag: MsgFlag.SENDER_PAYS_FEES
                        }(
                            left_amount,
                            left_root,
                            vault_left_wallet,
                            sender_public_key,
                            sender_address,
                            deploy_wallet_grams,
                            notify_success,
                            success_payload,
                            left_root,
                            right_root,
                            current_version,
                            original_gas_to
                        );

                        ITONTokenWallet(token_wallet).transferToRecipient{ value: 0, flag: MsgFlag.ALL_NOT_RESERVED }(
                            0,
                            vault,
                            tokens_amount,
                            0,
                            0,
                            original_gas_to,
                            true,
                            empty
                        );
                    } else {
                        need_cancel = true;
                    }
                } else if (op == OperationTypes.DEPOSIT_LIQUIDITY) {
                    // deposit liquidity by right side with auto exchange
                    DepositLiquidityResult r = _expectedDepositLiquidity(0, tokens_amount, true);
                    if (r.step_3_lp_reward > 0 && r.step_2_received <= left_balance) {
                        lp_supply = lp_supply + r.step_3_lp_reward;
                        right_balance += tokens_amount;

                        emit ExchangeRightToLeft(r.step_2_spent, r.step_2_fee, r.step_2_received);
                        emit DepositLiquidity(r.step_3_left_deposit, r.step_3_right_deposit, r.step_3_lp_reward);

                        if (sender_address.value != 0) {
                            IDexPairOperationCallback(sender_address).dexPairDepositLiquiditySuccess{
                                value: 20,
                                flag: MsgFlag.SENDER_PAYS_FEES + MsgFlag.IGNORE_ERRORS
                            }(id, false, r);
                        }

                        IRootTokenContract(lp_root).deployWallet{
                            value: Gas.DEPLOY_MINT_VALUE_BASE_V2 + deploy_wallet_grams,
                            flag: MsgFlag.SENDER_PAYS_FEES
                        }(
                            r.step_3_lp_reward,
                            deploy_wallet_grams,
                            sender_public_key,
                            sender_address,
                            original_gas_to
                        );

                        ITONTokenWallet(token_wallet).transferToRecipient{ value: 0, flag: MsgFlag.ALL_NOT_RESERVED }(
                            0,
                            vault,
                            tokens_amount,
                            0,
                            0,
                            original_gas_to,
                            true,
                            empty
                        );
                    } else {
                        need_cancel = true;
                    }
                } else if (op == OperationTypes.CROSS_PAIR_EXCHANGE &&
                           payloadSlice.bits() >= 395 &&
                           notify_success &&
                           success_payload.toSlice().bits() >= 128) {
                    (uint128 expected_amount, address next_token_root) = payloadSlice.decode(uint128, address);
                    (uint128 left_amount, uint128 right_fee) =
                    _expectedExchange(tokens_amount, right_balance, left_balance);
                    if (left_amount <= left_balance && left_amount >= expected_amount &&
                        next_token_root.value != 0 && next_token_root != right_root && next_token_root != left_root) {

                        right_balance += tokens_amount;
                        left_balance -= left_amount;

                        emit ExchangeRightToLeft(tokens_amount, right_fee, left_amount);

                        if (sender_address.value != 0) {
                            IDexPairOperationCallback(sender_address).dexPairExchangeSuccess{
                                value: 40,
                                flag: MsgFlag.SENDER_PAYS_FEES + MsgFlag.IGNORE_ERRORS
                            }(id, false, IExchangeResult.ExchangeResult(false, tokens_amount, right_fee, left_amount));
                        }

                        ITONTokenWallet(token_wallet).transferToRecipient{
                            value: Gas.TRANSFER_TO_RECIPIENT_VALUE,
                            flag: MsgFlag.SENDER_PAYS_FEES
                        }(
                            0,
                            vault,
                            tokens_amount,
                            0,
                            0,
                            original_gas_to,
                            true,
                            empty
                        );

                        address next_pair = _expectedPairAddress(left_root, next_token_root);

                        IDexPairV2(next_pair).crossPairExchange{
                            value: 0,
                            flag: MsgFlag.ALL_NOT_RESERVED
                        }(
                            id,

                            current_version,
                            left_root,
                            right_root,

                            left_root,
                            left_amount,

                            sender_public_key,
                            sender_address,

                            original_gas_to,
                            deploy_wallet_grams,

                            success_payload
                        );
                    } else {
                        need_cancel = true;
                    }
                } else {
                    need_cancel = true;
                }
            } else if (op == OperationTypes.WITHDRAW_LIQUIDITY && token_root == lp_root &&
                       token_wallet == lp_wallet && msg.sender == lp_wallet &&
                       msg.value >= Gas.DIRECT_PAIR_OP_MIN_VALUE_V2 + 2 * deploy_wallet_grams) {

                (uint128 left_back_amount, uint128 right_back_amount) = _withdrawLiquidityBase(tokens_amount);

                if (sender_address.value != 0) {
                    IDexPairOperationCallback(sender_address).dexPairWithdrawSuccess{
                        value: 30,
                        flag: MsgFlag.SENDER_PAYS_FEES + MsgFlag.IGNORE_ERRORS
                    }(id, false, IWithdrawResult.WithdrawResult(tokens_amount, left_back_amount, right_back_amount));
                }

                IDexVault(vault).transfer{
                    value: Gas.VAULT_TRANSFER_BASE_VALUE_V2 + deploy_wallet_grams,
                    flag: MsgFlag.SENDER_PAYS_FEES
                }(
                    left_back_amount,
                    left_root,
                    vault_left_wallet,
                    sender_public_key,
                    sender_address,
                    deploy_wallet_grams,
                    notify_success,
                    success_payload,
                    left_root,
                    right_root,
                    current_version,
                    original_gas_to
                );

                IDexVault(vault).transfer{
                    value: Gas.VAULT_TRANSFER_BASE_VALUE_V2 + deploy_wallet_grams,
                    flag: MsgFlag.SENDER_PAYS_FEES
                }(
                    right_back_amount,
                    right_root,
                    vault_right_wallet,
                    sender_public_key,
                    sender_address,
                    deploy_wallet_grams,
                    notify_success,
                    success_payload,
                    left_root,
                    right_root,
                    current_version,
                    original_gas_to
                );

                IBurnableByOwnerTokenWallet(lp_wallet).burnByOwner{ value: 0, flag: MsgFlag.ALL_NOT_RESERVED }(
                    tokens_amount,
                    0,
                    original_gas_to,
                    address.makeAddrStd(0, 0),
                    empty
                );
            } else {
                need_cancel = true;
            }
        }

        if (need_cancel) {

            if (sender_address.value != 0) {
                uint64 id = 0;

                if (payload.toSlice().bits() >= 72) {
                    (,id) = payload.toSlice().decode(uint8, uint64);
                }

                IDexPairOperationCallback(sender_address).dexPairOperationCancelled{
                    value: 44,
                    flag: MsgFlag.SENDER_PAYS_FEES + MsgFlag.IGNORE_ERRORS
                }(id);
            }

            ITONTokenWallet(token_wallet).transfer{ value: 0, flag: MsgFlag.ALL_NOT_RESERVED }(
                sender_wallet,
                tokens_amount,
                0,
                original_gas_to,
                notify_cancel,
                cancel_payload
            );
        }
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // Deposit liquidity

    function expectedDepositLiquidity(
        uint128 left_amount,
        uint128 right_amount,
        bool auto_change
    ) override external view responsible returns (DepositLiquidityResult) {
        if (lp_supply == 0) {
            return { value: 0, bounce: false, flag: MsgFlag.REMAINING_GAS } DepositLiquidityResult(
                left_amount,
                right_amount,
                math.max(left_amount, right_amount),
                false, false, 0, 0, 0, 0, 0, 0
            );
        } else {
            return { value: 0, bounce: false, flag: MsgFlag.REMAINING_GAS } _expectedDepositLiquidity(left_amount, right_amount, auto_change);
        }
    }

    function depositLiquidity(
        uint64 call_id,
        uint128 left_amount,
        uint128 right_amount,
        address expected_lp_root,
        bool    auto_change,
        address account_owner,
        uint32 /*account_version*/,
        address send_gas_to
    ) override external onlyActive onlyAccount(account_owner) {
        require(expected_lp_root == lp_root, DexErrors.NOT_LP_TOKEN_ROOT);
        require(lp_supply != 0 || (left_amount > 0 && right_amount > 0), DexErrors.WRONG_LIQUIDITY);
        require((left_amount > 0 && right_amount > 0) || (auto_change && (left_amount + right_amount > 0)),
            DexErrors.AMOUNT_TOO_LOW);
        tvm.rawReserve(Gas.PAIR_INITIAL_BALANCE, 2);

        uint128 lp_tokens_amount;

        if (lp_supply == 0) {
            lp_tokens_amount = math.max(left_amount, right_amount);
            left_balance = left_amount;
            right_balance = right_amount;

            emit DepositLiquidity(left_amount, right_amount, lp_tokens_amount);

            IDexPairOperationCallback(account_owner).dexPairDepositLiquiditySuccess{
                value: 2,
                flag: MsgFlag.SENDER_PAYS_FEES + MsgFlag.IGNORE_ERRORS
            }(call_id, true, DepositLiquidityResult(left_amount, right_amount, lp_tokens_amount, false, false, 0, 0, 0, 0, 0, 0));
        } else {
            DepositLiquidityResult r = _expectedDepositLiquidity(left_amount, right_amount, auto_change);
            lp_tokens_amount = r.step_1_lp_reward + r.step_3_lp_reward;

            if (auto_change) {
                if (r.step_2_right_to_left) {
                    require(r.step_2_received <= left_balance + r.step_1_left_deposit, DexErrors.NOT_ENOUGH_FUNDS);
                } else if (r.step_2_left_to_right) {
                    require(r.step_2_received <= right_balance + r.step_1_right_deposit, DexErrors.NOT_ENOUGH_FUNDS);
                }
                left_balance = left_balance + left_amount;
                right_balance = right_balance + right_amount;
            } else {
                left_balance = left_balance + r.step_1_left_deposit;
                right_balance = right_balance + r.step_1_right_deposit;

                if (r.step_1_left_deposit < left_amount) {
                    IDexAccount(msg.sender).internalPairTransfer{
                        value: Gas.INTERNAL_PAIR_TRANSFER_VALUE,
                        flag: MsgFlag.SENDER_PAYS_FEES
                    }(
                        left_amount - r.step_1_left_deposit,
                        left_root,
                        left_root,
                        right_root,
                        send_gas_to
                    );
                }

                if (r.step_1_right_deposit < right_amount) {
                    IDexAccount(msg.sender).internalPairTransfer{
                        value: Gas.INTERNAL_PAIR_TRANSFER_VALUE,
                        flag: MsgFlag.SENDER_PAYS_FEES
                    }(
                        right_amount - r.step_1_right_deposit,
                        right_root,
                        left_root,
                        right_root,
                        send_gas_to
                    );
                }
            }

            if (r.step_1_lp_reward > 0) {
                emit DepositLiquidity(r.step_1_left_deposit, r.step_1_right_deposit, r.step_1_lp_reward);
            }

            if (r.step_2_right_to_left) {
                emit ExchangeRightToLeft(r.step_2_spent, r.step_2_fee, r.step_2_received);
            } else if (r.step_2_left_to_right) {
                emit ExchangeLeftToRight(r.step_2_spent, r.step_2_fee, r.step_2_received);
            }

            if (r.step_3_lp_reward > 0) {
                emit DepositLiquidity(r.step_3_left_deposit, r.step_3_right_deposit, r.step_3_lp_reward);
            }

            IDexPairOperationCallback(account_owner).dexPairDepositLiquiditySuccess{
                value: 2,
                flag: MsgFlag.SENDER_PAYS_FEES + MsgFlag.IGNORE_ERRORS
            }(call_id, true, r);

        }

        lp_supply = lp_supply + lp_tokens_amount;

        IRootTokenContract(lp_root).deployWallet{
            value: Gas.DEPLOY_MINT_VALUE_BASE_V2 + Gas.DEPLOY_EMPTY_WALLET_GRAMS,
            flag: MsgFlag.SENDER_PAYS_FEES
        }(
            lp_tokens_amount,
            Gas.DEPLOY_EMPTY_WALLET_GRAMS,
            0,
            account_owner,
            send_gas_to
        );

        ISuccessCallback(msg.sender).successCallback{ value: 0, flag: MsgFlag.ALL_NOT_RESERVED }(call_id);
    }

    function _expectedDepositLiquidity(
        uint128 left_amount,
        uint128 right_amount,
        bool auto_change
    ) private view returns (DepositLiquidityResult) {
        // step 1 (first deposit)
        uint128 step_1_left_deposit = 0;
        uint128 step_1_right_deposit = 0;
        uint128 step_1_lp_reward = 0;

        if (left_amount > 0 && right_amount > 0) {
            step_1_left_deposit = math.min(left_amount, math.muldiv(left_balance, right_amount, right_balance));
            step_1_right_deposit = math.min(right_amount, math.muldiv(right_balance, left_amount, left_balance));
            step_1_lp_reward = math.max(
                math.muldiv(step_1_right_deposit, lp_supply, right_balance),
                math.muldiv(step_1_left_deposit, lp_supply, left_balance)
            );
        }

        uint128 current_left_amount = left_amount - step_1_left_deposit;
        uint128 current_right_amount = right_amount - step_1_right_deposit;
        uint128 current_left_balance = left_balance + step_1_left_deposit;
        uint128 current_right_balance = right_balance + step_1_right_deposit;
        uint128 current_lp_supply = lp_supply + step_1_lp_reward;

        bool step_2_left_to_right = false;
        bool step_2_right_to_left = false;
        uint128 step_2_spent = 0;
        uint128 step_2_fee = 0;
        uint128 step_2_received = 0;

        uint128 step_3_left_deposit = 0;
        uint128 step_3_right_deposit = 0;
        uint128 step_3_lp_reward = 0;

        uint256 fee_d_minus_n = uint256(fee_denominator - fee_numerator);
        uint256 fee_d = uint256(fee_denominator);

        if (auto_change && current_right_amount > 0) {
            // step 2 (surplus RIGHT exchange)
            step_2_right_to_left = true;
            uint256 p = math.muldiv(uint256(current_right_balance), fee_d_minus_n + fee_d, fee_d_minus_n);
            uint256 q = math.muldiv(uint256(current_right_balance), fee_d * uint256(current_right_amount), fee_d_minus_n);
            step_2_spent = _solveQuadraticEquationPQ(p, q);
            (step_2_received, step_2_fee) = _expectedExchange(step_2_spent, current_right_balance, current_left_balance);

            current_right_amount = current_right_amount - step_2_spent;
            current_right_balance = current_right_balance + step_2_spent;

            // step 3 (deposit exchanged amounts)
            step_3_right_deposit = current_right_amount;
            step_3_left_deposit = step_2_received;

            step_3_lp_reward = math.muldiv(current_right_amount, current_lp_supply, current_right_balance);
        } else if (auto_change && current_left_amount > 0) {
            // step 2 (surplus LEFT exchange)
            step_2_left_to_right = true;
            uint256 p = math.muldiv(uint256(current_left_balance), fee_d_minus_n + fee_d, fee_d_minus_n);
            uint256 q = math.muldiv(uint256(current_left_balance), fee_d * uint256(current_left_amount), fee_d_minus_n);
            step_2_spent = _solveQuadraticEquationPQ(p, q);
            (step_2_received, step_2_fee) = _expectedExchange(step_2_spent, current_left_balance, current_right_balance);

            current_left_amount = current_left_amount - step_2_spent;
            current_left_balance = current_left_balance + step_2_spent;

            // step 3 (deposit exchanged amounts)
            step_3_left_deposit = current_left_amount;
            step_3_right_deposit = step_2_received;

            step_3_lp_reward = math.muldiv(current_left_amount, current_lp_supply, current_left_balance);
        }

        return DepositLiquidityResult(
            step_1_left_deposit,
            step_1_right_deposit,
            step_1_lp_reward,

            step_2_left_to_right,
            step_2_right_to_left,
            step_2_spent,
            step_2_fee,
            step_2_received,

            step_3_left_deposit,
            step_3_right_deposit,
            step_3_lp_reward
        );
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // Withdraw liquidity

    function _withdrawLiquidityBase(uint128 lp_amount) private returns (uint128, uint128) {
        uint128 left_back_amount =  math.muldiv(left_balance, lp_amount, lp_supply);
        uint128 right_back_amount = math.muldiv(right_balance, lp_amount, lp_supply);

        left_balance -= left_back_amount;
        right_balance -= right_back_amount;
        lp_supply -= lp_amount;

        emit WithdrawLiquidity(lp_amount, left_back_amount, right_back_amount);

        return (left_back_amount, right_back_amount);
    }

    function expectedWithdrawLiquidity(
        uint128 lp_amount
    ) override external view responsible returns (uint128 expected_left_amount, uint128 expected_right_amount) {
        uint128 left_back_amount =  math.muldiv(left_balance, lp_amount, lp_supply);
        uint128 right_back_amount = math.muldiv(right_balance, lp_amount, lp_supply);

        return { value: 0, bounce: false, flag: MsgFlag.REMAINING_GAS } (left_back_amount, right_back_amount);
    }

    function withdrawLiquidity(
        uint64 call_id,
        uint128 lp_amount,
        address expected_lp_root,
        address account_owner,
        uint32 /*account_version*/,
        address send_gas_to
    ) override external onlyActive onlyAccount(account_owner) {
        require(expected_lp_root == lp_root, DexErrors.NOT_LP_TOKEN_ROOT);
        tvm.rawReserve(Gas.PAIR_INITIAL_BALANCE, 2);

        (uint128 left_back_amount, uint128 right_back_amount) = _withdrawLiquidityBase(lp_amount);

        IDexPairOperationCallback(account_owner).dexPairWithdrawSuccess{
            value: 3,
            flag: MsgFlag.SENDER_PAYS_FEES + MsgFlag.IGNORE_ERRORS
        }(call_id, true, IWithdrawResult.WithdrawResult(lp_amount, left_back_amount, right_back_amount));

        IDexAccount(msg.sender).internalPairTransfer{ value: Gas.INTERNAL_PAIR_TRANSFER_VALUE, flag: MsgFlag.SENDER_PAYS_FEES }(
            left_back_amount,
            left_root,
            left_root,
            right_root,
            send_gas_to
        );

        IDexAccount(msg.sender).internalPairTransfer{ value: Gas.INTERNAL_PAIR_TRANSFER_VALUE, flag: MsgFlag.SENDER_PAYS_FEES }(
            right_back_amount,
            right_root,
            left_root,
            right_root,
            send_gas_to
        );

        TvmCell empty;

        IBurnableByRootTokenRootContract(lp_root).proxyBurn{
            value: Gas.BURN_VALUE,
            flag: MsgFlag.SENDER_PAYS_FEES
        }(
            lp_amount,
            vault,
            send_gas_to,
            address.makeAddrStd(0, 0),
            empty
        );

        ISuccessCallback(msg.sender).successCallback{ value: 0, flag: MsgFlag.ALL_NOT_RESERVED }(call_id);
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // Exchange

    function expectedExchange(
        uint128 amount,
        address spent_token_root
    ) override external view responsible returns (uint128 expected_amount, uint128 expected_fee) {
        if (spent_token_root == left_root) {
            return { value: 0, bounce: false, flag: MsgFlag.REMAINING_GAS } _expectedExchange(amount, left_balance, right_balance);
        } else if (spent_token_root == right_root) {
            return { value: 0, bounce: false, flag: MsgFlag.REMAINING_GAS } _expectedExchange(amount, right_balance, left_balance);
        } else {
            revert(DexErrors.NOT_TOKEN_ROOT);
        }
    }

    function expectedSpendAmount(
        uint128 receive_amount,
        address receive_token_root
    ) override external view responsible returns (uint128 expected_amount, uint128 expected_fee) {
        if (receive_token_root == right_root) {
            return { value: 0, bounce: false, flag: MsgFlag.REMAINING_GAS } _expectedSpendAmount(receive_amount, left_balance, right_balance);
        } else if (receive_token_root == left_root) {
            return { value: 0, bounce: false, flag: MsgFlag.REMAINING_GAS } _expectedSpendAmount(receive_amount, right_balance, left_balance);
        } else {
            revert(DexErrors.NOT_TOKEN_ROOT);
        }
    }

    function exchange(
        uint64 call_id,
        uint128 spent_amount,
        address spent_token_root,
        address receive_token_root,
        uint128 expected_amount,
        address account_owner,
        uint32 /*account_version*/,
        address send_gas_to
    ) override external onlyActive onlyAccount(account_owner) {
        if (spent_token_root == left_root && receive_token_root == right_root) {
            (uint128 right_amount, uint128 left_fee) =
                _expectedExchange(spent_amount, left_balance, right_balance);
            require(right_amount <= right_balance, DexErrors.NOT_ENOUGH_FUNDS);
            require(right_amount >= expected_amount, DexErrors.LOW_EXCHANGE_RATE);

            tvm.rawReserve(Gas.PAIR_INITIAL_BALANCE, 2);

            left_balance += spent_amount;
            right_balance -= right_amount;

            emit ExchangeLeftToRight(spent_amount, left_fee, right_amount);

            IDexPairOperationCallback(account_owner).dexPairExchangeSuccess{
                value: 1,
                flag: MsgFlag.SENDER_PAYS_FEES + MsgFlag.IGNORE_ERRORS
            }(call_id, true, IExchangeResult.ExchangeResult(true, spent_amount, left_fee, right_amount));

            IDexAccount(msg.sender).internalPairTransfer{
                value: Gas.INTERNAL_PAIR_TRANSFER_VALUE,
                flag: MsgFlag.SENDER_PAYS_FEES
            }(
                right_amount,
                right_root,
                left_root,
                right_root,
                send_gas_to
            );

            ISuccessCallback(msg.sender).successCallback{ value: 0, flag: MsgFlag.ALL_NOT_RESERVED }(call_id);

        } else if (spent_token_root == right_root && receive_token_root == left_root){
            (uint128 left_amount, uint128 right_fee) =
                _expectedExchange(spent_amount, right_balance, left_balance);
            require(left_amount <= left_balance, DexErrors.NOT_ENOUGH_FUNDS);
            require(left_amount >= expected_amount, DexErrors.LOW_EXCHANGE_RATE);

            tvm.rawReserve(Gas.PAIR_INITIAL_BALANCE, 2);

            right_balance += spent_amount;
            left_balance -= left_amount;

            emit ExchangeRightToLeft(spent_amount, right_fee, left_amount);

            IDexPairOperationCallback(account_owner).dexPairExchangeSuccess{
                value: 1,
                flag: MsgFlag.SENDER_PAYS_FEES + MsgFlag.IGNORE_ERRORS
            }(call_id, true, IExchangeResult.ExchangeResult(false, spent_amount, right_fee, left_amount));

            IDexAccount(msg.sender).internalPairTransfer{
                value: Gas.INTERNAL_PAIR_TRANSFER_VALUE,
                flag: MsgFlag.SENDER_PAYS_FEES
            }(
                left_amount,
                left_root,
                left_root,
                right_root,
                send_gas_to
            );

            ISuccessCallback(msg.sender).successCallback{ value: 0, flag: MsgFlag.ALL_NOT_RESERVED }(call_id);

        } else {
            revert(DexErrors.NOT_TOKEN_ROOT);
        }
    }

    function _expectedExchange(uint128 a_amount, uint128 a_pool, uint128 b_pool) private view returns (uint128, uint128) {
        uint128 a_fee = math.muldiv(a_amount, fee_numerator, fee_denominator);

        uint128 new_a_pool = a_pool + a_amount;
        uint128 new_b_pool = math.muldiv(a_pool, b_pool, new_a_pool - a_fee);
        uint128 expected_b_amount = b_pool - new_b_pool;

        return (expected_b_amount, a_fee);
    }

    function _expectedSpendAmount(uint128 b_amount, uint128 a_pool, uint128 b_pool) private view returns (uint128, uint128) {
        uint128 fee_d_minus_n = uint128(fee_denominator - fee_numerator);

        uint128 new_b_pool = b_pool - b_amount;
        uint128 new_a_pool = math.muldiv(a_pool, b_pool, new_b_pool);
        uint128 expected_a_amount = math.muldiv(new_a_pool - a_pool, fee_denominator, fee_d_minus_n);
        uint128 a_fee = math.muldiv(expected_a_amount, fee_numerator, fee_denominator);

        return (expected_a_amount, a_fee);
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // Cross-pair exchange

    function crossPairExchange(
        uint64 id,

        uint32 /*prev_pair_version*/,
        address prev_pair_left_root,
        address prev_pair_right_root,

        address spent_token_root,
        uint128 spent_amount,

        uint256 sender_public_key,
        address sender_address,

        address original_gas_to,
        uint128 deploy_wallet_grams,

        TvmCell payload
    ) override external onlyPair(prev_pair_left_root, prev_pair_right_root) onlyActive {

        require(msg.sender != address(this));

        tvm.rawReserve(Gas.PAIR_INITIAL_BALANCE, 2);

        TvmSlice payloadSlice = payload.toSlice();

        uint128 expected_amount = payloadSlice.decode(uint128);
        address next_token_root =  payloadSlice.bits() >= 267 ? payloadSlice.decode(address) : address(0);

        bool has_next_payload = payloadSlice.refs() >= 1;

        TvmCell next_payload;
        if (has_next_payload) {
            next_payload = payloadSlice.loadRef();
        }

        if (spent_token_root == left_root) {
            (uint128 right_amount, uint128 left_fee) =
                _expectedExchange(spent_amount, left_balance, right_balance);

            if (right_amount <= right_balance && right_amount >= expected_amount) {

                left_balance += spent_amount;
                right_balance -= right_amount;

                emit ExchangeLeftToRight(spent_amount, left_fee, right_amount);

                if (sender_address.value != 0) {
                    IDexPairOperationCallback(sender_address).dexPairExchangeSuccess{
                        value: 4,
                        flag: MsgFlag.SENDER_PAYS_FEES + MsgFlag.IGNORE_ERRORS
                    }(id, false, IExchangeResult.ExchangeResult(true, spent_amount, left_fee, right_amount));
                }

                if (next_token_root.value != 0 && next_token_root != right_root && next_token_root != left_root &&
                    has_next_payload && next_payload.toSlice().bits() >= 128 &&
                    msg.value >= Gas.DIRECT_PAIR_OP_MIN_VALUE_V2) {

                    address next_pair = _expectedPairAddress(right_root, next_token_root);

                    IDexPairV2(next_pair).crossPairExchange{
                        value: 0,
                        flag: MsgFlag.ALL_NOT_RESERVED
                    }(
                        id,

                        current_version,
                        left_root,
                        right_root,

                        right_root,
                        right_amount,

                        sender_public_key,
                        sender_address,

                        original_gas_to,
                        deploy_wallet_grams,

                        next_payload
                    );
                } else {
                    IDexVault(vault).transfer{
                        value: 0,
                        flag: MsgFlag.ALL_NOT_RESERVED
                    }(
                        right_amount,
                        right_root,
                        vault_right_wallet,
                        sender_public_key,
                        sender_address,
                        deploy_wallet_grams,
                        has_next_payload,
                        next_payload,
                        left_root,
                        right_root,
                        current_version,
                        original_gas_to
                    );
                }
            } else {
                if (sender_address.value != 0) {
                    IDexPairOperationCallback(sender_address).dexPairOperationCancelled{
                        value: 44,
                        flag: MsgFlag.SENDER_PAYS_FEES + MsgFlag.IGNORE_ERRORS
                    }(id);
                }

                TvmBuilder result_builder;
                result_builder.store(id);

                IDexVault(vault).transfer{
                    value: 0,
                    flag: MsgFlag.ALL_NOT_RESERVED
                }(
                    spent_amount,
                    spent_token_root,
                    vault_left_wallet,
                    sender_public_key,
                    sender_address,
                    deploy_wallet_grams,
                    true,
                    result_builder.toCell(),
                    left_root,
                    right_root,
                    current_version,
                    original_gas_to
                );
            }
        } else if (spent_token_root == right_root){
            (uint128 left_amount, uint128 right_fee) =
                _expectedExchange(spent_amount, right_balance, left_balance);

            if (left_amount <= left_balance && left_amount >= expected_amount) {
                right_balance += spent_amount;
                left_balance -= left_amount;

                emit ExchangeRightToLeft(spent_amount, right_fee, left_amount);

                if (sender_address.value != 0) {
                    IDexPairOperationCallback(sender_address).dexPairExchangeSuccess{
                        value: 4,
                        flag: MsgFlag.SENDER_PAYS_FEES + MsgFlag.IGNORE_ERRORS
                    }(id, false, IExchangeResult.ExchangeResult(false, spent_amount, right_fee, left_amount));
                }

                if (next_token_root.value != 0 && next_token_root != right_root && next_token_root != left_root &&
                    has_next_payload && next_payload.toSlice().bits() >= 128 &&
                    msg.value >= Gas.DIRECT_PAIR_OP_MIN_VALUE_V2) {

                    address next_pair = _expectedPairAddress(left_root, next_token_root);

                    IDexPairV2(next_pair).crossPairExchange{
                        value: 0,
                        flag: MsgFlag.ALL_NOT_RESERVED
                    }(
                        id,

                        current_version,
                        left_root,
                        right_root,

                        left_root,
                        left_amount,

                        sender_public_key,
                        sender_address,

                        original_gas_to,
                        deploy_wallet_grams,

                        next_payload
                    );
                } else {
                    IDexVault(vault).transfer{
                        value: 0,
                        flag: MsgFlag.ALL_NOT_RESERVED
                    }(
                        left_amount,
                        left_root,
                        vault_left_wallet,
                        sender_public_key,
                        sender_address,
                        deploy_wallet_grams,
                        has_next_payload,
                        next_payload,
                        left_root,
                        right_root,
                        current_version,
                        original_gas_to
                    );
                }
            } else {
                if (sender_address.value != 0) {
                    IDexPairOperationCallback(sender_address).dexPairOperationCancelled{
                        value: 44,
                        flag: MsgFlag.SENDER_PAYS_FEES + MsgFlag.IGNORE_ERRORS
                    }(id);
                }

                TvmBuilder result_builder;
                result_builder.store(id);

                IDexVault(vault).transfer{
                    value: 0,
                    flag: MsgFlag.ALL_NOT_RESERVED
                }(
                    spent_amount,
                    spent_token_root,
                    vault_right_wallet,
                    sender_public_key,
                    sender_address,
                    deploy_wallet_grams,
                    true,
                    result_builder.toCell(),
                    left_root,
                    right_root,
                    current_version,
                    original_gas_to
                );
            }
        } else {
            revert(DexErrors.NOT_TOKEN_ROOT);
        }
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // Account operations

    function checkPair(
        uint64 call_id,
        address account_owner,
        uint32 /*account_version*/,
        address send_gas_to
    ) override external onlyAccount(account_owner) {
        tvm.rawReserve(Gas.PAIR_INITIAL_BALANCE, 2);
        IDexAccount(msg.sender).checkPairCallback{ value: 0, flag: MsgFlag.ALL_NOT_RESERVED }(
            call_id,
            left_root,
            right_root,
            lp_root,
            send_gas_to
        );
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // Modifiers

    modifier onlyActive() {
        require(active, DexErrors.NOT_ACTIVE);
        _;
    }

    modifier onlyLiquidityTokenRoot() {
        require(msg.sender == lp_root, DexErrors.NOT_LP_TOKEN_ROOT);
        _;
    }

    modifier onlyTokenRoot() {
        require(msg.sender == left_root || msg.sender == right_root, DexErrors.NOT_TOKEN_ROOT);
        _;
    }

    modifier onlyRoot() {
        require(msg.sender == root, DexErrors.NOT_ROOT);
        _;
    }

    modifier onlyVault() {
        require(msg.sender == vault, DexErrors.NOT_VAULT);
        _;
    }

    modifier onlyAccount(address account_owner) {
        TvmBuilder builder;
        builder.store(account_owner);
        address expected = address(tvm.hash(_buildInitData(PlatformTypes.Account, builder.toCell())));
        require(msg.sender == expected, DexErrors.NOT_ACCOUNT);
        _;
    }

    modifier onlyPair(address left_root_, address right_root_) {
        require(msg.sender == _expectedPairAddress(left_root_, right_root_), DexErrors.NOT_PAIR);
        _;
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // Address calculations
    function _expectedPairAddress(address left_root_, address right_root_) private view returns (address) {
        TvmBuilder builder;
        if (left_root_.value < right_root_.value) {
            builder.store(left_root_);
            builder.store(right_root_);
        } else {
            builder.store(right_root_);
            builder.store(left_root_);
        }
        return address(tvm.hash(_buildInitData(PlatformTypes.Pair, builder.toCell())));
    }

    function _buildInitData(uint8 type_id, TvmCell params) private view returns (TvmCell) {
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

    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // Code upgrade

    function upgrade(TvmCell code, uint32 new_version, address send_gas_to) override external onlyRoot {
        if (current_version == new_version || !active) {
            tvm.rawReserve(Gas.PAIR_INITIAL_BALANCE, 2);
            send_gas_to.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED });
        } else {
            emit PairCodeUpgraded(new_version);

            TvmBuilder builder;

            builder.store(root);
            builder.store(vault);
            builder.store(current_version);
            builder.store(new_version);
            builder.store(send_gas_to);

            builder.store(platform_code);  // ref1 = platform_code

            //Tokens
            TvmBuilder tokens_data_builder;
            tokens_data_builder.store(left_root);
            tokens_data_builder.store(right_root);
            tokens_data_builder.store(lp_root);

            TvmBuilder balances_data_builder;
            // Liquidity tokens
            balances_data_builder.store(lp_supply);
            // Balances
            balances_data_builder.store(left_balance);
            balances_data_builder.store(right_balance);
            // Fee
            balances_data_builder.store(fee_numerator);
            balances_data_builder.store(fee_denominator);
            tokens_data_builder.storeRef(balances_data_builder); // ref2: ref1

            builder.storeRef(tokens_data_builder); // ref2:

            // Wallets
            TvmBuilder pair_wallets_data_builder;
            pair_wallets_data_builder.store(lp_wallet);
            pair_wallets_data_builder.store(left_wallet);
            pair_wallets_data_builder.store(right_wallet);

            builder.storeRef(pair_wallets_data_builder); // ref3:

            // Vault wallets
            TvmBuilder vault_wallets_data_builder;
            vault_wallets_data_builder.store(vault_left_wallet);
            vault_wallets_data_builder.store(vault_right_wallet);
            builder.storeRef(vault_wallets_data_builder); // ref4:


            // set code after complete this method
            tvm.setcode(code);

            // run onCodeUpgrade from new code
            tvm.setCurrentCode(code);
            onCodeUpgrade(builder.toCell());
        }
    }

    /*
        upgrade_data
            bits:
                address root
                address vault
                uint32 old_version - zero if initialize
                uint32 new_version
                address send_gas_to
            refs:
                1: platform_code
                2: tokens_data
                    bits:
                        address left_root
                        address right_root
                        address lp_root
                    refs:
                        1: balances_data
                            bits:
                                uint128 lp_supply
                                uint128 left_balance
                                uint128 right_balance
                                uint16 fee_numerator
                                uint16 fee_denominator
                3: pair_wallets
                    bits:
                        address lp_wallet
                        address left_wallet
                        address right_wallet
                4: vault_wallets
                    bits:
                        address vault_left_wallet
                        address vault_right_wallet
    */
    function onCodeUpgrade(TvmCell upgrade_data) private {
        tvm.rawReserve(Gas.PAIR_INITIAL_BALANCE, 2);
        tvm.resetStorage();
        TvmSlice s = upgrade_data.toSlice();

        address send_gas_to;
        uint32 old_version;

        (root, vault, old_version, current_version, send_gas_to) = s.decode(address, address, uint32, uint32, address);

        platform_code = s.loadRef(); // ref 1
        TvmSlice tokens_data_slice = s.loadRefAsSlice(); // ref 2

        (left_root, right_root) = tokens_data_slice.decode(address, address);

        if (old_version == 0) {
            fee_numerator = 3;
            fee_denominator = 1000;
        } else {
            active = true;
        }

        if (old_version >= 1) {
            lp_root = tokens_data_slice.decode(address);
            TvmSlice token_balances_data_slice = tokens_data_slice.loadRefAsSlice(); // ref 2_1
            (lp_supply, left_balance, right_balance, fee_numerator, fee_denominator) =
                token_balances_data_slice.decode(uint128, uint128, uint128, uint16, uint16);

            TvmSlice pair_wallets_data_slice = s.loadRefAsSlice(); // ref 3
            (lp_wallet, left_wallet, right_wallet) = pair_wallets_data_slice.decode(address, address, address);
            TvmSlice vault_wallets_data = s.loadRefAsSlice(); // ref 4
            (vault_left_wallet, vault_right_wallet) = vault_wallets_data.decode(address, address);
        }

        send_gas_to.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED + MsgFlag.IGNORE_ERRORS });
    }

    function afterInitialize(address send_gas_to) override external onlyRoot {
        tvm.rawReserve(Gas.PAIR_INITIAL_BALANCE, 2);
        if (lp_root.value == 0) {
            IDexVault(vault).addLiquidityToken{ value: 0, flag: MsgFlag.ALL_NOT_RESERVED }(
                address(this),
                left_root,
                right_root,
                send_gas_to
            );
        } else {
            send_gas_to.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED });
        }
    }

    function _configureTokenRootWallets(address token_root, address send_gas_to) private view {
       IRootTokenContract(token_root)
            .deployEmptyWallet {
                value: Gas.DEPLOY_EMPTY_WALLET_VALUE_V2,
                flag: MsgFlag.SENDER_PAYS_FEES
            }(
                Gas.DEPLOY_EMPTY_WALLET_GRAMS,  // deploy_grams
                0,                              // wallet_public_key
                address(this),                  // owner_address
                send_gas_to                     // gas_back_address
            );

       IRootTokenContract(token_root)
            .sendExpectedWalletAddress{
                value: Gas.SEND_EXPECTED_WALLET_VALUE,
                flag: MsgFlag.SENDER_PAYS_FEES
            }(
                0,                              // wallet_public_key_
                address(this) ,                 // owner_address_
                address(this)                   // to
            );

       if (token_root != lp_root) {
           IRootTokenContract(token_root)
                .sendExpectedWalletAddress{
                    value: Gas.SEND_EXPECTED_WALLET_VALUE,
                    flag: MsgFlag.SENDER_PAYS_FEES
                }(
                    0,                              // wallet_public_key_
                    vault,                          // owner_address_
                    address(this)                   // to
                );
       }
    }

    function liquidityTokenRootDeployed(address lp_root_, address send_gas_to) override external onlyVault {
        tvm.rawReserve(Gas.PAIR_INITIAL_BALANCE, 2);

        lp_root = lp_root_;

        _configureTokenRootWallets(lp_root, send_gas_to);
        _configureTokenRootWallets(left_root, send_gas_to);
        _configureTokenRootWallets(right_root, send_gas_to);

        IDexRoot(root).onPairCreated{ value: 0, flag: MsgFlag.ALL_NOT_RESERVED }(left_root, right_root, send_gas_to);
    }

    function liquidityTokenRootNotDeployed(address /*lp_root_*/, address send_gas_to) override external onlyVault {
        if (!active) send_gas_to.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED + MsgFlag.DESTROY_IF_ZERO});
        else {
            tvm.rawReserve(address(this).balance - msg.value, 2);
            send_gas_to.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED});
        }
    }

    // callback for IRootTokenContract(...).sendExpectedWalletAddress
    function expectedWalletAddressCallback(
        address wallet,
        uint256 wallet_public_key,
        address owner_address
    ) override external {
        require(wallet_public_key == 0);

        bool need_set_callback = false;

        if (owner_address == address(this)) {
            if (msg.sender == lp_root && lp_wallet.value == 0) {
                lp_wallet = wallet;
                need_set_callback = true;
            } else if (msg.sender == left_root && left_wallet.value == 0) {
                left_wallet = wallet;
                need_set_callback = true;
            } else if (msg.sender == right_root && right_wallet.value == 0) {
                right_wallet = wallet;
                need_set_callback = true;
            }
        }

        if (owner_address == vault) {
            if (msg.sender == left_root && vault_left_wallet.value == 0) {
                vault_left_wallet = wallet;
            } else if (msg.sender == right_root && vault_right_wallet.value == 0) {
                vault_right_wallet = wallet;
            }
        }

        if (lp_wallet.value != 0 && left_wallet.value != 0 && right_wallet.value != 0 &&
            vault_left_wallet.value != 0 && vault_right_wallet.value != 0) {
            active = true;
        }

        if (need_set_callback) {
            ITONTokenWallet(wallet).setReceiveCallback{ value: 0, flag: MsgFlag.REMAINING_GAS }(address(this), false);
        }
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // Math
    /*
        Solve x*x + p*x - q*x = 0;
    */
    function _solveQuadraticEquationPQ(uint256 p, uint256 q) private pure returns (uint128) {
        uint256 D = math.muldiv(p, p, 4) + q;
        uint256 Dsqrt = _sqrt(D);
        if (Dsqrt > (p/2)) {
            return uint128(Dsqrt - (p/2));
        } else {
            return uint128((p/2) - Dsqrt);
        }
    }

    // Babylonian method for finding sqrt
    function _sqrt(uint256 x) private pure returns (uint256) {
        if (x == 0) return 0;
        else if (x <= 3) return 1;
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        while (z < y)
        {
            y = z;
            z = (x / z + z) / 2;
        }
        return y;
    }
}
