const logger = require('mocha-logger');
const fs = require('fs');
const BigNumber = require('bignumber.js');
BigNumber.config({ EXPONENTIAL_AT: 257 });
const {Constants, Migration, afterRun, EMPTY_TVM_CELL,
    TOKEN_CONTRACTS_PATH, WEVER_CONTRACTS_PATH,
    stringToBytesArray, getRandomNonce} = require(process.cwd()+'/scripts/utils');
const { Command } = require('commander');
const program = new Command();

const logTx = (tx) => logger.success(`Transaction: ${tx.transaction.id}`);

let tx;

async function main() {
    const migration = new Migration();

    program
        .allowUnknownOption()
        .option('-wa, --wrap_amount <wrap_amount>', 'wrap amount');

    program.parse(process.argv);

    const options = program.opts();
    options.wrap_amount = options.wrap_amount || '60';

    const tokenData = Constants.tokens['wever'];


    logger.log(`Giver balance: ${locklift.utils.convertCrystal(await locklift.ton.getBalance(locklift.networkConfig.giver.address), 'ton')}`);

    const keyPairs = await locklift.keys.getKeyPairs();

    const Account2 = migration.load(await locklift.factory.getAccount('Wallet'), 'Account2');

    Account2.afterRun = afterRun;

    logger.success(`Owner: ${Account2.address}`);


    logger.log(`Deploying tunnel`);

    const Tunnel = await locklift.factory.getContract('TestWeverTunnel');

    const tunnel = await locklift.giver.deployContract({
        contract: Tunnel,
        constructorParams: {
            sources: [],
            destinations: [],
            owner_: Account2.address,
        },
        initParams: {
            _randomNonce: getRandomNonce(),
        },
        keyPair: keyPairs[0]
    }, locklift.utils.convertCrystal(5, 'nano'));

    logger.success(`Tunnel address: ${tunnel.address}`);

    logger.log(`Deploying WEVER`);

    const TokenRoot = await locklift.factory.getContract(
        'TokenRootUpgradeable',
        TOKEN_CONTRACTS_PATH
    );

    const TokenWallet = await locklift.factory.getContract(
        'TokenWalletUpgradeable',
        TOKEN_CONTRACTS_PATH
    );

    const TokenWalletPlatform = await locklift.factory.getContract(
        'TokenWalletPlatform',
        TOKEN_CONTRACTS_PATH
    );

    let root = await locklift.giver.deployContract({
        contract: TokenRoot,
        constructorParams: {
            initialSupplyTo: locklift.utils.zeroAddress,
            initialSupply: '0',
            deployWalletValue: '0',
            mintDisabled: false,
            burnByRootDisabled: false,
            burnPaused: false,
            remainingGasTo: locklift.utils.zeroAddress
        },
        initParams: {
            randomNonce_: getRandomNonce(),
            deployer_: locklift.utils.zeroAddress,
            name_: tokenData.name,
            symbol_: tokenData.symbol,
            decimals_: tokenData.decimals,
            walletCode_: TokenWallet.code,
            rootOwner_: tunnel.address,
            platformCode_: TokenWalletPlatform.code
        },
        keyPair: keyPairs[0]
    }, locklift.utils.convertCrystal('3', 'nano'));

    root.afterRun = afterRun;

    logger.success(`WEVER root: ${root.address}`);

    logger.log(`Deploying vault`);

    const WrappedTONVault = await locklift.factory.getContract('TestWeverVault');

    const vault = await locklift.giver.deployContract({
        contract: WrappedTONVault,
        constructorParams: {
            owner_: Account2.address,
            root_tunnel: tunnel.address,
            root: root.address,
            receive_safe_fee: locklift.utils.convertCrystal(1, 'nano'),
            settings_deploy_wallet_grams: locklift.utils.convertCrystal(0.1, 'nano'),
            initial_balance: locklift.utils.convertCrystal(1, 'nano')
        },
        initParams: {
            _randomNonce: getRandomNonce(),
        },
        keyPair: keyPairs[0]
    });

    logger.success(`Vault address: ${vault.address}`);

    logger.log(`Adding tunnel (vault, root)`);

    tx = await Account2.runTarget({
        contract: tunnel,
        method: '__updateTunnel',
        params: {
            source: vault.address,
            destination: root.address,
        },
        keyPair: keyPairs[1]
    });

    logTx(tx);

    logger.log(`Draining vault`);

    tx = await Account2.runTarget({
        contract: vault,
        method: 'drain',
        params: {
            receiver: Account2.address,
        },
        keyPair: keyPairs[1]
    });

    logTx(tx);

    logger.log(`Wrap ${options.wrap_amount} EVER`);

    tx = await Account2.run({
        method: 'sendTransaction',
        params: {
            dest: vault.address,
            value: locklift.utils.convertCrystal(options.wrap_amount, 'nano'),
            bounce: false,
            flags: 1,
            payload: EMPTY_TVM_CELL
        },
        keyPair: keyPairs[1]
    });

    logTx(tx);

    const tokenWalletAddress = await TokenRoot.call({
        method: 'walletOf', params: {
            walletOwner: Account2.address
        }
    });

    TokenWallet.setAddress(tokenWalletAddress);

    const balance = new BigNumber(await TokenWallet.call({method: 'balance', params: {}})).shiftedBy(-9).toString();
    logger.log(`Account2 WEVER balance: ${balance}`);

    migration.store(TokenWallet, tokenData.symbol + 'Wallet2');
    migration.store(TokenRoot, `${tokenData.symbol}Root`);
    migration.store(vault, `${tokenData.symbol}Vault`);
    migration.store(tunnel.address, `${tokenData.symbol}Tunnel`);

    logger.log(`Giver balance: ${locklift.utils.convertCrystal(await locklift.ton.getBalance(locklift.networkConfig.giver.address), 'ton')}`);
}


main()
    .then(() => process.exit(0))
    .catch(e => {
        console.log(e);
        process.exit(1);
    });
