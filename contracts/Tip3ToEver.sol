pragma ton-solidity >= 0.57.0;

pragma AbiHeader time;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

import "./libraries/EverToTip3Gas.sol";
import "./libraries/EverToTip3Errors.sol";
import "./libraries/DexOperationTypes.sol";
import "./libraries/EverToTip3OperationStatus.sol";

import "./interfaces/IEverTip3SwapEvents.sol";
import "./interfaces/IEverTip3SwapCallbacks.sol";

import "@broxus/contracts/contracts/libraries/MsgFlag.sol";
import "ton-eth-bridge-token-contracts/contracts/interfaces/ITokenRoot.sol";
import "ton-eth-bridge-token-contracts/contracts/interfaces/ITokenWallet.sol";
import "ton-eth-bridge-token-contracts/contracts/interfaces/IAcceptTokensTransferCallback.sol";
import "ton-eth-bridge-token-contracts/contracts/interfaces/IAcceptTokensBurnCallback.sol";

contract Tip3ToEver is IAcceptTokensTransferCallback, IAcceptTokensBurnCallback, IEverTip3SwapEvents {
   
    uint32 static randomNonce_;
    
    address static public weverRoot;
    address static public weverVault;

    address public weverWallet;

    constructor() public {
        tvm.accept();

        tvm.rawReserve(EverToTip3Gas.TARGET_BALANCE, 0);

        ITokenRoot(weverRoot).deployWallet{
            value: EverToTip3Gas.DEPLOY_EMPTY_WALLET_VALUE,
            flag: MsgFlag.SENDER_PAYS_FEES,
            callback: Tip3ToEver.onWeverWallet
        }(
            address(this), 
            EverToTip3Gas.DEPLOY_EMPTY_WALLET_GRAMS
        );
         
        msg.sender.transfer(0, false, MsgFlag.ALL_NOT_RESERVED + MsgFlag.IGNORE_ERRORS);
    }

    // Сallback deploy WEVER wallet for contract
    function onWeverWallet(address _weverWallet) external {
        require(msg.sender.value != 0 && msg.sender == weverRoot, EverToTip3Errors.NOT_WEVER_ROOT);
        weverWallet = _weverWallet;
        weverWallet.transfer(0, false, MsgFlag.REMAINING_GAS + MsgFlag.IGNORE_ERRORS);
    }

    // Payload constructor swap TIP-3 -> Ever
    function buildExchangePayload(
        uint64 id, 
        address pair,
        uint128 expectedAmount
    ) external pure returns (TvmCell) {
        TvmBuilder builder;
        builder.store(EverToTip3OperationStatus.SWAP);
        builder.store(id);
        builder.store(pair);
        builder.store(expectedAmount);
    
        return builder.toCell();
    }

    // Callback result swap
    function onAcceptTokensTransfer(
        address /*tokenRoot*/,
        uint128 amount,
        address sender,
        address /*senderWallet*/,
        address user,
        TvmCell payload
    ) override external {
        TvmSlice payloadSlice = payload.toSlice();
        bool needCancel;
        tvm.rawReserve(EverToTip3Gas.TARGET_BALANCE, 0);

        if (payloadSlice.bits() >= 8) {
            (uint8 operationStatus) = payloadSlice.decode(uint8);
            if (payloadSlice.bits() == 459 && operationStatus == EverToTip3OperationStatus.SWAP && msg.value >= EverToTip3Gas.SWAP_TIP3_TO_EVER_MIN_VALUE) {
                (uint64 id, address pair, uint128 expectedAmount) = 
                payloadSlice.decode(uint64, address, uint128);    

                TvmBuilder successPayload;
                successPayload.store(EverToTip3OperationStatus.SUCCESS);
                successPayload.store(id);
                                
                TvmBuilder cancelPayload;
                cancelPayload.store(EverToTip3OperationStatus.CANCEL);
                cancelPayload.store(id);

                TvmBuilder resultPayload;
                resultPayload.store(DexOperationTypes.EXCHANGE);
                resultPayload.store(id);
                resultPayload.store(uint128(0));
                resultPayload.store(expectedAmount);
                
                resultPayload.storeRef(successPayload);
                resultPayload.storeRef(cancelPayload);

                ITokenWallet(msg.sender).transfer{value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: false}(
                    amount,
                    pair,
                    uint128(0),
                    user,
                    true,
                    resultPayload.toCell()
                );
            } else if (payloadSlice.bits() == 64) {
                if (operationStatus == EverToTip3OperationStatus.CANCEL) {
                    (uint64 id_) = payloadSlice.decode(uint64);
            
                    emit SwapTip3EverCancelTransfer(user, id_);    
                    IEverTip3SwapCallbacks(user).onSwapTip3ToEverCancel{value: 0, flag: MsgFlag.SENDER_PAYS_FEES, bounce: false}(id_);

                    TvmBuilder payloadID;
                    payloadID.store(id_);
                    TvmCell payloadID_ = payloadID.toCell();              

                    ITokenWallet(msg.sender).transfer{value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: false}(
                        amount,
                        user,
                        uint128(0),
                        user,
                        true,
                        payloadID_
                    );
                } else if (operationStatus == EverToTip3OperationStatus.SUCCESS && 
                          (msg.sender.value != 0 && msg.sender == weverWallet)) {
                    (uint64 id) = payloadSlice.decode(uint64);

                    TvmBuilder payloadID;
                    payloadID.store(id);
                    payloadID.store(amount);
                    TvmCell payloadID_ = payloadID.toCell();

                    ITokenWallet(weverWallet).transfer{ value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: false }(
                        amount,
                        weverVault,
                        uint128(0),
                        user,
                        true,
                        payloadID_
                    );
                } else {
                    needCancel = true;    
                }
            } else {
                needCancel = true;    
            }
        } else {
            needCancel = true;
        }            

        if (needCancel) {
            TvmCell emptyPayload;
            ITokenWallet(msg.sender).transfer{ value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: false }(
                amount,
                sender,
                uint128(0),
                user,
                true,
                emptyPayload                        
            );
        }
    }

    // Callback Burn token if result swap success
    function onAcceptTokensBurn(
        uint128 /*amount*/,
        address /*walletOwner*/,
        address /*wallet*/,
        address user,
        TvmCell payload
    ) override external {
        require(msg.sender.value != 0 && msg.sender == weverRoot, EverToTip3Errors.NOT_WEVER_ROOT);
        tvm.rawReserve(EverToTip3Gas.TARGET_BALANCE, 0);
       
        TvmSlice payloadSlice =  payload.toSlice();
        (uint64 id, uint128 amount) = payloadSlice.decode(uint64, uint128);

        emit SwapTip3EverSuccessTransfer(user, id);
        IEverTip3SwapCallbacks(user).onSwapTip3ToEverSuccess{ value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: false }(id, amount);
    }

}
