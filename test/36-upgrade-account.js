const {expect} = require('chai');
const logger = require('mocha-logger');
const BigNumber = require('bignumber.js');
BigNumber.config({EXPONENTIAL_AT: 257});
const {Migration, TOKEN_CONTRACTS_PATH, afterRun, Constants} = require(process.cwd() + '/scripts/utils');
const { Command } = require('commander');
const program = new Command();

const migration = new Migration();

program
    .allowUnknownOption()
    .option('-o, --owner_n <owner_n>', 'owner number')
    .option('-ocn, --old_contract_name <old_contract_name>', 'Old DexAccount contract name')
    .option('-ncn, --new_contract_name <new_contract_name>', 'New DexAccount contract name');

program.parse(process.argv);

const options = program.opts();

options.owner_n = options.owner_n ? +options.owner_n : 1;
options.old_contract_name = options.old_contract_name || 'DexAccount';
options.new_contract_name = options.new_contract_name || 'DexAccountV2';

let NewDexAccount;
let rootOwner;
let accountN;
let dexAccountN;
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
describe('Test DexAccount contract upgrade', async function () {
  this.timeout(Constants.TESTS_TIMEOUT);

  before('Load contracts', async function () {
    accountN = migration.load(await locklift.factory.getAccount('Wallet'), 'Account' + options.owner_n);
    rootOwner = migration.load(await locklift.factory.getAccount('Wallet'), 'Account1');
    accountN.afterRun = afterRun;
    dexRoot = migration.load(await locklift.factory.getContract('DexRoot'), 'DexRoot');
    dexAccountN = migration.load(await locklift.factory.getContract(options.old_contract_name), 'DexAccount' + options.owner_n);
    rootOwner = migration.load(await locklift.factory.getAccount('Wallet'), 'Account1');
    rootOwner.afterRun = afterRun;
    dexRoot = migration.load(await locklift.factory.getContract('DexRoot'), 'DexRoot');
    NewDexAccount = await locklift.factory.getContract(options.new_contract_name);

    const keyPairs = await locklift.keys.getKeyPairs();

    oldAccountData = await loadAccountData(dexAccountN);
    logger.log(`Old Account(${dexAccountN.address}) data:\n${JSON.stringify(oldAccountData, null, 4)}`);

    logger.log(`Requesting upgrade for DexAccount contract: ${dexAccountN.address}`);
    await accountN.runTarget({
      contract: dexAccountN,
      method: 'requestUpgrade',
      params: {send_gas_to: accountN.address},
      value: locklift.utils.convertCrystal(6, 'nano'),
      keyPair: keyPairs[options.owner_n - 1]
    });
    NewDexAccount.setAddress(dexAccountN.address);
    newAccountData = await loadAccountData(NewDexAccount);
    logger.log(`New Account(${NewDexAccount.address}) data:\n${JSON.stringify(newAccountData, null, 4)}`);
  })
  describe('Check DexAccount after upgrade', async function () {
    // it('Check New Function', async function () {
    //   expect((await NewDexAccount.call({method: 'newFunc', params: {}})).toString())
    //       .to
    //       .equal("New Account", 'DexAccount new function incorrect');
    // });
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
