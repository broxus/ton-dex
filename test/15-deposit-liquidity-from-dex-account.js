const {expect} = require('chai');
const {Migration} = require(process.cwd()+'/scripts/utils');
const BigNumber = require('bignumber.js');
BigNumber.config({EXPONENTIAL_AT: 257});
const logger = require('mocha-logger');

const migration = new Migration();

const TOKEN_CONTRACTS_PATH = 'node_modules/ton-eth-bridge-token-contracts/free-ton/build';

let DexRoot;
let DexPairFooBar;
let FooRoot;
let BarRoot;
let FooBarLpRoot;
let Account2;
let DexAccount2;

const FOO_DECIMALS = 3;
const BAR_DECIMALS = 18;
const LP_DECIMALS = 9;

const FOO_DECIMALS_MODIFIER = new BigNumber(10).pow(FOO_DECIMALS).toNumber();
const BAR_DECIMALS_MODIFIER = new BigNumber(10).pow(BAR_DECIMALS).toNumber();
const LP_DECIMALS_MODIFIER = new BigNumber(10).pow(LP_DECIMALS).toNumber();
const TON_DECIMALS_MODIFIER = new BigNumber(10).pow(9).toNumber();

const EMPTY_TVM_CELL = 'te6ccgEBAQEAAgAAAA==';

let IS_FOO_LEFT;

let keyPairs;

function logExpectedDeposit(expected) {

    const left_decimals = IS_FOO_LEFT ? FOO_DECIMALS_MODIFIER : BAR_DECIMALS_MODIFIER;
    const right_decimals = IS_FOO_LEFT ? BAR_DECIMALS_MODIFIER : FOO_DECIMALS_MODIFIER;

    logger.log(`Expected result: `);
    if (expected.step_1_lp_reward.isZero()) {
        logger.log(`    Step 1: skipped`);
    } else {
        logger.log(`    Step 1: `);
        logger.log(`        Left deposit = ${expected.step_1_left_deposit.div(left_decimals).toString()}`);
        logger.log(`        Right deposit = ${expected.step_1_right_deposit.div(right_decimals).toString()}`);
        logger.log(`        LP reward = ${expected.step_1_lp_reward.div(TON_DECIMALS_MODIFIER).toString()}`);
    }
    if (expected.step_2_left_to_right) {
        logger.log(`    Step 2: `);
        logger.log(`        Left amount for change = ${expected.step_2_spent.div(left_decimals).toString()}`);
        logger.log(`        Left fee = ${expected.step_2_fee.div(left_decimals).toString()}`);
        logger.log(`        Right received amount = ${expected.step_2_received.div(right_decimals).toString()}`);
    } else if (expected.step_2_right_to_left) {
        logger.log(`    Step 2: `);
        logger.log(`        Right amount for change = ${expected.step_2_spent.div(right_decimals).toString()}`);
        logger.log(`        Right fee = ${expected.step_2_fee.div(right_decimals).toString()}`);
        logger.log(`        Left received amount = ${expected.step_2_received.div(left_decimals).toString()}`);
    } else {
        logger.log(`    Step 2: skipped`);
    }
    if (expected.step_3_lp_reward.isZero()) {
        logger.log(`    Step 3: skipped`);
    } else {
        logger.log(`    Step 3: `);
        logger.log(`        Left deposit = ${expected.step_3_left_deposit.div(left_decimals).toString()}`);
        logger.log(`        Right deposit = ${expected.step_3_right_deposit.div(right_decimals).toString()}`);
        logger.log(`        LP reward = ${expected.step_3_lp_reward.div(TON_DECIMALS_MODIFIER).toString()}`);
    }
    logger.log(`    TOTAL: `);
    logger.log(`        LP reward = ${expected.step_1_lp_reward.plus(expected.step_3_lp_reward).div(TON_DECIMALS_MODIFIER).toString()}`);
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
async function dexPairInfo() {
    const balances = await DexPairFooBar.call({method: 'getBalances', params: { _answer_id: 0 }});
    const total_supply = await FooBarLpRoot.call({method: 'total_supply', params: {}});
    let foo, bar;
    if (IS_FOO_LEFT) {
        foo = new BigNumber(balances.left_balance).div(FOO_DECIMALS_MODIFIER).toString();
        bar = new BigNumber(balances.right_balance).div(BAR_DECIMALS_MODIFIER).toString();
    } else {
        foo = new BigNumber(balances.right_balance).div(FOO_DECIMALS_MODIFIER).toString();
        bar = new BigNumber(balances.left_balance).div(BAR_DECIMALS_MODIFIER).toString();
    }

    return {
        foo: foo,
        bar: bar,
        lp_supply: new BigNumber(balances.lp_supply).div(LP_DECIMALS_MODIFIER).toString(),
        lp_supply_actual: new BigNumber(total_supply).div(LP_DECIMALS_MODIFIER).toString()
    };
}

describe('Deposit liquidity', async function () {
    before('Load contracts', async function () {
        keyPairs = await locklift.keys.getKeyPairs();

        DexRoot = await locklift.factory.getContract('DexRoot');
        DexPairFooBar = await locklift.factory.getContract('DexPair');
        FooRoot = await locklift.factory.getContract('RootTokenContract', TOKEN_CONTRACTS_PATH);
        BarRoot = await locklift.factory.getContract('RootTokenContract', TOKEN_CONTRACTS_PATH);
        FooBarLpRoot = await locklift.factory.getContract('RootTokenContract', TOKEN_CONTRACTS_PATH);
        Account2 = await locklift.factory.getAccount();
        DexAccount2 = await locklift.factory.getContract('DexAccount');

        migration.load(DexRoot, 'DexRoot');
        migration.load(DexPairFooBar, 'DexPairFooBar');
        migration.load(FooRoot, 'FooRoot');
        migration.load(BarRoot, 'BarRoot');
        migration.load(FooBarLpRoot, 'FooBarLpRoot');
        migration.load(Account2, 'Account2');
        migration.load(DexAccount2, 'DexAccount2');

        const pairRoots = DexPairFooBar.call({method: 'getTokenRoots', params: {_answer_id: 0}});
        IS_FOO_LEFT = pairRoots.left === FooRoot.address;

        logger.log('DexRoot: ' + DexRoot.address);
        logger.log('DexPairFooBar: ' + DexPairFooBar.address);
        logger.log('FooRoot: ' + FooRoot.address);
        logger.log('BarRoot: ' + BarRoot.address);
        logger.log('FooBarLpRoot: ' + FooBarLpRoot.address);
        logger.log('Account#2: ' + Account2.address);
        logger.log('DexAccount#2: ' + DexAccount2.address);
    });

    describe('Deposits', async function () {

        it('Add initial liquidity to Foo/Bar', async function () {
            const dexAccount2Start = await dexAccountBalances(DexAccount2);
            const dexPairInfoStart = await dexPairInfo();

            logger.log(`DexAccount#2 balance start: ` +
                `${dexAccount2Start.foo} FOO, ${dexAccount2Start.bar} BAR, ${dexAccount2Start.lp} LP`);
            logger.log(`DexPair start: ` +
                `${dexPairInfoStart.foo} FOO, ${dexAccount2Start.bar} BAR, ` +
                `LP SUPPLY (PLAN): ${dexAccount2Start.lp_supply} LP, `  +
                `LP SUPPLY (ACTUAL): ${dexAccount2Start.lp_supply_actual} LP`);

            const FOO_DEPOSIT = 5000;
            const BAR_DEPOSIT = 6000;

            const LEFT_AMOUNT = IS_FOO_LEFT ?
                new BigNumber(FOO_DEPOSIT).times(FOO_DECIMALS_MODIFIER).toString():
                new BigNumber(BAR_DEPOSIT).times(BAR_DECIMALS_MODIFIER).toString();

            const RIGHT_AMOUNT = IS_FOO_LEFT ?
                new BigNumber(BAR_DEPOSIT).times(BAR_DECIMALS_MODIFIER).toString():
                new BigNumber(FOO_DEPOSIT).times(FOO_DECIMALS_MODIFIER).toString();

            const expected = await DexPairFooBar.call('expectedDepositLiquidity', {
                left_amount: LEFT_AMOUNT,
                right_amount: RIGHT_AMOUNT,
                auto_change: false
            });

            const LP_REWARD = new BigNumber(expected.step_1_lp_reward).plus(expected.step_3_lp_reward).div(TON_DECIMALS_MODIFIER).toString();

            logExpectedDeposit(expected);

            await Account2.runTarget({
                contract: DexAccount2,
                method: 'depositLiquidity',
                params: {
                    left_root: IS_FOO_LEFT ? FooRoot.address : BarRoot.address,
                    left_amount: LEFT_AMOUNT,
                    right_root: IS_FOO_LEFT ? BarRoot.address : FooRoot.address,
                    right_amount: RIGHT_AMOUNT,
                    expected_lp_root: FooBarLpRoot.address,
                    auto_change: false,
                    send_gas_to: DexAccount2.address
                },
                value: locklift.utils.convertCrystal('1.1', 'nano'),
                keyPair: keyPairs[1]
            });

            const dexAccount2End = await dexAccountBalances(DexAccount2);
            const dexPairInfoEnd = await dexPairInfo();

            logger.log(`DexAccount#2 balance end: ` +
                `${dexAccount2End.foo} FOO, ${dexAccount2End.bar} BAR, ${dexAccount2End.lp} LP`);
            logger.log(`DexPair end: ` +
                `${dexPairInfoEnd.foo} FOO, ${dexPairInfoEnd.bar} BAR, ` +
                `LP SUPPLY (PLAN): ${dexPairInfoEnd.lp_supply} LP, `  +
                `LP SUPPLY (ACTUAL): ${dexPairInfoEnd.lp_supply_actual} LP`);

            const expectedAccount2Foo = new BigNumber(dexAccount2Start.foo).minus(FOO_DEPOSIT).toString();
            const expectedAccount2Bar = new BigNumber(dexAccount2Start.bar).minus(BAR_DEPOSIT).toString();
            const expectedAccount2Lp = new BigNumber(dexAccount2Start.lp).plus(LP_REWARD).toString();
            const expectedPairFoo = new BigNumber(dexPairInfoStart.foo).plus(FOO_DEPOSIT).toString();
            const expectedPairBar = new BigNumber(dexPairInfoStart.bar).plus(BAR_DEPOSIT).toString();
            const expectedPairLp = new BigNumber(dexPairInfoStart.lp_supply).plus(LP_REWARD).toString();

            expect(dexPairInfoEnd.lp_supply_actual).to.equal(dexPairInfoEnd.lp_supply, 'Wrong LP supply');
            expect(expectedAccount2Foo).to.equal(dexAccount2End.foo, 'Wrong DexAccount#2 FOO');
            expect(expectedAccount2Bar).to.equal(dexAccount2End.bar, 'Wrong DexAccount#2 BAR');
            expect(expectedAccount2Lp).to.equal(dexAccount2End.lp, 'Wrong DexAccount#2 LP');
            expect(expectedPairFoo).to.equal(dexPairInfoEnd.foo, 'Wrong DexPair FOO');
            expect(expectedPairBar).to.equal(dexPairInfoEnd.bar, 'Wrong DexPair BAR');
            expect(expectedPairLp).to.equal(dexPairInfoEnd.lp_supply, 'Wrong DexPair LP supply');
        });

        it('Add FOO liquidity (auto_change=true)', async function () {
            const dexAccount2Start = await dexAccountBalances(DexAccount2);
            const dexPairInfoStart = await dexPairInfo();

            logger.log(`DexAccount#2 balance start: ` +
                `${dexAccount2Start.foo} FOO, ${dexAccount2Start.bar} BAR, ${dexAccount2Start.lp} LP`);
            logger.log(`DexPair start: ` +
                `${dexPairInfoStart.foo} FOO, ${dexAccount2Start.bar} BAR, ` +
                `LP SUPPLY (PLAN): ${dexAccount2Start.lp_supply} LP, `  +
                `LP SUPPLY (ACTUAL): ${dexAccount2Start.lp_supply_actual} LP`);

            const FOO_DEPOSIT = 1000;
            const BAR_DEPOSIT = 0;

            const LEFT_AMOUNT = IS_FOO_LEFT ?
                new BigNumber(FOO_DEPOSIT).times(FOO_DECIMALS_MODIFIER).toString():
                new BigNumber(BAR_DEPOSIT).times(BAR_DECIMALS_MODIFIER).toString();

            const RIGHT_AMOUNT = IS_FOO_LEFT ?
                new BigNumber(BAR_DEPOSIT).times(BAR_DECIMALS_MODIFIER).toString():
                new BigNumber(FOO_DEPOSIT).times(FOO_DECIMALS_MODIFIER).toString();

            const expected = await DexPairFooBar.call('expectedDepositLiquidity', {
                left_amount: LEFT_AMOUNT,
                right_amount: RIGHT_AMOUNT,
                auto_change: true
            });

            const LP_REWARD = new BigNumber(expected.step_1_lp_reward).plus(expected.step_3_lp_reward).div(TON_DECIMALS_MODIFIER).toString();

            logExpectedDeposit(expected);

            await Account2.runTarget({
                contract: DexAccount2,
                method: 'depositLiquidity',
                params: {
                    left_root: IS_FOO_LEFT ? FooRoot.address : BarRoot.address,
                    left_amount: LEFT_AMOUNT,
                    right_root: IS_FOO_LEFT ? BarRoot.address : FooRoot.address,
                    right_amount: RIGHT_AMOUNT,
                    expected_lp_root: FooBarLpRoot.address,
                    auto_change: true,
                    send_gas_to: DexAccount2.address
                },
                value: locklift.utils.convertCrystal('1.1', 'nano'),
                keyPair: keyPairs[1]
            });

            const dexAccount2End = await dexAccountBalances(DexAccount2);
            const dexPairInfoEnd = await dexPairInfo();

            logger.log(`DexAccount#2 balance end: ` +
                `${dexAccount2End.foo} FOO, ${dexAccount2End.bar} BAR, ${dexAccount2End.lp} LP`);
            logger.log(`DexPair end: ` +
                `${dexPairInfoEnd.foo} FOO, ${dexPairInfoEnd.bar} BAR, ` +
                `LP SUPPLY (PLAN): ${dexPairInfoEnd.lp_supply} LP, `  +
                `LP SUPPLY (ACTUAL): ${dexPairInfoEnd.lp_supply_actual} LP`);

            const expectedAccount2Foo = new BigNumber(dexAccount2Start.foo).minus(FOO_DEPOSIT).toString();
            const expectedAccount2Bar = new BigNumber(dexAccount2Start.bar).minus(BAR_DEPOSIT).toString();
            const expectedAccount2Lp = new BigNumber(dexAccount2Start.lp).plus(LP_REWARD).toString();
            const expectedPairFoo = new BigNumber(dexPairInfoStart.foo).plus(FOO_DEPOSIT).toString();
            const expectedPairBar = new BigNumber(dexPairInfoStart.bar).plus(BAR_DEPOSIT).toString();
            const expectedPairLp = new BigNumber(dexPairInfoStart.lp_supply).plus(LP_REWARD).toString();

            expect(dexPairInfoEnd.lp_supply_actual).to.equal(dexPairInfoEnd.lp_supply, 'Wrong LP supply');
            expect(expectedAccount2Foo).to.equal(dexAccount2End.foo, 'Wrong DexAccount#2 FOO');
            expect(expectedAccount2Bar).to.equal(dexAccount2End.bar, 'Wrong DexAccount#2 BAR');
            expect(expectedAccount2Lp).to.equal(dexAccount2End.lp, 'Wrong DexAccount#2 LP');
            expect(expectedPairFoo).to.equal(dexPairInfoEnd.foo, 'Wrong DexPair FOO');
            expect(expectedPairBar).to.equal(dexPairInfoEnd.bar, 'Wrong DexPair BAR');
            expect(expectedPairLp).to.equal(dexPairInfoEnd.lp_supply, 'Wrong DexPair LP supply');
        });

        it('Add BAR liquidity (auto_change=true)', async function () {
            const dexAccount2Start = await dexAccountBalances(DexAccount2);
            const dexPairInfoStart = await dexPairInfo();

            logger.log(`DexAccount#2 balance start: ` +
                `${dexAccount2Start.foo} FOO, ${dexAccount2Start.bar} BAR, ${dexAccount2Start.lp} LP`);
            logger.log(`DexPair start: ` +
                `${dexPairInfoStart.foo} FOO, ${dexAccount2Start.bar} BAR, ` +
                `LP SUPPLY (PLAN): ${dexAccount2Start.lp_supply} LP, `  +
                `LP SUPPLY (ACTUAL): ${dexAccount2Start.lp_supply_actual} LP`);

            const FOO_DEPOSIT = 0;
            const BAR_DEPOSIT = 1000;

            const LEFT_AMOUNT = IS_FOO_LEFT ?
                new BigNumber(FOO_DEPOSIT).times(FOO_DECIMALS_MODIFIER).toString():
                new BigNumber(BAR_DEPOSIT).times(BAR_DECIMALS_MODIFIER).toString();

            const RIGHT_AMOUNT = IS_FOO_LEFT ?
                new BigNumber(BAR_DEPOSIT).times(BAR_DECIMALS_MODIFIER).toString():
                new BigNumber(FOO_DEPOSIT).times(FOO_DECIMALS_MODIFIER).toString();

            const expected = await DexPairFooBar.call('expectedDepositLiquidity', {
                left_amount: LEFT_AMOUNT,
                right_amount: RIGHT_AMOUNT,
                auto_change: true
            });

            const LP_REWARD = new BigNumber(expected.step_1_lp_reward).plus(expected.step_3_lp_reward).div(TON_DECIMALS_MODIFIER).toString();

            logExpectedDeposit(expected);

            await Account2.runTarget({
                contract: DexAccount2,
                method: 'depositLiquidity',
                params: {
                    left_root: IS_FOO_LEFT ? FooRoot.address : BarRoot.address,
                    left_amount: LEFT_AMOUNT,
                    right_root: IS_FOO_LEFT ? BarRoot.address : FooRoot.address,
                    right_amount: RIGHT_AMOUNT,
                    expected_lp_root: FooBarLpRoot.address,
                    auto_change: true,
                    send_gas_to: DexAccount2.address
                },
                value: locklift.utils.convertCrystal('1.1', 'nano'),
                keyPair: keyPairs[1]
            });

            const dexAccount2End = await dexAccountBalances(DexAccount2);
            const dexPairInfoEnd = await dexPairInfo();

            logger.log(`DexAccount#2 balance end: ` +
                `${dexAccount2End.foo} FOO, ${dexAccount2End.bar} BAR, ${dexAccount2End.lp} LP`);
            logger.log(`DexPair end: ` +
                `${dexPairInfoEnd.foo} FOO, ${dexPairInfoEnd.bar} BAR, ` +
                `LP SUPPLY (PLAN): ${dexPairInfoEnd.lp_supply} LP, `  +
                `LP SUPPLY (ACTUAL): ${dexPairInfoEnd.lp_supply_actual} LP`);

            const expectedAccount2Foo = new BigNumber(dexAccount2Start.foo).minus(FOO_DEPOSIT).toString();
            const expectedAccount2Bar = new BigNumber(dexAccount2Start.bar).minus(BAR_DEPOSIT).toString();
            const expectedAccount2Lp = new BigNumber(dexAccount2Start.lp).plus(LP_REWARD).toString();
            const expectedPairFoo = new BigNumber(dexPairInfoStart.foo).plus(FOO_DEPOSIT).toString();
            const expectedPairBar = new BigNumber(dexPairInfoStart.bar).plus(BAR_DEPOSIT).toString();
            const expectedPairLp = new BigNumber(dexPairInfoStart.lp_supply).plus(LP_REWARD).toString();

            expect(dexPairInfoEnd.lp_supply_actual).to.equal(dexPairInfoEnd.lp_supply, 'Wrong LP supply');
            expect(expectedAccount2Foo).to.equal(dexAccount2End.foo, 'Wrong DexAccount#2 FOO');
            expect(expectedAccount2Bar).to.equal(dexAccount2End.bar, 'Wrong DexAccount#2 BAR');
            expect(expectedAccount2Lp).to.equal(dexAccount2End.lp, 'Wrong DexAccount#2 LP');
            expect(expectedPairFoo).to.equal(dexPairInfoEnd.foo, 'Wrong DexPair FOO');
            expect(expectedPairBar).to.equal(dexPairInfoEnd.bar, 'Wrong DexPair BAR');
            expect(expectedPairLp).to.equal(dexPairInfoEnd.lp_supply, 'Wrong DexPair LP supply');
        });

        it('Add FOO+BAR liquidity (auto_change=true)', async function () {
            const dexAccount2Start = await dexAccountBalances(DexAccount2);
            const dexPairInfoStart = await dexPairInfo();

            logger.log(`DexAccount#2 balance start: ` +
                `${dexAccount2Start.foo} FOO, ${dexAccount2Start.bar} BAR, ${dexAccount2Start.lp} LP`);
            logger.log(`DexPair start: ` +
                `${dexPairInfoStart.foo} FOO, ${dexAccount2Start.bar} BAR, ` +
                `LP SUPPLY (PLAN): ${dexAccount2Start.lp_supply} LP, `  +
                `LP SUPPLY (ACTUAL): ${dexAccount2Start.lp_supply_actual} LP`);

            const FOO_DEPOSIT = 500;
            const BAR_DEPOSIT = 200;

            const LEFT_AMOUNT = IS_FOO_LEFT ?
                new BigNumber(FOO_DEPOSIT).times(FOO_DECIMALS_MODIFIER).toString():
                new BigNumber(BAR_DEPOSIT).times(BAR_DECIMALS_MODIFIER).toString();

            const RIGHT_AMOUNT = IS_FOO_LEFT ?
                new BigNumber(BAR_DEPOSIT).times(BAR_DECIMALS_MODIFIER).toString():
                new BigNumber(FOO_DEPOSIT).times(FOO_DECIMALS_MODIFIER).toString();

            const expected = await DexPairFooBar.call('expectedDepositLiquidity', {
                left_amount: LEFT_AMOUNT,
                right_amount: RIGHT_AMOUNT,
                auto_change: true
            });

            const LP_REWARD = new BigNumber(expected.step_1_lp_reward).plus(expected.step_3_lp_reward).div(TON_DECIMALS_MODIFIER).toString();

            logExpectedDeposit(expected);

            await Account2.runTarget({
                contract: DexAccount2,
                method: 'depositLiquidity',
                params: {
                    left_root: IS_FOO_LEFT ? FooRoot.address : BarRoot.address,
                    left_amount: LEFT_AMOUNT,
                    right_root: IS_FOO_LEFT ? BarRoot.address : FooRoot.address,
                    right_amount: RIGHT_AMOUNT,
                    expected_lp_root: FooBarLpRoot.address,
                    auto_change: true,
                    send_gas_to: DexAccount2.address
                },
                value: locklift.utils.convertCrystal('1.1', 'nano'),
                keyPair: keyPairs[1]
            });

            const dexAccount2End = await dexAccountBalances(DexAccount2);
            const dexPairInfoEnd = await dexPairInfo();

            logger.log(`DexAccount#2 balance end: ` +
                `${dexAccount2End.foo} FOO, ${dexAccount2End.bar} BAR, ${dexAccount2End.lp} LP`);
            logger.log(`DexPair end: ` +
                `${dexPairInfoEnd.foo} FOO, ${dexPairInfoEnd.bar} BAR, ` +
                `LP SUPPLY (PLAN): ${dexPairInfoEnd.lp_supply} LP, `  +
                `LP SUPPLY (ACTUAL): ${dexPairInfoEnd.lp_supply_actual} LP`);

            const expectedAccount2Foo = new BigNumber(dexAccount2Start.foo).minus(FOO_DEPOSIT).toString();
            const expectedAccount2Bar = new BigNumber(dexAccount2Start.bar).minus(BAR_DEPOSIT).toString();
            const expectedAccount2Lp = new BigNumber(dexAccount2Start.lp).plus(LP_REWARD).toString();
            const expectedPairFoo = new BigNumber(dexPairInfoStart.foo).plus(FOO_DEPOSIT).toString();
            const expectedPairBar = new BigNumber(dexPairInfoStart.bar).plus(BAR_DEPOSIT).toString();
            const expectedPairLp = new BigNumber(dexPairInfoStart.lp_supply).plus(LP_REWARD).toString();

            expect(dexPairInfoEnd.lp_supply_actual).to.equal(dexPairInfoEnd.lp_supply, 'Wrong LP supply');
            expect(expectedAccount2Foo).to.equal(dexAccount2End.foo, 'Wrong DexAccount#2 FOO');
            expect(expectedAccount2Bar).to.equal(dexAccount2End.bar, 'Wrong DexAccount#2 BAR');
            expect(expectedAccount2Lp).to.equal(dexAccount2End.lp, 'Wrong DexAccount#2 LP');
            expect(expectedPairFoo).to.equal(dexPairInfoEnd.foo, 'Wrong DexPair FOO');
            expect(expectedPairBar).to.equal(dexPairInfoEnd.bar, 'Wrong DexPair BAR');
            expect(expectedPairLp).to.equal(dexPairInfoEnd.lp_supply, 'Wrong DexPair LP supply');
        });

        it('Add FOO+BAR liquidity (auto_change=false), surplus BAR must returns', async function () {
            const dexAccount2Start = await dexAccountBalances(DexAccount2);
            const dexPairInfoStart = await dexPairInfo();

            logger.log(`DexAccount#2 balance start: ` +
                `${dexAccount2Start.foo} FOO, ${dexAccount2Start.bar} BAR, ${dexAccount2Start.lp} LP`);
            logger.log(`DexPair start: ` +
                `${dexPairInfoStart.foo} FOO, ${dexAccount2Start.bar} BAR, ` +
                `LP SUPPLY (PLAN): ${dexAccount2Start.lp_supply} LP, `  +
                `LP SUPPLY (ACTUAL): ${dexAccount2Start.lp_supply_actual} LP`);

            const FOO_DEPOSIT = 100;
            const BAR_DEPOSIT = 1000;

            const LEFT_AMOUNT = IS_FOO_LEFT ?
                new BigNumber(FOO_DEPOSIT).times(FOO_DECIMALS_MODIFIER).toString():
                new BigNumber(BAR_DEPOSIT).times(BAR_DECIMALS_MODIFIER).toString();

            const RIGHT_AMOUNT = IS_FOO_LEFT ?
                new BigNumber(BAR_DEPOSIT).times(BAR_DECIMALS_MODIFIER).toString():
                new BigNumber(FOO_DEPOSIT).times(FOO_DECIMALS_MODIFIER).toString();

            const expected = await DexPairFooBar.call('expectedDepositLiquidity', {
                left_amount: LEFT_AMOUNT,
                right_amount: RIGHT_AMOUNT,
                auto_change: false
            });

            const LP_REWARD = new BigNumber(expected.step_1_lp_reward).plus(expected.step_3_lp_reward).div(TON_DECIMALS_MODIFIER).toString();
            const BAR_BACK_AMOUNT = new BigNumber(BAR_DEPOSIT)
                .minus(new BigNumber(IS_FOO_LEFT ? expected.step_1_right_deposit : expected.step_1_left_deposit)
                    .div(BAR_DECIMALS_MODIFIER))


            logExpectedDeposit(expected);

            await Account2.runTarget({
                contract: DexAccount2,
                method: 'depositLiquidity',
                params: {
                    left_root: IS_FOO_LEFT ? FooRoot.address : BarRoot.address,
                    left_amount: LEFT_AMOUNT,
                    right_root: IS_FOO_LEFT ? BarRoot.address : FooRoot.address,
                    right_amount: RIGHT_AMOUNT,
                    expected_lp_root: FooBarLpRoot.address,
                    auto_change: false,
                    send_gas_to: DexAccount2.address
                },
                value: locklift.utils.convertCrystal('1.1', 'nano'),
                keyPair: keyPairs[1]
            });

            const dexAccount2End = await dexAccountBalances(DexAccount2);
            const dexPairInfoEnd = await dexPairInfo();

            logger.log(`DexAccount#2 balance end: ` +
                `${dexAccount2End.foo} FOO, ${dexAccount2End.bar} BAR, ${dexAccount2End.lp} LP`);
            logger.log(`DexPair end: ` +
                `${dexPairInfoEnd.foo} FOO, ${dexPairInfoEnd.bar} BAR, ` +
                `LP SUPPLY (PLAN): ${dexPairInfoEnd.lp_supply} LP, `  +
                `LP SUPPLY (ACTUAL): ${dexPairInfoEnd.lp_supply_actual} LP`);

            const expectedAccount2Foo = new BigNumber(dexAccount2Start.foo).minus(FOO_DEPOSIT).toString();
            const expectedAccount2Bar = new BigNumber(dexAccount2Start.bar).minus(BAR_DEPOSIT).plus(BAR_BACK_AMOUNT).toString();
            const expectedAccount2Lp = new BigNumber(dexAccount2Start.lp).plus(LP_REWARD).toString();
            const expectedPairFoo = new BigNumber(dexPairInfoStart.foo).plus(FOO_DEPOSIT).toString();
            const expectedPairBar = new BigNumber(dexPairInfoStart.bar).plus(BAR_DEPOSIT).minus(BAR_BACK_AMOUNT).toString();
            const expectedPairLp = new BigNumber(dexPairInfoStart.lp_supply).plus(LP_REWARD).toString();

            expect(dexPairInfoEnd.lp_supply_actual).to.equal(dexPairInfoEnd.lp_supply, 'Wrong LP supply');
            expect(expectedAccount2Foo).to.equal(dexAccount2End.foo, 'Wrong DexAccount#2 FOO');
            expect(expectedAccount2Bar).to.equal(dexAccount2End.bar, 'Wrong DexAccount#2 BAR');
            expect(expectedAccount2Lp).to.equal(dexAccount2End.lp, 'Wrong DexAccount#2 LP');
            expect(expectedPairFoo).to.equal(dexPairInfoEnd.foo, 'Wrong DexPair FOO');
            expect(expectedPairBar).to.equal(dexPairInfoEnd.bar, 'Wrong DexPair BAR');
            expect(expectedPairLp).to.equal(dexPairInfoEnd.lp_supply, 'Wrong DexPair LP supply');
        });

    });

});
