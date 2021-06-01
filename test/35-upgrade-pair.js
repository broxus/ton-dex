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
    .option('-l, --left <left>', 'left root')
    .option('-r, --right <right>', 'right root')
    .option('-ocn, --old_contract_name <old_contract_name>', 'Old DexPair contract name')
    .option('-ncn, --new_contract_name <new_contract_name>', 'New DexPair contract name');

program.parse(process.argv);

const options = program.opts();

options.left = options.left || 'foo';
options.right = options.right || 'bar';
options.old_contract_name = options.old_contract_name || 'DexPair';
options.new_contract_name = options.new_contract_name || 'DexPairV2';

const tokenLeft = Constants.tokens[options.left];
const tokenRight = Constants.tokens[options.right];

let NewVersionContract;

let account;
let tokenFoo;
let tokenBar;
let dexRoot;
let dexPairFooBar;

let targetVersion;

let oldPairData = {};
let newPairData = {};

const loadPairData = async (pair) => {
  const data = {};

  data.root = await pair.call({method: 'getRoot'});
  data.vault = await pair.call({method: 'getVault'});

  data.current_version = (await pair.call({method: 'getVersion'})).toString();
  data.platform_code = await pair.call({method: 'platform_code'});

  const token_roots = await pair.call({method: 'getTokenRoots'});
  data.lp_root = token_roots.lp;
  data.left_root = token_roots.left;
  data.right_root = token_roots.right;

  data.active = await pair.call({method: 'isActive'});

  const token_wallets = await pair.call({method: 'getTokenWallets'});
  data.lp_wallet = token_wallets.lp;
  data.left_wallet = token_wallets.left;
  data.right_wallet = token_wallets.right;

  const vault_token_wallets = await pair.call({method: 'getVaultWallets'});
  data.vault_left_wallet = vault_token_wallets.left;
  data.vault_right_wallet = vault_token_wallets.right;

  const balances = await pair.call({method: 'getBalances'});
  data.lp_supply = balances.lp_supply.toString();
  data.left_balance = balances.left_balance.toString();
  data.right_balance = balances.right_balance.toString();

  const fee_params = await pair.call({method: 'getFeeParams'});
  data.fee_numerator = fee_params.numerator.toString();
  data.fee_denominator = fee_params.denominator.toString();

  return data;
}

describe('Test Dex Pair contract upgrade', async function () {
  this.timeout(Constants.TESTS_TIMEOUT);

  before('Load contracts', async function () {
    account = migration.load(await locklift.factory.getAccount('Wallet'), 'Account1');
    account.afterRun = afterRun;
    dexRoot = migration.load(await locklift.factory.getContract('DexRoot'), 'DexRoot');
    dexPairFooBar = migration.load(await locklift.factory.getContract(options.old_contract_name), 'DexPairFooBar');
    NewVersionContract = await locklift.factory.getContract(options.new_contract_name);

    targetVersion = new BigNumber(await dexRoot.call({method: 'getPairVersion'})).toNumber();


    tokenFoo = migration.load(await locklift.factory.getContract('RootTokenContract', TOKEN_CONTRACTS_PATH), tokenLeft.symbol + 'Root');
    tokenBar = migration.load(await locklift.factory.getContract('RootTokenContract', TOKEN_CONTRACTS_PATH), tokenRight.symbol + 'Root');

    const [keyPair] = await locklift.keys.getKeyPairs();

    oldPairData = await loadPairData(dexPairFooBar);
    logger.log(`Old Pair(${dexPairFooBar.address}) data:\n${JSON.stringify(oldPairData, null, 4)}`);
    logger.log(`Upgrading DexPair contract: 
        - left=${tokenFoo.address}
        - right=${tokenBar.address}
        - current version = ${oldPairData.current_version}
        - target version = ${targetVersion}`);

    await account.runTarget({
      contract: dexRoot,
      method: 'upgradePair',
      params: {
        left_root: tokenFoo.address,
        right_root: tokenBar.address,
        send_gas_to: account.address
      },
      value: locklift.utils.convertCrystal(6, 'nano'),
      keyPair
    });
    NewVersionContract.setAddress(dexPairFooBar.address);
    newPairData = await loadPairData(NewVersionContract);
    logger.log(`New Pair(${NewVersionContract.address}) data:\n${JSON.stringify(newPairData, null, 4)}`);
  })
  describe('Check DexPair after upgrade', async function () {
    if (options.new_contract_name === 'TestNewDexPair') {
      it('Check New Function', async function () {
        expect((await NewVersionContract.call({method: 'newFunc', params: {}})).toString())
            .to
            .equal("New Pair", 'DexPair new function incorrect');
      });
      }
    it('Check All data correct installed in new contract', async function () {
      expect(newPairData.root)
        .to
        .equal(oldPairData.root, 'New root value incorrect');
      expect(newPairData.vault)
        .to
        .equal(oldPairData.vault, 'New vault value incorrect');
      expect(newPairData.platform_code)
        .to
        .equal(oldPairData.platform_code, 'New platform_code value incorrect');
      expect(newPairData.current_version.toString())
        .to
        .equal(targetVersion.toString(), 'New current_version value incorrect');
      expect(newPairData.lp_root)
        .to
        .equal(oldPairData.lp_root, 'New lp_root value incorrect');
      expect(newPairData.left_root)
        .to
        .equal(oldPairData.left_root, 'New left_root value incorrect');
      expect(newPairData.right_root)
        .to
        .equal(oldPairData.right_root, 'New right_root value incorrect');
      expect(newPairData.active)
        .to
        .equal(oldPairData.active, 'New active value incorrect');
      expect(newPairData.lp_wallet)
        .to
        .equal(oldPairData.lp_wallet, 'New lp_wallet value incorrect');
      expect(newPairData.left_wallet)
        .to
        .equal(oldPairData.left_wallet, 'New left_wallet value incorrect');
      expect(newPairData.right_wallet)
        .to
        .equal(oldPairData.right_wallet, 'New right_wallet value incorrect');
      expect(newPairData.vault_left_wallet)
        .to
        .equal(oldPairData.vault_left_wallet, 'New vault_left_wallet value incorrect');
      expect(newPairData.vault_right_wallet)
        .to
        .equal(oldPairData.vault_right_wallet, 'New vault_right_wallet value incorrect');
      expect(newPairData.lp_supply)
        .to
        .equal(oldPairData.lp_supply, 'New lp_supply value incorrect');
      expect(newPairData.left_balance)
        .to
        .equal(oldPairData.left_balance, 'New left_balance value incorrect');
      expect(newPairData.right_balance)
        .to
        .equal(oldPairData.right_balance, 'New right_balance value incorrect');
      expect(newPairData.fee_numerator)
        .to
        .equal(oldPairData.fee_numerator, 'New fee_numerator value incorrect');
      expect(newPairData.fee_denominator)
        .to
        .equal(oldPairData.fee_denominator, 'New fee_denominator value incorrect');
    });
  });
});
