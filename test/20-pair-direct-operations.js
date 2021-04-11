const {expect} = require('chai');
const {Migration} = require('../scripts/utils');
const BigNumber = require('bignumber.js');
BigNumber.config({ EXPONENTIAL_AT: 257 });
const logger = require('mocha-logger');

const migration = new Migration();

const TOKEN_CONTRACTS_PATH = 'node_modules/ton-eth-bridge-token-contracts/free-ton/build';

let DexRoot;
let DexPair;
let FooDexWallet;
let BarDexWallet;
let LpDexWallet;
let FooRoot;
let BarRoot;
let LpRoot;
let Account3;
let FooWallet3;
let BarWallet3;
let LpWallet3;

let dexRoot;
let dexPair;
let fooDexWallet;
let barDexWallet;
let lpDexWallet;
let fooRoot;
let barRoot;
let lpRoot;
let account3;
let fooWallet3;
let barWallet3;
let lpWallet3;

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

async function dexBalances() {
  const foo = await fooDexWallet.call({method: 'balance', params: {_answer_id: 0}}).then(n => {
    return new BigNumber(n).div(FOO_DECIMALS_MODIFIER).toString();
  });
  const bar = await barDexWallet.call({method: 'balance', params: {_answer_id: 0}}).then(n => {
    return new BigNumber(n).div(BAR_DECIMALS_MODIFIER).toString();
  });
  const lp = await lpDexWallet.call({method: 'balance', params: {_answer_id: 0}}).then(n => {
    return new BigNumber(n).div(LP_DECIMALS_MODIFIER).toString();
  });
  return {foo, bar, lp};
}

async function account3balances() {
  let foo;
  await fooDexWallet.call({method: 'balance', params: {_answer_id: 0}}).then(n => {
    foo = new BigNumber(n).div(FOO_DECIMALS_MODIFIER).toString();
  });
  let bar;
  await barDexWallet.call({method: 'balance', params: {_answer_id: 0}}).then(n => {
    bar = new BigNumber(n).div(BAR_DECIMALS_MODIFIER).toString();
  });
  let lp;
  await lpDexWallet.call({method: 'balance', params: {_answer_id: 0}}).then(n => {
    lp = new BigNumber(n).div(LP_DECIMALS_MODIFIER).toString();
  });
  const ton = await locklift.utils.convertCrystal((await locklift.ton.getBalance(account3.address)), 'ton').toNumber();
  return {foo, bar, lp, ton};
}


function logExpectedDeposit(expected) {
    logger.log(`Expected result: `);
    logger.log(`    Step 1: `);
    logger.log(`        Left deposit = ${expected.step_1_left_deposit.div(TOKEN_DECIMALS_MODIFIER).toString()}`);
    logger.log(`        Right deposit = ${expected.step_1_right_deposit.div(TON_DECIMALS_MODIFIER).toString()}`);
    logger.log(`        LP reward = ${expected.step_1_lp_reward.div(TON_DECIMALS_MODIFIER).toString()}`);
    if (expected.step_2_left_to_right) {
        logger.log(`    Step 2: `);
        logger.log(`        Tokens for change = ${expected.step_2_spent.div(TOKEN_DECIMALS_MODIFIER).toString()}`);
        logger.log(`        Tokens fee = ${expected.step_2_fee.div(TOKEN_DECIMALS_MODIFIER).toString()}`);
        logger.log(`        TON received = ${expected.step_2_received.div(TON_DECIMALS_MODIFIER).toString()}`);
    } else if (expected.step_2_right_to_left) {
        logger.log(`    Step 2: `);
        logger.log(`        TONs for change = ${expected.step_2_spent.div(TON_DECIMALS_MODIFIER).toString()}`);
        logger.log(`        TONs fee = ${expected.step_2_fee.div(TON_DECIMALS_MODIFIER).toString()}`);
        logger.log(`        Tokens received = ${expected.step_2_received.div(TOKEN_DECIMALS_MODIFIER).toString()}`);
    } else {
        logger.log(`    Step 2: skipped`);
    }
    logger.log(`    Step 3: `);
    logger.log(`        Left deposit = ${expected.step_3_left_deposit.div(TOKEN_DECIMALS_MODIFIER).toString()}`);
    logger.log(`        Right deposit = ${expected.step_3_right_deposit.div(TON_DECIMALS_MODIFIER).toString()}`);
    logger.log(`        LP reward = ${expected.step_3_lp_reward.div(TON_DECIMALS_MODIFIER).toString()}`);
    logger.log(`    TOTAL: `);
    logger.log(`        LP reward = ${expected.step_1_lp_reward.plus(expected.step_3_lp_reward).div(TON_DECIMALS_MODIFIER).toString()}`);
}

describe('Check direct DexPair operations', async function () {
  before('Load contracts', async function () {
    keyPairs = await locklift.keys.getKeyPairs();

    DexRoot = await locklift.factory.getContract('DexRoot');
    DexPair = await locklift.factory.getContract('DexPair');
    FooRoot = await locklift.factory.getContract('RootTokenContract', TOKEN_CONTRACTS_PATH);
    BarRoot = await locklift.factory.getContract('RootTokenContract', TOKEN_CONTRACTS_PATH);
    LpRoot = await locklift.factory.getContract('RootTokenContract', TOKEN_CONTRACTS_PATH);
    FooDexWallet = await locklift.factory.getContract('TONTokenWallet', TOKEN_CONTRACTS_PATH);
    BarDexWallet = await locklift.factory.getContract('TONTokenWallet', TOKEN_CONTRACTS_PATH);
    LpDexWallet = await locklift.factory.getContract('TONTokenWallet', TOKEN_CONTRACTS_PATH);
    Account3 = await locklift.factory.getAccount();
    FooWallet3 = await locklift.factory.getContract('TONTokenWallet', TOKEN_CONTRACTS_PATH);
    BarWallet3 = await locklift.factory.getContract('TONTokenWallet', TOKEN_CONTRACTS_PATH);
    LpWallet3 = await locklift.factory.getContract('TONTokenWallet', TOKEN_CONTRACTS_PATH);

    dexRoot = migration.load(DexRoot, 'DexRoot');
    dexPair = migration.load(DexPair, 'DexPair');
    fooDexWallet = migration.load(FooDexWallet, 'FooDexWallet');
    barDexWallet = migration.load(BarDexWallet, 'BarDexWallet');
    lpDexWallet = migration.load(LpDexWallet, 'LpDexWallet');
    fooRoot = migration.load(FooRoot, 'FooRoot');
    barRoot = migration.load(BarRoot, 'BarRoot');
    lpRoot = migration.load(LpRoot, 'LpRoot');
    account3 = migration.load(Account3, 'Account3');
    fooWallet3 = migration.load(FooWallet3, 'FooWallet3');
    try {
      barWallet3 = migration.load(BarWallet3, 'BarWallet3');
    } catch (e) {
      logger.log('BarWallet#3 not deployed');
    }
    try {
      lpWallet3 = migration.load(LpWallet3, 'LpWallet3');
    } catch (e) {
      logger.log('LpWallet#3 not deployed');
    }
    const pairRoots = dexPair.call({method: 'getTokenRoots', params: {_answer_id: 0}});
    IS_FOO_LEFT = pairRoots.left === fooRoot.address;
  })
  describe('Direct exchange', async function () {
    it('Account#3 exchange FOO to BAR (with deploy BarWallet#3)', async function () {
      const dexStart = await dexBalances();
      const accountStart = await account3balances();
      logger.log(`DEX balance start: ${dexStart.foo} FOO, ${dexStart.bar} BAR, ${dexStart.lp} LP`);
      logger.log(`Account balance start: ${accountStart.foo} FOO, ${accountStart.bar} BAR, `+
                 `${accountStart.lp} LP, ${accountStart.ton} TON`);
      const TOKENS_TO_EXCHANGE = 100;

      const expected = await dexPair.call('expectedExchange', {
          amount: new BigNumber(TOKENS_TO_EXCHANGE).times(FOO_DECIMALS_MODIFIER).toString(),
          is_left_to_right: IS_FOO_LEFT
      });

      logger.log(`Expected fee: ${new BigNumber(expected.expected_fee).div(FOO_DECIMALS_MODIFIER).toString()} FOO`);
      logger.log(`Expected receive amount: ${new BigNumber(expected.expected_amount).div(BAR_DECIMALS_MODIFIER).toString()} BAR`);

      account3.runTarget({
        contract: fooWallet3,
        method: 'transferToRecipient',
        params: {
          recipient_public_key: 0,
          recipient_address: dexPair.address,
          tokens: new BigNumber(TOKENS_TO_EXCHANGE).times(FOO_DECIMALS_MODIFIER).toString(),
          deploy_grams: 0,
          transfer_grams: 0,
          send_gas_to: account3.address,
          notify_receiver: true,
          payload: EMPTY_TVM_CELL
        },
        keyPairs[3]
      });

      const dexEnd = await dexBalances();
      const accountEnd = await account3balances();

      logger.log(`DEX balance end: ${dexEnd.foo} FOO, ${dexEnd.bar} BAR, ${dexEnd.lp} LP`);
      logger.log(`Account balance end: ${accountEnd.foo} FOO, ${accountEnd.bar} BAR, `+
                 `${accountEnd.lp} LP, ${accountEnd.ton} TON`);

      const expectedDexFoo = new BigNumber(dexStart.foo).plus(TOKENS_TO_EXCHANGE).toString();
      const expectedDexBar = new BigNumber(dexStart.bar).minus(expected.expected_amount).toString();
      const expectedAccountFoo = new BigNumber(accountStart.foo).minus(TOKENS_TO_EXCHANGE).toString();
      const expectedAccountBar = new BigNumber(accountStart.bar).plus(expected.expected_amount).toString();

      expect(expectedDexFoo).to.equal(dexEnd.foo.toString(), 'Wrong DEX FOO balance');
      expect(expectedDexBar).to.equal(dexEnd.bar.toString(), 'Wrong DEX BAR balance');
      expect(expectedAccountFoo).to.equal(accountEnd.foo.toString(), 'Wrong Account#3 FOO balance');
      expect(expectedAccountFoo).to.equal(accountEnd.bar.toString(), 'Wrong Account#3 BAR balance');
    });
  });

});
