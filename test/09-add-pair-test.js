const {expect} = require('chai');
const logger = require('mocha-logger');
const {Migration, afterRun} = require(process.cwd() + '/scripts/utils')

const migration = new Migration();

let DexAccount;

let dexPairFooBar;
let dexAccount2;
let account2;
let left_root;
let right_root;
let lp_root;
let keyPairs;

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

describe('Check DexAccount add Pair', async function () {
  this.timeout(120000);
  before('Load contracts', async function () {
    keyPairs = await locklift.keys.getKeyPairs();
    DexAccount = await locklift.factory.getContract('DexAccount');
    account2 = migration.load(await locklift.factory.getAccount(), 'Account2');
    account2.afterRun = afterRun;
    dexAccount2 = migration.load(DexAccount, 'DexAccount2');
    dexPairFooBar = migration.load(await locklift.factory.getContract('DexPair'), 'DexPairFooBar');
    let dexPairFooBarRoots = await dexPairFooBar.call({method: 'getTokenRoots'});
    left_root = dexPairFooBarRoots.left;
    right_root = dexPairFooBarRoots.right;
    lp_root = dexPairFooBarRoots.lp;
    await migration.balancesCheckpoint();
  })

  describe('Check pair not added already', async function () {
    it('Check DexAccount pair wallets', async function () {
      expect((await dexAccount2.call({method: 'getWalletData', params: {token_root: left_root}})).wallet)
        .to
        .equal(locklift.ton.zero_address, 'DexAccount wallet address for LeftRoot is not empty');
      expect((await dexAccount2.call({method: 'getWalletData', params: {token_root: right_root}})).wallet)
        .to
        .equal(locklift.ton.zero_address, 'DexAccount wallet address for RightRoot is not empty');
      expect((await dexAccount2.call({method: 'getWalletData', params: {token_root: lp_root}})).wallet)
        .to
        .equal(locklift.ton.zero_address, 'DexAccount wallet address for LPRoot is not empty');
    });
  });
  describe('Add new DexPair to DexAccount', async function () {
    before('Adding new pair', async function () {
      await account2.runTarget({
        contract: dexAccount2,
        method: 'addPair',
        params: {
          left_root,
          right_root,
          send_gas_to: account2.address
        },
        value: locklift.utils.convertCrystal(4, 'nano'),
        keyPair: keyPairs[1]
      });
      await logGas();
    });
    it('Check FooBar pair in DexAccount2', async function () {
      expect((await dexAccount2.call({method: 'getWalletData', params: {token_root: left_root}})).wallet)
        .to
        .not.equal(locklift.ton.zero_address, 'DexAccount wallet address for LeftRoot is empty');
      expect((await dexAccount2.call({method: 'getWalletData', params: {token_root: right_root}})).wallet)
        .to
        .not.equal(locklift.ton.zero_address, 'DexAccount wallet address for RightRoot is empty');
      expect((await dexAccount2.call({method: 'getWalletData', params: {token_root: lp_root}})).wallet)
        .to
        .not.equal(locklift.ton.zero_address, 'DexAccount wallet address for LPRoot is empty');
    });
  });
});
