const {expect} = require('chai');
const logger = require('mocha-logger');
const {Migration, TOKEN_CONTRACTS_PATH, Constants, afterRun, getRandomNonce} = require(process.cwd() + '/scripts/utils');
const BigNumber = require('bignumber.js');
BigNumber.config({EXPONENTIAL_AT: 257});

const migration = new Migration();

const TRANSFER_AMOUNT = new BigNumber(10).times(new BigNumber(10).pow(Constants.FOO_DECIMALS)).toString();

let DexAccount;

let dexRoot;
let fooRoot;
let barRoot;
let account2;
let account3;
let dexAccount2;
let dexAccount3Address;
let keyPairs;
let dexAccount2FooInitialBalance;
let dexAccount2BarInitialBalance;

const getDexAccountBalance = async (tokenRoot) => {
  return (await dexAccount2.call({
    method: 'getWalletData',
    params: {token_root: tokenRoot.address}
  })).balance.toNumber();
};


describe('Check Dex Account transfer to Dex Account which not exist', async function () {
  this.timeout(Constants.TESTS_TIMEOUT);
  before('Load contracts', async function () {
    keyPairs = await locklift.keys.getKeyPairs();
    dexRoot = migration.load(await locklift.factory.getContract('DexRoot'), 'DexRoot');
    fooRoot = migration.load(
      await locklift.factory.getContract('TokenRootUpgradeable', TOKEN_CONTRACTS_PATH),
      'FooRoot'
    );
    barRoot = migration.load(
      await locklift.factory.getContract('TokenRootUpgradeable', TOKEN_CONTRACTS_PATH),
      'BarRoot'
    );
    DexAccount = await locklift.factory.getContract('DexAccount');
    account2 = migration.load(await locklift.factory.getAccount('Wallet'), 'Account2');
    account2.afterRun = afterRun;
    account3 = migration.load(await locklift.factory.getAccount('Wallet'), 'Account3');
    dexAccount2 = migration.load(DexAccount, 'DexAccount2');
    dexAccount3Address = await dexRoot.call({
      method: 'getExpectedAccountAddress',
      params: {account_owner: account3.address}
    });
    dexAccount2FooInitialBalance = await getDexAccountBalance(fooRoot);
    dexAccount2BarInitialBalance = await getDexAccountBalance(barRoot);
    logger.log(`DexAccount#2 Balances:
        - Foo: ${dexAccount2FooInitialBalance}
        - Bar: ${dexAccount2BarInitialBalance}`);
  })

  describe('Check transfer to non exists account', async function () {
    before('Make transfer to non exists account', async function () {
      const runTargetTx = await account2.runTarget({
        contract: dexAccount2,
        method: 'transfer',
        params: {
          call_id: getRandomNonce(),
          amount: TRANSFER_AMOUNT,
          token_root: fooRoot.address,
          recipient: account3,
          willing_to_deploy: true,
          send_gas_to: account2.address
        },
        value: locklift.utils.convertCrystal('1.1', 'nano'),
        keyPair: keyPairs[1]
      });
    });
    it('Check transfer is bounced', async function () {
      expect(await getDexAccountBalance(fooRoot))
        .to
        .equal(dexAccount2FooInitialBalance, 'DexAccount wallet address for LeftRoot is empty');
    });
  });
});
