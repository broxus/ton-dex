const {expect} = require('chai');
const {Migration, afterRun} = require(process.cwd() + '/scripts/utils');
const BigNumber = require('bignumber.js');
BigNumber.config({EXPONENTIAL_AT: 257});
const logger = require('mocha-logger');

const migration = new Migration();

const TOKEN_CONTRACTS_PATH = 'node_modules/ton-eth-bridge-token-contracts/free-ton/build';

let DexRoot
let DexVault;
let DexPairFooBar;
let FooVaultWallet;
let BarVaultWallet;
let FooBarLpVaultWallet;
let FooPairWallet;
let BarPairWallet;
let FooBarLpPairWallet;
let FooRoot;
let BarRoot;
let FooBarLpRoot;
let Account3;
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
    }).catch(e => {/*ignored*/});
    let bar;
    await BarWallet3.call({method: 'balance', params: {_answer_id: 0}}).then(n => {
        bar = new BigNumber(n).div(BAR_DECIMALS_MODIFIER).toString();
    }).catch(e => {/*ignored*/});
    let lp;
    await FooBarLpWallet3.call({method: 'balance', params: {_answer_id: 0}}).then(n => {
        lp = new BigNumber(n).div(LP_DECIMALS_MODIFIER).toString();
    }).catch(e => {/*ignored*/});
    const ton = await locklift.utils.convertCrystal((await locklift.ton.getBalance(Account3.address)), 'ton').toNumber();
    return {foo, bar, lp, ton};
}

async function dexPairInfo() {
    const balances = await DexPairFooBar.call({method: 'getBalances', params: {_answer_id: 0}});
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

function logBalances(header, dex, account, pair) {
    logger.log(`DEX balance ${header}: ${dex.foo} FOO, ${dex.bar} BAR, ${dex.lp} LP`);
    logger.log(`DexPair ${header}: ` +
        `${pair.foo} FOO, ${pair.bar} BAR, ` +
        `LP SUPPLY (PLAN): ${pair.lp_supply || "0"} LP, ` +
        `LP SUPPLY (ACTUAL): ${pair.lp_supply_actual|| "0"} LP`);
    logger.log(`Account#3 balance ${header}: ` +
        `${account.foo !== undefined ? account.foo + ' FOO' : 'FOO (not deployed)'}, ` +
        `${account.bar !== undefined ? account.bar + ' BAR' : 'BAR (not deployed)'}, ` +
        `${account.lp !== undefined ? account.lp + ' LP' : 'LP (not deployed)'}, ` +
        `${account.ton} TON`);
}

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

describe('Check direct DexPairFooBar operations', async function () {
    this.timeout(120000);
    before('Load contracts', async function () {
        keyPairs = await locklift.keys.getKeyPairs();

        DexRoot = await locklift.factory.getContract('DexRoot');
        DexVault = await locklift.factory.getContract('DexVault');
        DexPairFooBar = await locklift.factory.getContract('DexPair');
        FooRoot = await locklift.factory.getContract('RootTokenContract', TOKEN_CONTRACTS_PATH);
        BarRoot = await locklift.factory.getContract('RootTokenContract', TOKEN_CONTRACTS_PATH);
        FooBarLpRoot = await locklift.factory.getContract('RootTokenContract', TOKEN_CONTRACTS_PATH);
        FooVaultWallet = await locklift.factory.getContract('TONTokenWallet', TOKEN_CONTRACTS_PATH);
        BarVaultWallet = await locklift.factory.getContract('TONTokenWallet', TOKEN_CONTRACTS_PATH);
        FooBarLpVaultWallet = await locklift.factory.getContract('TONTokenWallet', TOKEN_CONTRACTS_PATH);
        FooPairWallet = await locklift.factory.getContract('TONTokenWallet', TOKEN_CONTRACTS_PATH);
        BarPairWallet = await locklift.factory.getContract('TONTokenWallet', TOKEN_CONTRACTS_PATH);
        FooBarLpPairWallet = await locklift.factory.getContract('TONTokenWallet', TOKEN_CONTRACTS_PATH);
        Account3 = await locklift.factory.getAccount();
        Account3.afterRun = afterRun;
        FooWallet3 = await locklift.factory.getContract('TONTokenWallet', TOKEN_CONTRACTS_PATH);
        BarWallet3 = await locklift.factory.getContract('TONTokenWallet', TOKEN_CONTRACTS_PATH);
        FooBarLpWallet3 = await locklift.factory.getContract('TONTokenWallet', TOKEN_CONTRACTS_PATH);

        migration.load(DexRoot, 'DexRoot');
        migration.load(DexVault, 'DexVault');
        migration.load(DexPairFooBar, 'DexPairFooBar');
        migration.load(FooVaultWallet, 'FooVaultWallet');
        migration.load(BarVaultWallet, 'BarVaultWallet');
        migration.load(FooBarLpVaultWallet, 'FooBarLpVaultWallet');
        migration.load(FooPairWallet, 'FooPairWallet');
        migration.load(BarPairWallet, 'BarPairWallet');
        migration.load(FooBarLpPairWallet, 'FooBarLpPairWallet');
        migration.load(FooRoot, 'FooRoot');
        migration.load(BarRoot, 'BarRoot');
        migration.load(FooBarLpRoot, 'FooBarLpRoot');
        migration.load(Account3, 'Account3');
        migration.load(FooWallet3, 'FooWallet3');

        if (migration.exists('BarWallet3')) {
            migration.load(BarWallet3, 'BarWallet3');
            logger.log(`BarWallet#3: ${BarWallet3.address}`);
        } else {
            const expected = await BarRoot.call({
                method: 'getWalletAddress', params: {
                    _answer_id: 0,
                    wallet_public_key_: `0x0`,
                    owner_address_: Account3.address
                }
            });
            logger.log(`BarWallet#3: ${expected} (not deployed)`);
        }
        if (migration.exists('FooBarLpWallet3')) {
            migration.load(FooBarLpWallet3, 'FooBarLpWallet3');
            logger.log(`FooBarLpWallet3#3: ${FooBarLpWallet3.address}`);
        } else {
            const expected = await FooBarLpRoot.call({
                method: 'getWalletAddress', params: {
                    _answer_id: 0,
                    wallet_public_key_: `0x0`,
                    owner_address_: Account3.address
                }
            });
            logger.log(`FooBarLpWallet#3: ${expected} (not deployed)`);
        }
        const pairRoots = await DexPairFooBar.call({method: 'getTokenRoots', params: {_answer_id: 0}});
        IS_FOO_LEFT = pairRoots.left === FooRoot.address;

        logger.log(`Vault wallets: 
            FOO: ${FooVaultWallet.address}
            BAR: ${BarVaultWallet.address}
            LP: ${FooBarLpVaultWallet.address}
        `);

        logger.log(`Pair wallets: 
            FOO: ${FooPairWallet.address}
            BAR: ${BarPairWallet.address}
            LP: ${FooBarLpPairWallet.address}
        `);

        logger.log('DexRoot: ' + DexRoot.address);
        logger.log('DexVault: ' + DexVault.address);
        logger.log('DexPairFooBar: ' + DexPairFooBar.address);
        logger.log('FooRoot: ' + FooRoot.address);
        logger.log('BarRoot: ' + BarRoot.address);
        logger.log('Account#3: ' + Account3.address);
        logger.log('FooWallet#3: ' + FooWallet3.address);
    });

    describe('Direct exchange (positive)', async function () {
        it('Account#3 exchange FOO to BAR (with deploy BarWallet#3)', async function () {
            const dexStart = await dexBalances();
            const accountStart = await account3balances();
            const pairStart = await dexPairInfo();
            logBalances('start', dexStart, accountStart, pairStart);

            const TOKENS_TO_EXCHANGE = 1000;

            const expected = await DexPairFooBar.call({
                method: 'expectedExchange', params: {
                    amount: new BigNumber(TOKENS_TO_EXCHANGE).times(FOO_DECIMALS_MODIFIER).toString(),
                    is_left_to_right: IS_FOO_LEFT
                }
            });

            logger.log(`Spent amount: ${TOKENS_TO_EXCHANGE} FOO`);
            logger.log(`Expected fee: ${new BigNumber(expected.expected_fee).div(FOO_DECIMALS_MODIFIER).toString()} FOO`);
            logger.log(`Expected receive amount: ${new BigNumber(expected.expected_amount).div(BAR_DECIMALS_MODIFIER).toString()} BAR`);

            const payload = await DexPairFooBar.call({
                method: 'buildExchangePayload', params: {
                    deploy_wallet_grams: locklift.utils.convertCrystal('0.05', 'nano'),
                    expected_amount: expected.expected_amount
                }
            });

            const tx = await Account3.runTarget({
                contract: FooWallet3,
                method: 'transferToRecipient',
                params: {
                    recipient_public_key: 0,
                    recipient_address: DexPairFooBar.address,
                    tokens: new BigNumber(TOKENS_TO_EXCHANGE).times(FOO_DECIMALS_MODIFIER).toString(),
                    deploy_grams: 0,
                    transfer_grams: 0,
                    send_gas_to: Account3.address,
                    notify_receiver: true,
                    payload: payload
                },
                value: locklift.utils.convertCrystal('3', 'nano'),
                keyPair: keyPairs[2]
            });

            logger.log(`Transaction: ${tx.id}`);

            await BarWallet3.setAddress(await BarRoot.call({
                method: 'getWalletAddress', params: {
                    _answer_id: 0,
                    wallet_public_key_: `0x0`,
                    owner_address_: Account3.address
                }
            }));

            migration.store(BarWallet3, 'BarWallet3');

            const dexEnd = await dexBalances();
            const accountEnd = await account3balances();
            const pairEnd = await dexPairInfo();
            logBalances('end', dexEnd, accountEnd, pairEnd);

            const expectedDexFoo = new BigNumber(dexStart.foo).plus(TOKENS_TO_EXCHANGE).toString();
            const expectedDexBar = new BigNumber(dexStart.bar)
                .minus(new BigNumber(expected.expected_amount).div(BAR_DECIMALS_MODIFIER)).toString();
            const expectedAccountFoo = new BigNumber(accountStart.foo).minus(TOKENS_TO_EXCHANGE).toString();
            const expectedAccountBar = new BigNumber(accountStart.bar || 0)
                .plus(new BigNumber(expected.expected_amount).div(BAR_DECIMALS_MODIFIER)).toString();

            expect(expectedDexFoo).to.equal(dexEnd.foo.toString(), 'Wrong DEX FOO balance');
            expect(expectedDexBar).to.equal(dexEnd.bar.toString(), 'Wrong DEX BAR balance');
            expect(expectedAccountFoo).to.equal(accountEnd.foo.toString(), 'Wrong Account#3 FOO balance');
            expect(expectedAccountBar).to.equal(accountEnd.bar.toString(), 'Wrong Account#3 BAR balance');
        });

        it('Account#3 exchange BAR to FOO', async function () {
            const dexStart = await dexBalances();
            const accountStart = await account3balances();
            const pairStart = await dexPairInfo();
            logBalances('start', dexStart, accountStart, pairStart);

            const TOKENS_TO_EXCHANGE = 100;

            const expected = await DexPairFooBar.call({
                method: 'expectedExchange', params: {
                    amount: new BigNumber(TOKENS_TO_EXCHANGE).times(BAR_DECIMALS_MODIFIER).toString(),
                    is_left_to_right: !IS_FOO_LEFT
                }
            });

            logger.log(`Spent amount: ${TOKENS_TO_EXCHANGE.toString()} BAR`);
            logger.log(`Expected fee: ${new BigNumber(expected.expected_fee).div(BAR_DECIMALS_MODIFIER).toString()} BAR`);
            logger.log(`Expected receive amount: ${new BigNumber(expected.expected_amount).div(FOO_DECIMALS_MODIFIER).toString()} FOO`);

            const payload = await DexPairFooBar.call({
                method: 'buildExchangePayload', params: {
                    deploy_wallet_grams: 0,
                    expected_amount: expected.expected_amount
                }
            });

            await Account3.runTarget({
                contract: BarWallet3,
                method: 'transferToRecipient',
                params: {
                    recipient_public_key: 0,
                    recipient_address: DexPairFooBar.address,
                    tokens: new BigNumber(TOKENS_TO_EXCHANGE).times(BAR_DECIMALS_MODIFIER).toString(),
                    deploy_grams: 0,
                    transfer_grams: 0,
                    send_gas_to: Account3.address,
                    notify_receiver: true,
                    payload: payload
                },
                value: locklift.utils.convertCrystal('2.3', 'nano'),
                keyPair: keyPairs[2]
            });

            const dexEnd = await dexBalances();
            const accountEnd = await account3balances();
            const pairEnd = await dexPairInfo();
            logBalances('end', dexEnd, accountEnd, pairEnd);

            const expectedDexFoo = new BigNumber(dexStart.foo)
                .minus(new BigNumber(expected.expected_amount).div(FOO_DECIMALS_MODIFIER)).toString();
            const expectedDexBar = new BigNumber(dexStart.bar).plus(TOKENS_TO_EXCHANGE).toString();
            const expectedAccountFoo = new BigNumber(accountStart.foo)
                .plus(new BigNumber(expected.expected_amount).div(FOO_DECIMALS_MODIFIER)).toString();
            const expectedAccountBar = new BigNumber(accountStart.bar).minus(TOKENS_TO_EXCHANGE).toString();

            expect(expectedDexFoo).to.equal(dexEnd.foo.toString(), 'Wrong DEX FOO balance');
            expect(expectedDexBar).to.equal(dexEnd.bar.toString(), 'Wrong DEX BAR balance');
            expect(expectedAccountFoo).to.equal(accountEnd.foo.toString(), 'Wrong Account#3 FOO balance');
            expect(expectedAccountBar).to.equal(accountEnd.bar.toString(), 'Wrong Account#3 BAR balance');
        });

        it('Account#3 exchange BAR to FOO (small amount)', async function () {
            const dexStart = await dexBalances();
            const accountStart = await account3balances();
            const pairStart = await dexPairInfo();
            logBalances('start', dexStart, accountStart, pairStart);

            const expected = await DexPairFooBar.call({
                method: 'expectedExchange', params: {
                    amount: 1000,
                    is_left_to_right: !IS_FOO_LEFT
                }
            });

            logger.log(`Expected fee: ${new BigNumber(expected.expected_fee).div(BAR_DECIMALS_MODIFIER).toString()} BAR`);
            logger.log(`Expected receive amount: ${new BigNumber(expected.expected_amount).div(FOO_DECIMALS_MODIFIER).toString()} FOO`);

            const payload = await DexPairFooBar.call({
                method: 'buildExchangePayload', params: {
                    deploy_wallet_grams: 0,
                    expected_amount: 0
                }
            });

            await Account3.runTarget({
                contract: BarWallet3,
                method: 'transferToRecipient',
                params: {
                    recipient_public_key: 0,
                    recipient_address: DexPairFooBar.address,
                    tokens: 1000,
                    deploy_grams: 0,
                    transfer_grams: 0,
                    send_gas_to: Account3.address,
                    notify_receiver: true,
                    payload: payload
                },
                value: locklift.utils.convertCrystal('2.3', 'nano'),
                keyPair: keyPairs[2]
            });

            const dexEnd = await dexBalances();
            const accountEnd = await account3balances();
            const pairEnd = await dexPairInfo();
            logBalances('end', dexEnd, accountEnd, pairEnd);

            const expectedDexFoo = new BigNumber(dexStart.foo)
                .minus(new BigNumber(expected.expected_amount).div(FOO_DECIMALS_MODIFIER)).toString();
            const expectedDexBar = new BigNumber(dexStart.bar).plus(new BigNumber(1000).div(BAR_DECIMALS_MODIFIER)).toString();
            const expectedAccountFoo = new BigNumber(accountStart.foo)
                .plus(new BigNumber(expected.expected_amount).div(FOO_DECIMALS_MODIFIER)).toString();
            const expectedAccountBar = new BigNumber(accountStart.bar).minus(new BigNumber(1000).div(BAR_DECIMALS_MODIFIER)).toString();

            expect(expectedDexFoo).to.equal(dexEnd.foo.toString(), 'Wrong DEX FOO balance');
            expect(expectedDexBar).to.equal(dexEnd.bar.toString(), 'Wrong DEX BAR balance');
            expect(expectedAccountFoo).to.equal(accountEnd.foo.toString(), 'Wrong Account#3 FOO balance');
            expect(expectedAccountBar).to.equal(accountEnd.bar.toString(), 'Wrong Account#3 BAR balance');
        });
    });

    describe('Direct deposit liquidity (positive)', async function () {

        it('Account#3 deposit FOO liquidity (small amount)', async function () {
            const dexStart = await dexBalances();
            const accountStart = await account3balances();
            const pairStart = await dexPairInfo();
            logBalances('start', dexStart, accountStart, pairStart);

            const expected = await DexPairFooBar.call({
                method: 'expectedDepositLiquidity', params: {
                    left_amount: IS_FOO_LEFT ? 1000 : 0,
                    right_amount: IS_FOO_LEFT ? 0 : 1000,
                    auto_change: true
                }
            });

            logExpectedDeposit(expected);

            const payload = await DexPairFooBar.call({
                method: 'buildDepositLiquidityPayload', params: {
                    deploy_wallet_grams: locklift.utils.convertCrystal('0.05', 'nano')
                }
            });

            await Account3.runTarget({
                contract: FooWallet3,
                method: 'transferToRecipient',
                params: {
                    recipient_public_key: 0,
                    recipient_address: DexPairFooBar.address,
                    tokens: 1000,
                    deploy_grams: 0,
                    transfer_grams: 0,
                    send_gas_to: Account3.address,
                    notify_receiver: true,
                    payload: payload
                },
                value: locklift.utils.convertCrystal('2.3', 'nano'),
                keyPair: keyPairs[2]
            });

            await FooBarLpWallet3.setAddress(await FooBarLpRoot.call({
                method: 'getWalletAddress', params: {
                    _answer_id: 0,
                    wallet_public_key_: `0x0`,
                    owner_address_: Account3.address
                }
            }));

            migration.store(FooBarLpWallet3, 'FooBarLpWallet3');

            const dexEnd = await dexBalances();
            const accountEnd = await account3balances();
            const pairEnd = await dexPairInfo();
            logBalances('end', dexEnd, accountEnd, pairEnd);

            const expectedDexFoo = new BigNumber(dexStart.foo).plus(new BigNumber(1000).div(FOO_DECIMALS_MODIFIER)).toString();
            const expectedAccountFoo = new BigNumber(accountStart.foo).minus(new BigNumber(1000).div(FOO_DECIMALS_MODIFIER)).toString();
            const expectedAccountLp = new BigNumber(accountStart.lp || 0)
                .plus(expected.step_1_lp_reward.plus(expected.step_3_lp_reward).div(LP_DECIMALS_MODIFIER)).toString();

            expect(pairEnd.lp_supply_actual).to.equal(pairEnd.lp_supply, 'Wrong LP supply');
            expect(expectedDexFoo).to.equal(dexEnd.foo.toString(), 'Wrong DEX FOO balance');
            expect(expectedAccountFoo).to.equal(accountEnd.foo.toString(), 'Wrong Account#3 FOO balance');
            expect(expectedAccountLp).to.equal(accountEnd.lp.toString(), 'Wrong Account#3 LP balance');
        });

        it('Account#3 deposit FOO liquidity', async function () {
            const dexStart = await dexBalances();
            const accountStart = await account3balances();
            const pairStart = await dexPairInfo();
            logBalances('start', dexStart, accountStart, pairStart);

            const TOKENS_TO_DEPOSIT = 100;

            const expected = await DexPairFooBar.call({
                method: 'expectedDepositLiquidity', params: {
                    left_amount: IS_FOO_LEFT ? new BigNumber(TOKENS_TO_DEPOSIT).times(FOO_DECIMALS_MODIFIER).toString() : 0,
                    right_amount: IS_FOO_LEFT ? 0 : new BigNumber(TOKENS_TO_DEPOSIT).times(FOO_DECIMALS_MODIFIER).toString(),
                    auto_change: true
                }
            });

            logExpectedDeposit(expected);

            const payload = await DexPairFooBar.call({
                method: 'buildDepositLiquidityPayload', params: {
                    deploy_wallet_grams: locklift.utils.convertCrystal('0.05', 'nano')
                }
            });

            await Account3.runTarget({
                contract: FooWallet3,
                method: 'transferToRecipient',
                params: {
                    recipient_public_key: 0,
                    recipient_address: DexPairFooBar.address,
                    tokens: new BigNumber(TOKENS_TO_DEPOSIT).times(FOO_DECIMALS_MODIFIER).toString(),
                    deploy_grams: 0,
                    transfer_grams: 0,
                    send_gas_to: Account3.address,
                    notify_receiver: true,
                    payload: payload
                },
                value: locklift.utils.convertCrystal('2.3', 'nano'),
                keyPair: keyPairs[2]
            });

            FooBarLpWallet3.setAddress(await FooBarLpRoot.call({
                method: 'getWalletAddress', params: {
                    _answer_id: 0,
                    wallet_public_key_: `0x0`,
                    owner_address_: Account3.address
                }
            }));

            migration.store(FooBarLpWallet3, 'FooBarLpWallet3');

            const dexEnd = await dexBalances();
            const accountEnd = await account3balances();
            const pairEnd = await dexPairInfo();
            logBalances('end', dexEnd, accountEnd, pairEnd);

            const expectedDexFoo = new BigNumber(dexStart.foo).plus(TOKENS_TO_DEPOSIT).toString();
            const expectedAccountFoo = new BigNumber(accountStart.foo).minus(TOKENS_TO_DEPOSIT).toString();
            const expectedAccountLp = new BigNumber(accountStart.lp || 0)
                .plus(expected.step_1_lp_reward.plus(expected.step_3_lp_reward).div(TON_DECIMALS_MODIFIER)).toString();

            expect(pairEnd.lp_supply_actual).to.equal(pairEnd.lp_supply, 'Wrong LP supply');
            expect(expectedDexFoo).to.equal(dexEnd.foo.toString(), 'Wrong DEX FOO balance');
            expect(expectedAccountFoo).to.equal(accountEnd.foo.toString(), 'Wrong Account#3 FOO balance');
            expect(expectedAccountLp).to.equal(accountEnd.lp.toString(), 'Wrong Account#3 LP balance');
        });

        it('Account#3 deposit BAR liquidity', async function () {
            const dexStart = await dexBalances();
            const accountStart = await account3balances();
            const pairStart = await dexPairInfo();
            logBalances('start', dexStart, accountStart, pairStart);

            const TOKENS_TO_DEPOSIT = 100;

            const expected = await DexPairFooBar.call({
                method: 'expectedDepositLiquidity', params: {
                    left_amount: IS_FOO_LEFT ? 0 : new BigNumber(TOKENS_TO_DEPOSIT).times(BAR_DECIMALS_MODIFIER).toString(),
                    right_amount: IS_FOO_LEFT ? new BigNumber(TOKENS_TO_DEPOSIT).times(BAR_DECIMALS_MODIFIER).toString() : 0,
                    auto_change: true
                }
            });

            logExpectedDeposit(expected);

            const payload = await DexPairFooBar.call({
                method: 'buildDepositLiquidityPayload', params: {
                    deploy_wallet_grams: 0
                }
            });

            await Account3.runTarget({
                contract: BarWallet3,
                method: 'transferToRecipient',
                params: {
                    recipient_public_key: 0,
                    recipient_address: DexPairFooBar.address,
                    tokens: new BigNumber(TOKENS_TO_DEPOSIT).times(BAR_DECIMALS_MODIFIER).toString(),
                    deploy_grams: 0,
                    transfer_grams: 0,
                    send_gas_to: Account3.address,
                    notify_receiver: true,
                    payload: payload
                },
                value: locklift.utils.convertCrystal('2.3', 'nano'),
                keyPair: keyPairs[2]
            });

            const dexEnd = await dexBalances();
            const accountEnd = await account3balances();
            const pairEnd = await dexPairInfo();
            logBalances('end', dexEnd, accountEnd, pairEnd);

            const expectedDexBar = new BigNumber(dexStart.bar).plus(TOKENS_TO_DEPOSIT).toString();
            const expectedAccountBar = new BigNumber(accountStart.bar).minus(TOKENS_TO_DEPOSIT).toString();
            const expectedAccountLp = new BigNumber(accountStart.lp)
                .plus(new BigNumber(expected.step_3_lp_reward).div(LP_DECIMALS_MODIFIER)).toString();

            expect(pairEnd.lp_supply_actual).to.equal(pairEnd.lp_supply, 'Wrong LP supply');
            expect(expectedDexBar).to.equal(dexEnd.bar.toString(), 'Wrong DEX BAR balance');
            expect(expectedAccountBar).to.equal(accountEnd.bar.toString(), 'Wrong Account#3 BAR balance');
            expect(expectedAccountLp).to.equal(accountEnd.lp.toString(), 'Wrong Account#3 LP balance');
        });

    });

    describe('Direct withdraw liquidity (positive)', async function () {
        it('Account#3 direct withdraw liquidity (small amount)', async function () {
            const dexStart = await dexBalances();
            const accountStart = await account3balances();
            const pairStart = await dexPairInfo();
            logBalances('start', dexStart, accountStart, pairStart);

            const expected = await DexPairFooBar.call({
                method: 'expectedWithdrawLiquidity', params: {
                    lp_amount: 1000
                }
            });

            const payload = await DexPairFooBar.call({
                method: 'buildWithdrawLiquidityPayload', params: {
                    deploy_wallet_grams: 0
                }
            });

            logger.log(`Expected ${IS_FOO_LEFT ? 'FOO' : 'BAR'}: ` +
                `${new BigNumber(expected.expected_left_amount).div(IS_FOO_LEFT ? FOO_DECIMALS_MODIFIER : BAR_DECIMALS_MODIFIER).toString()}`);
            logger.log(`Expected ${!IS_FOO_LEFT ? 'FOO' : 'BAR'}: ` +
                `${new BigNumber(expected.expected_right_amount).div(!IS_FOO_LEFT ? FOO_DECIMALS_MODIFIER : BAR_DECIMALS_MODIFIER).toString()}`);

            await Account3.runTarget({
                contract: FooBarLpWallet3,
                method: 'transferToRecipient',
                params: {
                    recipient_public_key: 0,
                    recipient_address: DexPairFooBar.address,
                    tokens: 1000,
                    deploy_grams: 0,
                    transfer_grams: 0,
                    send_gas_to: Account3.address,
                    notify_receiver: true,
                    payload: payload
                },
                value: locklift.utils.convertCrystal('2.3', 'nano'),
                keyPair: keyPairs[2]
            });

            const dexEnd = await dexBalances();
            const accountEnd = await account3balances();
            const pairEnd = await dexPairInfo();
            logBalances('end', dexEnd, accountEnd, pairEnd);

            const expectedDexFoo = new BigNumber(dexStart.foo)
                .minus(new BigNumber(IS_FOO_LEFT ? expected.expected_left_amount : expected.expected_right_amount).div(FOO_DECIMALS_MODIFIER))
                .toString();
            const expectedDexBar = new BigNumber(dexStart.bar)
                .minus(new BigNumber(!IS_FOO_LEFT ? expected.expected_left_amount : expected.expected_right_amount).div(BAR_DECIMALS_MODIFIER))
                .toString();
            const expectedAccountFoo = new BigNumber(accountStart.foo)
                .plus(new BigNumber(IS_FOO_LEFT ? expected.expected_left_amount : expected.expected_right_amount).div(FOO_DECIMALS_MODIFIER))
                .toString();
            const expectedAccountBar = new BigNumber(accountStart.bar)
                .plus(new BigNumber(!IS_FOO_LEFT ? expected.expected_left_amount : expected.expected_right_amount).div(BAR_DECIMALS_MODIFIER))
                .toString();

            expect(pairEnd.lp_supply_actual).to.equal(pairEnd.lp_supply, 'Wrong LP supply');
            expect(expectedDexFoo).to.equal(dexEnd.foo.toString(), 'Wrong DEX FOO balance');
            expect(expectedDexBar).to.equal(dexEnd.bar.toString(), 'Wrong DEX BAR balance');
            expect(expectedAccountFoo).to.equal(accountEnd.foo.toString(), 'Wrong Account#3 FOO balance');
            expect(expectedAccountBar).to.equal(accountEnd.bar.toString(), 'Wrong Account#3 BAR balance');
        });

        it('Account#3 direct withdraw liquidity', async function () {
            const dexStart = await dexBalances();
            const accountStart = await account3balances();
            const pairStart = await dexPairInfo();
            logBalances('start', dexStart, accountStart, pairStart);

            const expected = await DexPairFooBar.call({
                method: 'expectedWithdrawLiquidity', params: {
                    lp_amount: new BigNumber(accountStart.lp).times(LP_DECIMALS_MODIFIER).toString()
                }
            });

            const payload = await DexPairFooBar.call({
                method: 'buildWithdrawLiquidityPayload', params: {
                    deploy_wallet_grams: 0
                }
            });

            logger.log(`Expected ${IS_FOO_LEFT ? 'FOO' : 'BAR'}: ` +
                `${new BigNumber(expected.expected_left_amount).div(IS_FOO_LEFT ? FOO_DECIMALS_MODIFIER : BAR_DECIMALS_MODIFIER).toString()}`);
            logger.log(`Expected ${!IS_FOO_LEFT ? 'FOO' : 'BAR'}: ` +
                `${new BigNumber(expected.expected_right_amount).div(!IS_FOO_LEFT ? FOO_DECIMALS_MODIFIER : BAR_DECIMALS_MODIFIER).toString()}`);

            await Account3.runTarget({
                contract: FooBarLpWallet3,
                method: 'transferToRecipient',
                params: {
                    recipient_public_key: 0,
                    recipient_address: DexPairFooBar.address,
                    tokens: new BigNumber(accountStart.lp).times(LP_DECIMALS_MODIFIER).toString(),
                    deploy_grams: 0,
                    transfer_grams: 0,
                    send_gas_to: Account3.address,
                    notify_receiver: true,
                    payload: payload
                },
                value: locklift.utils.convertCrystal('2.3', 'nano'),
                keyPair: keyPairs[2]
            });

            const dexEnd = await dexBalances();
            const accountEnd = await account3balances();
            const pairEnd = await dexPairInfo();
            logBalances('end', dexEnd, accountEnd, pairEnd);

            const expectedDexFoo = new BigNumber(dexStart.foo)
                .minus(new BigNumber(IS_FOO_LEFT ? expected.expected_left_amount : expected.expected_right_amount).div(FOO_DECIMALS_MODIFIER))
                .toString();
            const expectedDexBar = new BigNumber(dexStart.bar)
                .minus(new BigNumber(!IS_FOO_LEFT ? expected.expected_left_amount : expected.expected_right_amount).div(BAR_DECIMALS_MODIFIER))
                .toString();
            const expectedAccountFoo = new BigNumber(accountStart.foo)
                .plus(new BigNumber(IS_FOO_LEFT ? expected.expected_left_amount : expected.expected_right_amount).div(FOO_DECIMALS_MODIFIER))
                .toString();
            const expectedAccountBar = new BigNumber(accountStart.bar)
                .plus(new BigNumber(!IS_FOO_LEFT ? expected.expected_left_amount : expected.expected_right_amount).div(BAR_DECIMALS_MODIFIER))
                .toString();
            const expectedAccountLp = '0';

            expect(pairEnd.lp_supply_actual).to.equal(pairEnd.lp_supply, 'Wrong LP supply');
            expect(expectedDexFoo).to.equal(dexEnd.foo.toString(), 'Wrong DEX FOO balance');
            expect(expectedDexBar).to.equal(dexEnd.bar.toString(), 'Wrong DEX BAR balance');
            expect(expectedAccountFoo).to.equal(accountEnd.foo.toString(), 'Wrong Account#3 FOO balance');
            expect(expectedAccountBar).to.equal(accountEnd.bar.toString(), 'Wrong Account#3 BAR balance');
            expect(expectedAccountLp).to.equal(accountEnd.lp.toString(), 'Wrong Account#3 LP balance');
        });
    });

    describe('Direct exchange (negative)', async function () {

        it('Account#3 exchange FOO to BAR (empty payload)', async function () {
            const dexStart = await dexBalances();
            const accountStart = await account3balances();
            const pairStart = await dexPairInfo();
            logBalances('start', dexStart, accountStart, pairStart);

            const TOKENS_TO_EXCHANGE = 100;

            const expected = await DexPairFooBar.call({
                method: 'expectedExchange', params: {
                    amount: new BigNumber(TOKENS_TO_EXCHANGE).times(FOO_DECIMALS_MODIFIER).toString(),
                    is_left_to_right: IS_FOO_LEFT
                }
            });

            await Account3.runTarget({
                contract: FooWallet3,
                method: 'transferToRecipient',
                params: {
                    recipient_public_key: 0,
                    recipient_address: DexPairFooBar.address,
                    tokens: new BigNumber(TOKENS_TO_EXCHANGE).times(FOO_DECIMALS_MODIFIER).toString(),
                    deploy_grams: 0,
                    transfer_grams: 0,
                    send_gas_to: Account3.address,
                    notify_receiver: true,
                    payload: EMPTY_TVM_CELL
                },
                value: locklift.utils.convertCrystal('2.3', 'nano'),
                keyPair: keyPairs[2]
            });

            const dexEnd = await dexBalances();
            const accountEnd = await account3balances();
            const pairEnd = await dexPairInfo();
            logBalances('end', dexEnd, accountEnd, pairEnd);

            expect(dexStart.foo).to.equal(dexEnd.foo, 'Wrong DEX FOO balance');
            expect(dexStart.bar).to.equal(dexEnd.bar, 'Wrong DEX BAR balance');
            expect(accountStart.foo).to.equal(accountEnd.foo, 'Wrong Account#3 FOO balance');
            expect(accountStart.bar).to.equal(accountEnd.bar, 'Wrong Account#3 BAR balance');
        });

        it('Account#3 exchange FOO to BAR (low gas)', async function () {
            const dexStart = await dexBalances();
            const accountStart = await account3balances();
            const pairStart = await dexPairInfo();
            logBalances('start', dexStart, accountStart, pairStart);

            const TOKENS_TO_EXCHANGE = 100;

            const expected = await DexPairFooBar.call({
                method: 'expectedExchange', params: {
                    amount: new BigNumber(TOKENS_TO_EXCHANGE).times(FOO_DECIMALS_MODIFIER).toString(),
                    is_left_to_right: IS_FOO_LEFT
                }
            });

            const payload = await DexPairFooBar.call({
                method: 'buildExchangePayload', params: {
                    deploy_wallet_grams: locklift.utils.convertCrystal('0.05', 'nano'),
                    expected_amount: expected.expected_amount
                }
            });

            await Account3.runTarget({
                contract: FooWallet3,
                method: 'transferToRecipient',
                params: {
                    recipient_public_key: 0,
                    recipient_address: DexPairFooBar.address,
                    tokens: new BigNumber(TOKENS_TO_EXCHANGE).times(FOO_DECIMALS_MODIFIER).toString(),
                    deploy_grams: 0,
                    transfer_grams: 0,
                    send_gas_to: Account3.address,
                    notify_receiver: true,
                    payload: payload
                },
                value: locklift.utils.convertCrystal('1', 'nano'),
                keyPair: keyPairs[2]
            });

            const dexEnd = await dexBalances();
            const accountEnd = await account3balances();
            const pairEnd = await dexPairInfo();
            logBalances('end', dexEnd, accountEnd, pairEnd);

            expect(dexStart.foo).to.equal(dexEnd.foo, 'Wrong DEX FOO balance');
            expect(dexStart.bar).to.equal(dexEnd.bar, 'Wrong DEX BAR balance');
            expect(accountStart.foo).to.equal(accountEnd.foo, 'Wrong Account#3 FOO balance');
            expect(accountStart.bar).to.equal(accountEnd.bar, 'Wrong Account#3 BAR balance');
        });

        it('Account#3 exchange FOO to BAR (wrong rate)', async function () {
            const dexStart = await dexBalances();
            const accountStart = await account3balances();
            const pairStart = await dexPairInfo();
            logBalances('start', dexStart, accountStart, pairStart);

            const TOKENS_TO_EXCHANGE = 100;

            const expected = await DexPairFooBar.call({
                method: 'expectedExchange', params: {
                    amount: new BigNumber(TOKENS_TO_EXCHANGE).times(FOO_DECIMALS_MODIFIER).toString(),
                    is_left_to_right: IS_FOO_LEFT
                }
            });

            const payload = await DexPairFooBar.call({
                method: 'buildExchangePayload', params: {
                    deploy_wallet_grams: locklift.utils.convertCrystal('0.05', 'nano'),
                    expected_amount: new BigNumber(expected.expected_amount).plus(1).toString()
                }
            });

            await Account3.runTarget({
                contract: FooWallet3,
                method: 'transferToRecipient',
                params: {
                    recipient_public_key: 0,
                    recipient_address: DexPairFooBar.address,
                    tokens: new BigNumber(TOKENS_TO_EXCHANGE).times(FOO_DECIMALS_MODIFIER).toString(),
                    deploy_grams: 0,
                    transfer_grams: 0,
                    send_gas_to: Account3.address,
                    notify_receiver: true,
                    payload: payload
                },
                value: locklift.utils.convertCrystal('2.3', 'nano'),
                keyPair: keyPairs[2]
            });

            const dexEnd = await dexBalances();
            const accountEnd = await account3balances();
            const pairEnd = await dexPairInfo();
            logBalances('end', dexEnd, accountEnd, pairEnd);

            expect(dexStart.foo).to.equal(dexEnd.foo, 'Wrong DEX FOO balance');
            expect(dexStart.bar).to.equal(dexEnd.bar, 'Wrong DEX BAR balance');
            expect(accountStart.foo).to.equal(accountEnd.foo, 'Wrong Account#3 FOO balance');
            expect(accountStart.bar).to.equal(accountEnd.bar, 'Wrong Account#3 BAR balance');
        });

        // it('Account#3 exchange FOO to BAR (too big amount)', async function () {
        //     const dexStart = await dexBalances();
        //     const accountStart = await account3balances();
        //     const pairStart = await dexPairInfo();
        //     logBalances('start', dexStart, accountStart, pairStart);
        //
        //     const TOKENS_TO_EXCHANGE = 100000;
        //
        //     const expected = await DexPairFooBar.call({
        //         method: 'expectedExchange', params: {
        //             amount: new BigNumber(TOKENS_TO_EXCHANGE).times(FOO_DECIMALS_MODIFIER).toString(),
        //             is_left_to_right: !IS_FOO_LEFT
        //         }
        //     });
        //
        //     logger.log(`Expected fee: ${new BigNumber(expected.expected_fee).div(BAR_DECIMALS_MODIFIER).toString()} BAR`);
        //     logger.log(`Expected receive amount: ${new BigNumber(expected.expected_amount).div(FOO_DECIMALS_MODIFIER).toString()} FOO`);
        //
        //     const payload = await DexPairFooBar.call({
        //         method: 'buildExchangePayload', params: {
        //             deploy_wallet_grams: locklift.utils.convertCrystal('0.05', 'nano'),
        //             expected_amount: 0
        //         }
        //     });
        //
        //     await Account3.runTarget({
        //         contract: FooWallet3,
        //         method: 'transferToRecipient',
        //         params: {
        //             recipient_public_key: 0,
        //             recipient_address: DexPairFooBar.address,
        //             tokens: new BigNumber(TOKENS_TO_EXCHANGE).times(FOO_DECIMALS_MODIFIER).toString(),
        //             deploy_grams: 0,
        //             transfer_grams: 0,
        //             send_gas_to: Account3.address,
        //             notify_receiver: true,
        //             payload: payload
        //         },
        //         value: locklift.utils.convertCrystal('2.3', 'nano'),
        //         keyPair: keyPairs[2]
        //     });
        //
        //     const dexEnd = await dexBalances();
        //     const accountEnd = await account3balances();
        //     const pairEnd = await dexPairInfo();
        //     logBalances('end', dexEnd, accountEnd, pairEnd);
        //
        //     expect(dexStart.foo).to.equal(dexEnd.foo, 'Wrong DEX FOO balance');
        //     expect(dexStart.bar).to.equal(dexEnd.bar, 'Wrong DEX BAR balance');
        //     expect(accountStart.foo).to.equal(accountEnd.foo, 'Wrong Account#3 FOO balance');
        //     expect(accountStart.bar).to.equal(accountEnd.bar, 'Wrong Account#3 BAR balance');
        // });
    });
});
