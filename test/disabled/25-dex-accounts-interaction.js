const {expect} = require('chai');
const {Migration} = require(process.cwd()+'/scripts/utils');
const BigNumber = require('bignumber.js');
BigNumber.config({EXPONENTIAL_AT: 257});
const logger = require('mocha-logger');

const migration = new Migration();

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


const FOO_DECIMALS = 3;
const BAR_DECIMALS = 9;
const LP_DECIMALS = 9;

const FOO_DECIMALS_MODIFIER = new BigNumber(10).pow(FOO_DECIMALS).toNumber();
const BAR_DECIMALS_MODIFIER = new BigNumber(10).pow(BAR_DECIMALS).toNumber();
const LP_DECIMALS_MODIFIER = new BigNumber(10).pow(LP_DECIMALS).toNumber();
const TON_DECIMALS_MODIFIER = new BigNumber(10).pow(9).toNumber();

const EMPTY_TVM_CELL = 'te6ccgEBAQEAAgAAAA==';

let IS_FOO_LEFT;

let keyPairs;

async function dexBalances() {
    const foo = await FooVaultWallet.call({method: 'balance', params: {_answer_id: 0}}).then(n => {
        return new BigNumber(n).div(FOO_DECIMALS_MODIFIER).toString();
    });
    const bar = await BarVaultWallet.call({method: 'balance', params: {_answer_id: 0}}).then(n => {
        return new BigNumber(n).div(BAR_DECIMALS_MODIFIER).toString();
    });
    const lp = await FooBarLpVaultWallet.call({method: 'balance', params: {_answer_id: 0}}).then(n => {
        return new BigNumber(n).div(LP_DECIMALS_MODIFIER).toString();
    });
    return {foo, bar, lp};
}

async function account3balances() {
    let foo;
    await FooWallet3.call({method: 'balance', params: {_answer_id: 0}}).then(n => {
        foo = new BigNumber(n).div(FOO_DECIMALS_MODIFIER).toString();
    });
    let bar;
    await BarWallet3.call({method: 'balance', params: {_answer_id: 0}}).then(n => {
        bar = new BigNumber(n).div(BAR_DECIMALS_MODIFIER).toString();
    });
    let lp;
    await FooBarLpWallet3.call({method: 'balance', params: {_answer_id: 0}}).then(n => {
        lp = new BigNumber(n).div(LP_DECIMALS_MODIFIER).toString();
    });
    const ton = await locklift.utils.convertCrystal((await locklift.ton.getBalance(Account3.address)), 'ton').toNumber();
    return {foo, bar, lp, ton};
}

async function dexAccountBalances(account) {
    const foo = new BigNumber((await account.call({method: 'getWalletData', params: {
        _answer_id: 0,
        token_root: FooRoot.address
    }})).balance).div(FOO_DECIMALS_MODIFIER).toString();
    const bar = new BigNumber((await account.call({method: 'getWalletData', params: {
        _answer_id: 0,
        token_root: BarRoot.address
    }})).balance).div(BAR_DECIMALS_MODIFIER).toString();
    const lp = new BigNumber((await account.call({method: 'getWalletData', params: {
        _answer_id: 0,
        token_root: FooBarLpRoot.address
    }})).balance).div(LP_DECIMALS_MODIFIER).toString();

    return {foo, bar, lp};
}

describe('Check direct DexPairFooBar operations', async function () {
    this.timeout(120000);
    before('Load contracts', async function () {
        keyPairs = await locklift.keys.getKeyPairs();

        DexRoot = await locklift.factory.getContract('DexRoot');
        DexPairFooBar = await locklift.factory.getContract('DexPair');
        FooRoot = await locklift.factory.getContract('RootTokenContract', TOKEN_CONTRACTS_PATH);
        BarRoot = await locklift.factory.getContract('RootTokenContract', TOKEN_CONTRACTS_PATH);
        FooBarLpRoot = await locklift.factory.getContract('RootTokenContract', TOKEN_CONTRACTS_PATH);
        FooVaultWallet = await locklift.factory.getContract('TONTokenWallet', TOKEN_CONTRACTS_PATH);
        BarVaultWallet = await locklift.factory.getContract('TONTokenWallet', TOKEN_CONTRACTS_PATH);
        FooBarLpVaultWallet = await locklift.factory.getContract('TONTokenWallet', TOKEN_CONTRACTS_PATH);
        Account2 = await locklift.factory.getAccount();
        Account3 = await locklift.factory.getAccount();
        DexAccount2 = await locklift.factory.getContract('DexAccount');
        DexAccount3 = await locklift.factory.getContract('DexAccount');
        FooWallet3 = await locklift.factory.getContract('TONTokenWallet', TOKEN_CONTRACTS_PATH);
        BarWallet3 = await locklift.factory.getContract('TONTokenWallet', TOKEN_CONTRACTS_PATH);
        FooBarLpWallet3 = await locklift.factory.getContract('TONTokenWallet', TOKEN_CONTRACTS_PATH);

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
        migration.load(FooWallet3, 'FooWallet3');
        migration.load(BarWallet3, 'BarWallet3');
        migration.load(FooBarLpWallet3, 'FooBarLpWallet3');

        const pairRoots = DexPairFooBar.call({method: 'getTokenRoots', params: {_answer_id: 0}});
        IS_FOO_LEFT = pairRoots.left === FooRoot.address;

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
    });

    describe('Create DexAccount#3', async function () {

        it('Account#3 deploy DexAccount#3 using DexRoot.deployAccount', async function () {
            const accountStart = await account3balances();
            logger.log(`Account balance start: ${accountStart.foo} FOO, ${accountStart.bar} BAR, ` +
                `${accountStart.lp} LP, ${accountStart.ton} TON`);

            await Account3.runTarget({
                contract: DexRoot,
                method: 'deployAccount',
                params: {
                    account_owner: Account3.address,
                    send_gas_to: Account3.address
                },
                value: locklift.utils.convertCrystal('1.1', 'nano'),
                keyPair: keyPairs[2]
            });

            const dexAccount3 = await DexRoot.call({
                method: 'getExpectedAccountAddress',
                params: {
                    account_owner: Account3.address,
                    _answer_id: 0
                }
            });

            DexAccount3.setAddress(dexAccount3);
            migration.store(DexAccount3, 'DexAccount3');

            const accountEnd = await account3balances();
            logger.log(`Account balance end: ${accountEnd.foo} FOO, ${accountEnd.bar} BAR, ` +
                `${accountEnd.lp} LP, ${accountEnd.ton} TON`);

            expect((await locklift.ton.getAccountType(DexAccount3.address)).acc_type)
                .to
                .equal(1, 'DexAccount3 Account not Active');
        });

    });

    describe('Internal DexAccount transfers', async function () {

        it('DexAccount#2 transfer FOO to DexAccount#3 (willing_to_deploy = false)', async function () {
            const dexAccount2Start = await dexAccountBalances(DexAccount2);
            const dexAccount3Start = await dexAccountBalances(DexAccount3);

            const AMOUNT_TO_TRANSFER = 10;

            logger.log(`DexAccount#2 balance start: ` +
                `${dexAccount2Start.foo} FOO, ${dexAccount2Start.bar} BAR, ${dexAccount2Start.lp} LP`);
            logger.log(`DexAccount#3 balance start: ` +
                `${dexAccount3Start.foo} FOO, ${dexAccount3Start.bar} BAR, ${dexAccount3Start.lp} LP`);

            await Account2.runTarget({
                contract: DexAccount2,
                method: 'transfer',
                params: {
                    amount: new BigNumber(AMOUNT_TO_TRANSFER).times(FOO_DECIMALS_MODIFIER).toString(),
                    token_root: FooRoot.address,
                    to_dex_account: DexAccount3.address,
                    willing_to_deploy: false,
                    send_gas_to: Account2.address
                },
                value: locklift.utils.convertCrystal('1.1', 'nano'),
                keyPair: keyPairs[2]
            });

            const dexAccount2End = await dexAccountBalances(DexAccount2);
            const dexAccount3End = await dexAccountBalances(DexAccount3);

            logger.log(`DexAccount#2 balance end: ` +
                `${dexAccount2End.foo} FOO, ${dexAccount2End.bar} BAR, ${dexAccount2End.lp} LP`);
            logger.log(`DexAccount#3 balance end: ` +
                `${dexAccount3End.foo} FOO, ${dexAccount3End.bar} BAR, ${dexAccount3End.lp} LP`);

            const expectedDexAccount2Foo = new BigNumber(dexAccount2Start.foo)
                .minus(AMOUNT_TO_TRANSFER).toString();
            const expectedDexAccount3Foo = new BigNumber(dexAccount2Start.foo)
                .plus(AMOUNT_TO_TRANSFER).toString();

            expect(expectedDexAccount2Foo).to.equal(dexAccount2End.foo.toString(), 'Wrong DexAccount#2 FOO balance');
            expect(expectedDexAccount3Foo).to.equal(dexAccount3End.foo.toString(), 'Wrong DexAccount#3 FOO balance');
        });

        it('DexAccount#2 transfer BAR to DexAccount#3 (willing_to_deploy = true)', async function () {
            const dexAccount2Start = await dexAccountBalances(DexAccount2);
            const dexAccount3Start = await dexAccountBalances(DexAccount3);

            const AMOUNT_TO_TRANSFER = 10;

            logger.log(`DexAccount#2 balance start: ` +
                `${dexAccount2Start.foo} FOO, ${dexAccount2Start.bar} BAR, ${dexAccount2Start.lp} LP`);
            logger.log(`DexAccount#3 balance start: ` +
                `${dexAccount3Start.foo} FOO, ${dexAccount3Start.bar} BAR, ${dexAccount3Start.lp} LP`);

            await Account2.runTarget({
                contract: DexAccount2,
                method: 'transfer',
                params: {
                    amount: new BigNumber(AMOUNT_TO_TRANSFER).times(BAR_DECIMALS_MODIFIER).toString(),
                    token_root: BarRoot.address,
                    to_dex_account: DexAccount3.address,
                    willing_to_deploy: true,
                    send_gas_to: Account2.address
                },
                value: locklift.utils.convertCrystal('1.1', 'nano'),
                keyPair: keyPairs[2]
            });

            const dexAccount2End = await dexAccountBalances(DexAccount2);
            const dexAccount3End = await dexAccountBalances(DexAccount3);

            logger.log(`DexAccount#2 balance end: ` +
                `${dexAccount2End.foo} FOO, ${dexAccount2End.bar} BAR, ${dexAccount2End.lp} LP`);
            logger.log(`DexAccount#3 balance end: ` +
                `${dexAccount3End.foo} FOO, ${dexAccount3End.bar} BAR, ${dexAccount3End.lp} LP`);

            const expectedDexAccount2Bar = new BigNumber(dexAccount2Start.bar)
                .minus(AMOUNT_TO_TRANSFER).toString();
            const expectedDexAccount3Bar = new BigNumber(dexAccount2Start.bar)
                .plus(AMOUNT_TO_TRANSFER).toString();

            expect(expectedDexAccount2Bar).to.equal(dexAccount2End.bar.toString(), 'Wrong DexAccount#2 BAR balance');
            expect(expectedDexAccount3Bar).to.equal(dexAccount3End.bar.toString(), 'Wrong DexAccount#3 BAR balance');
        });

        it('Account#3 transfer FOO to DexAccount#3 (must be bounced)', async function () {
            const dexAccount3Start = await dexAccountBalances(DexAccount3);
            const dexStart = await dexBalances();
            const accountStart = await account3balances();

            const TOKENS_TO_DEPOSIT = 10;

            logger.log(`DEX balance start: ${dexStart.foo} FOO, ${dexStart.bar} BAR, ${dexStart.lp} LP`);
            logger.log(`Account#3 balance start:` +
                `${accountStart.foo ? accountStart.foo + ' FOO' : '(not deployed)'}, ` +
                `${accountStart.bar ? accountStart.bar + ' BAR' : '(not deployed)'}, ` +
                `${accountStart.lp ? accountStart.lp + ' LP' : '(not deployed)'}, ${accountStart.ton} TON`);
            logger.log(`DexAccount#3 balance start: ` +
                `${dexAccount3Start.foo} FOO, ${dexAccount3Start.bar} BAR, ${dexAccount3Start.lp} LP`);

            await Account3.runTarget({
                contract: FooWallet3,
                method: 'transferToRecipient',
                params: {
                    recipient_public_key: 0,
                    recipient_address: DexAccount3.address,
                    tokens: new BigNumber(TOKENS_TO_DEPOSIT).times(FOO_DECIMALS_MODIFIER).toString(),
                    deploy_grams: 0,
                    transfer_grams: 0,
                    send_gas_to: Account3.address,
                    notify_receiver: true,
                    payload: EMPTY_TVM_CELL
                },
                value: locklift.utils.convertCrystal('1.1', 'nano'),
                keyPair: keyPairs[2]
            });

            const dexAccount3End = await dexAccountBalances(DexAccount3);
            const dexEnd = await dexBalances();
            const accountEnd = await account3balances();

            logger.log(`DEX balance end: ${dexStart.foo} FOO, ${dexStart.bar} BAR, ${dexStart.lp} LP`);
            logger.log(`Account#3 balance end:` +
                `${accountStart.foo ? accountStart.foo + ' FOO' : '(not deployed)'}, ` +
                `${accountStart.bar ? accountStart.bar + ' BAR' : '(not deployed)'}, ` +
                `${accountStart.lp ? accountStart.lp + ' LP' : '(not deployed)'}, ${accountStart.ton} TON`);
            logger.log(`DexAccount#3 balance end: ` +
                `${dexAccount3Start.foo} FOO, ${dexAccount3Start.bar} BAR, ${dexAccount3Start.lp} LP`);

            expect(dexAccount3Start.foo).to.equal(dexAccount3End.foo, 'Wrong DexAccount#3 FOO balance');
            expect(accountStart.foo).to.equal(accountEnd.foo, 'Wrong Account#3 FOO balance');
            expect(dexStart.foo).to.equal(dexEnd.foo, 'Wrong Dex FOO balance');
        });

        it('Account#3 transfer BAR to DexAccount#3', async function () {
            const dexAccount3Start = await dexAccountBalances(DexAccount3);
            const dexStart = await dexBalances();
            const accountStart = await account3balances();

            const TOKENS_TO_DEPOSIT = 10;

            logger.log(`DEX balance start: ${dexStart.foo} FOO, ${dexStart.bar} BAR, ${dexStart.lp} LP`);
            logger.log(`Account#3 balance start:` +
                `${accountStart.foo ? accountStart.foo + ' FOO' : '(not deployed)'}, ` +
                `${accountStart.bar ? accountStart.bar + ' BAR' : '(not deployed)'}, ` +
                `${accountStart.lp ? accountStart.lp + ' LP' : '(not deployed)'}, ${accountStart.ton} TON`);
            logger.log(`DexAccount#3 balance start: ` +
                `${dexAccount3Start.foo} FOO, ${dexAccount3Start.bar} BAR, ${dexAccount3Start.lp} LP`);

            await Account3.runTarget({
                contract: BarWallet3,
                method: 'transferToRecipient',
                params: {
                    recipient_public_key: 0,
                    recipient_address: DexAccount3.address,
                    tokens: new BigNumber(TOKENS_TO_DEPOSIT).times(BAR_DECIMALS_MODIFIER).toString(),
                    deploy_grams: 0,
                    transfer_grams: 0,
                    send_gas_to: Account3.address,
                    notify_receiver: true,
                    payload: EMPTY_TVM_CELL
                },
                value: locklift.utils.convertCrystal('1.1', 'nano'),
                keyPair: keyPairs[2]
            });

            const dexAccount3End = await dexAccountBalances(DexAccount3);
            const dexEnd = await dexBalances();
            const accountEnd = await account3balances();

            logger.log(`DEX balance end: ${dexStart.foo} FOO, ${dexStart.bar} BAR, ${dexStart.lp} LP`);
            logger.log(`Account#3 balance end:` +
                `${accountStart.foo ? accountStart.foo + ' FOO' : '(not deployed)'}, ` +
                `${accountStart.bar ? accountStart.bar + ' BAR' : '(not deployed)'}, ` +
                `${accountStart.lp ? accountStart.lp + ' LP' : '(not deployed)'}, ${accountStart.ton} TON`);
            logger.log(`DexAccount#3 balance end: ` +
                `${dexAccount3Start.foo} FOO, ${dexAccount3Start.bar} BAR, ${dexAccount3Start.lp} LP`);

            expect(new BigNumber(dexAccount3Start.bar).plus(TOKENS_TO_DEPOSIT).toString())
                .to.equal(dexAccount3End.bar, 'Wrong DexAccount#3 BAR balance');
            expect(new BigNumber(accountStart.bar).minus(TOKENS_TO_DEPOSIT).toString())
                .to.equal(accountEnd.bar, 'Wrong DexAccount#3 BAR balance');
            expect(new BigNumber(accountStart.bar).plus(TOKENS_TO_DEPOSIT).toString())
                .to.equal(dexEnd.bar, 'Wrong Dex BAR balance');
        });

    });
});
