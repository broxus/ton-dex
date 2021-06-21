const {expect} = require('chai');
const logger = require('mocha-logger');
const {Migration, afterRun, Constants} = require(process.cwd() + '/scripts/utils')

const migration = new Migration();

let NewDexAccount;
let rootOwner;
let account2;
let dexAccount;
let dexRoot;

let oldAccountData = {};
let newAccountData = {};

const loadAccountData = async (account) => {
  const data = {};

  data.root = await account.call({method: 'getRoot'});
  data.vault = await account.call({method: 'getVault'});
  data.current_version = (await account.call({method: 'getVersion'})).toString();
  data.platform_code = await account.call({method: 'platform_code'});
  data.owner = await account.call({method: 'getOwner'});
  data.wallets = await account.call({method: 'getWallets'});
  data.balances = await account.call({method: 'getBalances'});

  return data;
}

describe('Test Dex Pair contract upgrade', async function () {
  this.timeout(Constants.TESTS_TIMEOUT);
  before('Load contracts', async function () {
    rootOwner = migration.load(await locklift.factory.getAccount('Wallet'), 'Account1');
    rootOwner.afterRun = afterRun;
    account2 = migration.load(await locklift.factory.getAccount('Wallet'), 'Account2')
    dexRoot = migration.load(await locklift.factory.getContract('DexRoot'), 'DexRoot');
    dexAccount = migration.load(await locklift.factory.getContract('DexAccount'), 'DexAccount2');
    NewDexAccount = await locklift.factory.getContract('TestNewDexAccount');

    const keyPairs = await locklift.keys.getKeyPairs();

    oldAccountData = await loadAccountData(dexAccount);
    logger.log(`Old Account(${dexAccount.address}) data:\n${JSON.stringify(oldAccountData, null, 4)}`);

    logger.log(`Installing new DexAccount contract in DexRoot: ${dexRoot.address}`);
    await rootOwner.runTarget({
      contract: dexRoot,
      method: 'installOrUpdateAccountCode',
      params: {code: NewDexAccount.code},
      value: locklift.utils.convertCrystal(1, 'nano'),
      keyPair: keyPairs[0]
    });
    logger.log(`Requesting upgrade for DexAccount contract: ${dexAccount.address}`);
    await account2.runTarget({
      contract: dexAccount,
      method: 'requestUpgrade',
      params: {send_gas_to: account2.address},
      value: locklift.utils.convertCrystal(6, 'nano'),
      keyPair: keyPairs[1]
    });
    NewDexAccount.setAddress(dexAccount.address);
    newAccountData = await loadAccountData(NewDexAccount);
    logger.log(`New Account(${NewDexAccount.address}) data:\n${JSON.stringify(newAccountData, null, 4)}`);
  })
  describe('Check DexAccount after upgrade', async function () {
    it('Check New Function', async function () {
      expect((await NewDexAccount.call({method: 'newFunc', params: {}})).toString())
        .to
        .equal("New Account", 'DexAccount new function incorrect');
    });
    it('Check All data correct installed in new contract', async function () {
      expect(newAccountData.root)
        .to
        .equal(oldAccountData.root, 'New root value incorrect');
      expect(newAccountData.vault)
        .to
        .equal(oldAccountData.vault, 'New vault value incorrect');
      expect(newAccountData.vault)
        .to
        .equal(oldAccountData.vault, 'New vault value incorrect');
      expect(newAccountData.platform_code)
        .to
        .equal(oldAccountData.platform_code, 'New platform_code value incorrect');
      expect(newAccountData.current_version)
        .to
        .equal((parseInt(oldAccountData.current_version) + 1).toString(), 'New current_version value incorrect');
      expect(newAccountData.balances)
        .to
        .deep.equal(oldAccountData.balances, 'New balances value incorrect');
      expect(newAccountData.wallets)
        .to
        .deep.equal(oldAccountData.wallets, 'New wallets value incorrect');
    });
  });
});
