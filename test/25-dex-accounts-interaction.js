const {expect} = require('chai');
const {Migration, Constants, afterRun} = require(process.cwd() + '/scripts/utils');
const BigNumber = require('bignumber.js');
const { Command } = require('commander');
const program = new Command();
BigNumber.config({EXPONENTIAL_AT: 257});
const logger = require('mocha-logger');

let tx;

const logTx = (tx) => logger.success(`Transaction: ${tx.transaction.id}`);

const migration = new Migration();

program
    .allowUnknownOption()
    .option('-pcn, --pair_contract_name <pair_contract_name>', 'DexPair contract name')
    .option('-acn, --account_contract_name <account_contract_name>', 'DexAccount contract name');

program.parse(process.argv);

const options = program.opts();

options.pair_contract_name = options.pair_contract_name || 'DexPair';
options.account_contract_name = options.account_contract_name || 'DexAccount';

const TOKEN_CONTRACTS_PATH = 'node_modules/ton-eth-bridge-token-contracts/free-ton/build';

let DexRoot;
let DexPairFooBar;
let FooVaultWallet;
let BarVaultWallet;
let FooBarLpVaultWallet;
let FooRoot;
let BarRoot;
let FooBarLpRoot;
let Account2;
let Account3;
let DexAccount2;
let DexAccount3;
let FooWallet3;
let BarWallet3;
let FooBarLpWallet3;

const EMPTY_TVM_CELL = 'te6ccgEBAQEAAgAAAA==';

let IS_FOO_LEFT;

let keyPairs;

async function dexBalances() {
    const foo = await FooVaultWallet.call({method: 'balance', params: {}}).then(n => {
        return new BigNumber(n).shiftedBy(-Constants.tokens.foo.decimals).toString();
    });
    const bar = await BarVaultWallet.call({method: 'balance', params: {}}).then(n => {
        return new BigNumber(n).shiftedBy(-Constants.tokens.bar.decimals).toString();
    });
    const lp = await FooBarLpVaultWallet.call({method: 'balance', params: {}}).then(n => {
        return new BigNumber(n).shiftedBy(-Constants.LP_DECIMALS).toString();
    });
    return {foo, bar, lp};
}

async function account3balances() {
    let foo;
    await FooWallet3.call({method: 'balance', params: {}}).then(n => {
        foo = new BigNumber(n).shiftedBy(-Constants.tokens.foo.decimals).toString();
    }).catch(e => {/*ignored*/});
    let bar;
    await BarWallet3.call({method: 'balance', params: {}}).then(n => {
        bar = new BigNumber(n).shiftedBy(-Constants.tokens.bar.decimals).toString();
    }).catch(e => {/*ignored*/});
    let lp;
    await FooBarLpWallet3.call({method: 'balance', params: {}}).then(n => {
        lp = new BigNumber(n).shiftedBy(-Constants.LP_DECIMALS).toString();
    }).catch(e => {/*ignored*/});
    const ton = await locklift.utils.convertCrystal((await locklift.ton.getBalance(Account3.address)), 'ton').toNumber();
    return {foo, bar, lp, ton};
}

async function dexAccountBalances(account) {
    const foo = new BigNumber((await account.call({method: 'getWalletData', params: {
        token_root: FooRoot.address
    }})).balance).shiftedBy(-Constants.tokens.foo.decimals).toString();
    const bar = new BigNumber((await account.call({method: 'getWalletData', params: {
        token_root: BarRoot.address
    }})).balance).shiftedBy(-Constants.tokens.bar.decimals).toString();
    const lp = new BigNumber((await account.call({method: 'getWalletData', params: {
        token_root: FooBarLpRoot.address
    }})).balance).shiftedBy(-Constants.LP_DECIMALS).toString();

    return {foo, bar, lp};
}

async function logGas() {
    await migration.balancesCheckpoint();
    const diff = await migration.balancesLastDiff();
    if (diff) {
        logger.log(`### GAS STATS ###`);
        for (let alias in diff) {
            logger.log(`${alias}: ${diff[alias].gt(0) ? '+' : ''}${diff[alias].toFixed(9)} TON`);
        }
    }
}

describe('Check DEX accounts interaction', async function () {
    this.timeout(Constants.TESTS_TIMEOUT);
    before('Load contracts', async function () {
        keyPairs = await locklift.keys.getKeyPairs();

        DexRoot = await locklift.factory.getContract('DexRoot');
        DexPairFooBar = await locklift.factory.getContract(options.pair_contract_name);
        FooRoot = await locklift.factory.getContract('TokenRootUpgradeable', TOKEN_CONTRACTS_PATH);
        BarRoot = await locklift.factory.getContract('TokenRootUpgradeable', TOKEN_CONTRACTS_PATH);
        FooBarLpRoot = await locklift.factory.getContract('TokenRootUpgradeable', TOKEN_CONTRACTS_PATH);
        FooVaultWallet = await locklift.factory.getContract('TokenWalletUpgradeable', TOKEN_CONTRACTS_PATH);
        BarVaultWallet = await locklift.factory.getContract('TokenWalletUpgradeable', TOKEN_CONTRACTS_PATH);
        FooBarLpVaultWallet = await locklift.factory.getContract('TokenWalletUpgradeable', TOKEN_CONTRACTS_PATH);
        Account2 = await locklift.factory.getAccount('Wallet');
        Account2.afterRun = afterRun;
        Account3 = await locklift.factory.getAccount('Wallet');
        Account3.afterRun = afterRun;
        DexAccount2 = await locklift.factory.getContract(options.account_contract_name);
        DexAccount3 = await locklift.factory.getContract(options.account_contract_name);
        FooWallet3 = await locklift.factory.getContract('TokenWalletUpgradeable', TOKEN_CONTRACTS_PATH);
        BarWallet3 = await locklift.factory.getContract('TokenWalletUpgradeable', TOKEN_CONTRACTS_PATH);
        FooBarLpWallet3 = await locklift.factory.getContract('TokenWalletUpgradeable', TOKEN_CONTRACTS_PATH);

        migration.load(DexRoot, 'DexRoot');
        migration.load(DexPairFooBar, 'DexPairFooBar');
        migration.load(FooVaultWallet, 'FooVaultWallet');
        migration.load(BarVaultWallet, 'BarVaultWallet');
        migration.load(FooBarLpVaultWallet, 'FooBarLpVaultWallet');
        migration.load(FooRoot, 'FooRoot');
        migration.load(BarRoot, 'BarRoot');
        migration.load(FooBarLpRoot, 'FooBarLpRoot');
        migration.load(Account2, 'Account2');
        migration.load(Account3, 'Account3');
        migration.load(DexAccount2, 'DexAccount2');

        const pairRoots = DexPairFooBar.call({method: 'getTokenRoots', params: {}});
        IS_FOO_LEFT = pairRoots.left === FooRoot.address;


        if (migration.exists('BarWallet3')) {
            migration.load(BarWallet3, 'BarWallet3');
            logger.log(`BarWallet#3: ${BarWallet3.address}`);
        } else {
            const expected = await BarRoot.call({
                method: 'walletOf',
                params: {
                    walletOwner: Account3.address
                }
            });
            BarWallet3.setAddress(expected);
            migration.store(BarWallet3, 'BarWallet3');
            logger.log(`BarWallet#3: ${expected} (not deployed)`);
        }

        if (migration.exists('FooWallet3')) {
            migration.load(FooWallet3, 'FooWallet3');
            logger.log(`FooWallet#3: ${FooWallet3.address}`);
        } else {
            const expected = await FooRoot.call({
                method: 'walletOf',
                params: {
                    walletOwner: Account3.address
                }
            });
            FooWallet3.setAddress(expected);
            migration.store(FooWallet3, 'FooWallet3');
            logger.log(`FooWallet#3: ${expected} (not deployed)`);
        }

        if (migration.exists('FooBarLpWallet3')) {
            migration.load(FooBarLpWallet3, 'FooBarLpWallet3');
            logger.log(`FooBarLpWallet#3: ${FooBarLpWallet3.address}`);
        } else {
            const expected = await FooRoot.call({
                method: 'walletOf',
                params: {
                    walletOwner: Account3.address
                }
            });
            FooWallet3.setAddress(expected);
            migration.store(FooBarLpWallet3, 'FooBarLpWallet3');
            logger.log(`FooBarLpWallet#3: ${expected} (not deployed)`);
        }

        logger.log('DexRoot: ' + DexRoot.address);
        logger.log('DexPairFooBar: ' + DexPairFooBar.address);
        logger.log('FooVaultWallet: ' + FooVaultWallet.address);
        logger.log('BarVaultWallet: ' + BarVaultWallet.address);
        logger.log('FooBarLpVaultWallet: ' + FooBarLpVaultWallet.address);
        logger.log('FooRoot: ' + FooRoot.address);
        logger.log('BarRoot: ' + BarRoot.address);
        logger.log('FooBarLpRoot: ' + FooBarLpRoot.address);
        logger.log('Account#3: ' + Account3.address);
        logger.log('FooWallet#3: ' + FooWallet3.address);
        logger.log('BarWallet#3: ' + BarWallet3.address);
        logger.log('LpWallet#3: ' + FooBarLpWallet3.address);

        await migration.balancesCheckpoint();
    });

    describe('Create DexAccount#3', async function () {

        it('Account#3 deploy DexAccount#3 using DexRoot.deployAccount', async function () {
            logger.log('#################################################');
            logger.log('# Account#3 deploy DexAccount#3 using DexRoot.deployAccount');
            const accountStart = await account3balances();
            logger.log(`Account balance start: ${accountStart.foo} FOO, ${accountStart.bar} BAR, ` +
                `${accountStart.lp} LP, ${accountStart.ton} TON`);

            tx = await Account3.runTarget({
                contract: DexRoot,
                method: 'deployAccount',
                params: {
                    account_owner: Account3.address,
                    send_gas_to: Account3.address
                },
                value: locklift.utils.convertCrystal('4', 'nano'),
                keyPair: keyPairs[2]
            });

            logTx(tx);
            
            const dexAccount3 = await DexRoot.call({
                method: 'getExpectedAccountAddress',
                params: {
                    account_owner: Account3.address
                }
            });

            DexAccount3.setAddress(dexAccount3);
            migration.store(DexAccount3, 'DexAccount3');

            const accountEnd = await account3balances();
            logger.log(`Account balance end: ${accountEnd.foo} FOO, ${accountEnd.bar} BAR, ` +
                `${accountEnd.lp} LP, ${accountEnd.ton} TON`);
            await logGas();

            expect((await locklift.ton.getAccountType(DexAccount3.address)).acc_type)
                .to
                .equal(1, 'DexAccount3 Account not Active');
        });

    });

    describe('Internal DexAccount transfers', async function () {

        it('DexAccount#2 transfer FOO to DexAccount#3 (willing_to_deploy = false, must be bounced)', async function () {
            logger.log('#################################################');
            logger.log('# DexAccount#2 transfer FOO to DexAccount#3 (willing_to_deploy = false, must be bounced)');
            const dexAccount2Start = await dexAccountBalances(DexAccount2);
            const dexAccount3Start = await dexAccountBalances(DexAccount3);

            const AMOUNT_TO_TRANSFER = 10;

            logger.log(`DexAccount#2 balance start: ` +
                `${dexAccount2Start.foo} FOO, ${dexAccount2Start.bar} BAR, ${dexAccount2Start.lp} LP`);
            logger.log(`DexAccount#3 balance start: ` +
                `${dexAccount3Start.foo} FOO, ${dexAccount3Start.bar} BAR, ${dexAccount3Start.lp} LP`);

            tx = await Account2.runTarget({
                contract: DexAccount2,
                method: 'transfer',
                params: {
                    amount: new BigNumber(AMOUNT_TO_TRANSFER).shiftedBy(Constants.tokens.foo.decimals).toString(),
                    token_root: FooRoot.address,
                    to_dex_account: DexAccount3.address,
                    willing_to_deploy: false,
                    send_gas_to: Account2.address
                },
                value: locklift.utils.convertCrystal('1.1', 'nano'),
                keyPair: keyPairs[1]
            });

            logTx(tx);

            const dexAccount2End = await dexAccountBalances(DexAccount2);
            const dexAccount3End = await dexAccountBalances(DexAccount3);

            logger.log(`DexAccount#2 balance end: ` +
                `${dexAccount2End.foo} FOO, ${dexAccount2End.bar} BAR, ${dexAccount2End.lp} LP`);
            logger.log(`DexAccount#3 balance end: ` +
                `${dexAccount3End.foo} FOO, ${dexAccount3End.bar} BAR, ${dexAccount3End.lp} LP`);
            await logGas();

            expect(dexAccount2Start.foo).to.equal(dexAccount2End.foo, 'Wrong DexAccount#2 FOO balance');
            expect(dexAccount3Start.foo).to.equal(dexAccount3End.foo, 'Wrong DexAccount#3 FOO balance');
        });

        it('DexAccount#2 transfer BAR to DexAccount#3 (willing_to_deploy = true)', async function () {
            logger.log('#################################################');
            logger.log('# DexAccount#2 transfer BAR to DexAccount#3 (willing_to_deploy = true)');
            const dexAccount2Start = await dexAccountBalances(DexAccount2);
            const dexAccount3Start = await dexAccountBalances(DexAccount3);

            const AMOUNT_TO_TRANSFER = 10;

            logger.log(`DexAccount#2 balance start: ` +
                `${dexAccount2Start.foo} FOO, ${dexAccount2Start.bar} BAR, ${dexAccount2Start.lp} LP`);
            logger.log(`DexAccount#3 balance start: ` +
                `${dexAccount3Start.foo} FOO, ${dexAccount3Start.bar} BAR, ${dexAccount3Start.lp} LP`);

            tx = await Account2.runTarget({
                contract: DexAccount2,
                method: 'transfer',
                params: {
                    amount: new BigNumber(AMOUNT_TO_TRANSFER).shiftedBy(Constants.tokens.bar.decimals).toString(),
                    token_root: BarRoot.address,
                    to_dex_account: DexAccount3.address,
                    willing_to_deploy: true,
                    send_gas_to: Account2.address
                },
                value: locklift.utils.convertCrystal('1.1', 'nano'),
                keyPair: keyPairs[1]
            });

            logTx(tx);

            const dexAccount2End = await dexAccountBalances(DexAccount2);
            const dexAccount3End = await dexAccountBalances(DexAccount3);

            logger.log(`DexAccount#2 balance end: ` +
                `${dexAccount2End.foo} FOO, ${dexAccount2End.bar} BAR, ${dexAccount2End.lp} LP`);
            logger.log(`DexAccount#3 balance end: ` +
                `${dexAccount3End.foo} FOO, ${dexAccount3End.bar} BAR, ${dexAccount3End.lp} LP`);
            await logGas();

            const expectedDexAccount2Bar = new BigNumber(dexAccount2Start.bar)
                .minus(AMOUNT_TO_TRANSFER).toString();
            const expectedDexAccount3Bar = new BigNumber(dexAccount3Start.bar)
                .plus(AMOUNT_TO_TRANSFER).toString();

            expect(expectedDexAccount2Bar).to.equal(dexAccount2End.bar.toString(), 'Wrong DexAccount#2 BAR balance');
            expect(expectedDexAccount3Bar).to.equal(dexAccount3End.bar.toString(), 'Wrong DexAccount#3 BAR balance');
        });

        it('DexAccount#2 transfer BAR to DexAccount#3 (willing_to_deploy = false)', async function () {
            logger.log('#################################################');
            logger.log('# DexAccount#2 transfer BAR to DexAccount#3 (willing_to_deploy = false)');
            const dexAccount2Start = await dexAccountBalances(DexAccount2);
            const dexAccount3Start = await dexAccountBalances(DexAccount3);

            const AMOUNT_TO_TRANSFER = 10;

            logger.log(`DexAccount#2 balance start: ` +
                `${dexAccount2Start.foo} FOO, ${dexAccount2Start.bar} BAR, ${dexAccount2Start.lp} LP`);
            logger.log(`DexAccount#3 balance start: ` +
                `${dexAccount3Start.foo} FOO, ${dexAccount3Start.bar} BAR, ${dexAccount3Start.lp} LP`);

            tx = await Account2.runTarget({
                contract: DexAccount2,
                method: 'transfer',
                params: {
                    amount: new BigNumber(AMOUNT_TO_TRANSFER).shiftedBy(Constants.tokens.bar.decimals).toString(),
                    token_root: BarRoot.address,
                    to_dex_account: DexAccount3.address,
                    willing_to_deploy: false,
                    send_gas_to: Account2.address
                },
                value: locklift.utils.convertCrystal('1.1', 'nano'),
                keyPair: keyPairs[1]
            });

            logTx(tx);

            const dexAccount2End = await dexAccountBalances(DexAccount2);
            const dexAccount3End = await dexAccountBalances(DexAccount3);

            logger.log(`DexAccount#2 balance end: ` +
                `${dexAccount2End.foo} FOO, ${dexAccount2End.bar} BAR, ${dexAccount2End.lp} LP`);
            logger.log(`DexAccount#3 balance end: ` +
                `${dexAccount3End.foo} FOO, ${dexAccount3End.bar} BAR, ${dexAccount3End.lp} LP`);
            await logGas();

            const expectedDexAccount2Bar = new BigNumber(dexAccount2Start.bar)
                .minus(AMOUNT_TO_TRANSFER).toString();
            const expectedDexAccount3Bar = new BigNumber(dexAccount3Start.bar)
                .plus(AMOUNT_TO_TRANSFER).toString();

            expect(expectedDexAccount2Bar).to.equal(dexAccount2End.bar.toString(), 'Wrong DexAccount#2 BAR balance');
            expect(expectedDexAccount3Bar).to.equal(dexAccount3End.bar.toString(), 'Wrong DexAccount#3 BAR balance');
        });

        it('Account#3 transfer BAR to DexAccount#3', async function () {
            logger.log('#################################################');
            logger.log('# Account#3 transfer BAR to DexAccount#3');
            const dexAccount3Start = await dexAccountBalances(DexAccount3);
            const dexStart = await dexBalances();
            const accountStart = await account3balances();

            const TOKENS_TO_DEPOSIT = 10;

            logger.log(`DEX balance start: ${dexStart.foo} FOO, ${dexStart.bar} BAR, ${dexStart.lp} LP`);
            logger.log(`Account#3 balance start: ` +
                `${accountStart.foo !== undefined ? accountStart.foo + ' FOO' : 'FOO (not deployed)'}, ` +
                `${accountStart.bar !== undefined ? accountStart.bar + ' BAR' : 'BAR (not deployed)'}, ` +
                `${accountStart.lp !== undefined ? accountStart.lp + ' LP' : 'LP (not deployed)'}, ` +
                `${accountStart.ton} TON`);
            logger.log(`DexAccount#3 balance start: ` +
                `${dexAccount3Start.foo} FOO, ${dexAccount3Start.bar} BAR, ${dexAccount3Start.lp} LP`);

            tx = await Account3.runTarget({
                contract: BarWallet3,
                method: 'transferToRecipient',
                params: {
                    recipient_public_key: 0,
                    recipient_address: DexAccount3.address,
                    tokens: new BigNumber(TOKENS_TO_DEPOSIT).shiftedBy(Constants.tokens.bar.decimals).toString(),
                    deploy_grams: 0,
                    transfer_grams: 0,
                    send_gas_to: Account3.address,
                    notify_receiver: true,
                    payload: EMPTY_TVM_CELL
                },
                value: locklift.utils.convertCrystal('1.1', 'nano'),
                keyPair: keyPairs[2]
            });

            logTx(tx);

            const dexAccount3End = await dexAccountBalances(DexAccount3);
            const dexEnd = await dexBalances();
            const accountEnd = await account3balances();

            logger.log(`DEX balance end: ${dexEnd.foo} FOO, ${dexEnd.bar} BAR, ${dexEnd.lp} LP`);
            logger.log(`Account#3 balance end: ` +
                `${accountEnd.foo !== undefined ? accountEnd.foo + ' FOO' : 'FOO (not deployed)'}, ` +
                `${accountEnd.bar !== undefined ? accountEnd.bar + ' BAR' : 'BAR (not deployed)'}, ` +
                `${accountEnd.lp !== undefined ? accountEnd.lp + ' LP' : 'LP (not deployed)'}, ` +
                `${accountEnd.ton} TON`);
            logger.log(`DexAccount#3 balance end: ` +
                `${dexAccount3End.foo} FOO, ${dexAccount3End.bar} BAR, ${dexAccount3End.lp} LP`);
            await logGas();

            expect(new BigNumber(dexAccount3Start.bar).plus(TOKENS_TO_DEPOSIT).toString())
                .to.equal(dexAccount3End.bar, 'Wrong DexAccount#3 BAR balance');
            expect(new BigNumber(accountStart.bar).minus(TOKENS_TO_DEPOSIT).toString())
                .to.equal(accountEnd.bar, 'Wrong DexAccount#3 BAR balance');
            expect(new BigNumber(dexStart.bar).plus(TOKENS_TO_DEPOSIT).toString())
                .to.equal(dexEnd.bar, 'Wrong Dex BAR balance');
        });

    });

    describe('Dex Account withdraw', async function () {
        it('DexAccount#3 withdraw BAR', async function () {
            logger.log('#################################################');
            const dexAccount3 = await DexRoot.call({
                method: 'getExpectedAccountAddress',
                params: {
                    account_owner: Account3.address
                }
            });
            DexAccount3.setAddress(dexAccount3);
            const dexAccount3Start = await dexAccountBalances(DexAccount3);
            const TOKENS_TO_WITHDRAW = 10;
            logger.log(`DexAccount#3 balance start: ` +
                `${dexAccount3Start.foo} FOO, ${dexAccount3Start.bar} BAR, ${dexAccount3Start.lp} LP`);
            const account3WalletsStart = await account3balances();
            logger.log(`Account3 wallets balance start: ${account3WalletsStart.foo} FOO, ${account3WalletsStart.bar} BAR, ` +
                `${account3WalletsStart.lp} LP, ${account3WalletsStart.ton} TON`);

            tx = await Account3.runTarget({
                contract: DexAccount3,
                method: 'withdraw',
                params: {
                    amount: new BigNumber(TOKENS_TO_WITHDRAW).shiftedBy(Constants.tokens.bar.decimals).toString(),
                    token_root: BarRoot.address,
                    recipient_public_key: 0,
                    recipient_address: Account3.address,
                    deploy_wallet_grams: locklift.utils.convertCrystal('0.2', 'nano'),
                    send_gas_to: Account3.address
                },
                keyPair: keyPairs[2]
            });

            logTx(tx);
            
            const dexAccount3end = await dexAccountBalances(DexAccount3);
            logger.log(`DexAccount#3 balance end: ` +
                `${dexAccount3end.foo} FOO, ${dexAccount3end.bar} BAR, ${dexAccount3end.lp} LP`);
            const account3WalletsEnd = await account3balances();
            logger.log(`Account3 wallets balance end: ${account3WalletsEnd.foo} FOO, ${account3WalletsEnd.bar} BAR, ` +
                `${account3WalletsEnd.lp} LP, ${account3WalletsEnd.ton} TON`);
            expect(new BigNumber(dexAccount3Start.bar).minus(TOKENS_TO_WITHDRAW).toString())
                .to.equal(dexAccount3end.bar, 'Wrong DexAccount#3 BAR balance');
            expect(new BigNumber(account3WalletsStart.bar).plus(TOKENS_TO_WITHDRAW).toString())
                .to.equal(account3WalletsEnd.bar, 'Wrong Account#3 BAR Wallet balance');
        });
    });
});
