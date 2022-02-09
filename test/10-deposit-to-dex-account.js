const {expect} = require('chai');
const logger = require('mocha-logger');
const BigNumber = require('bignumber.js');
BigNumber.config({EXPONENTIAL_AT: 257});
const {Migration, TOKEN_CONTRACTS_PATH, afterRun, EMPTY_TVM_CELL, Constants} = require(process.cwd() + '/scripts/utils');
const { Command } = require('commander');
const program = new Command();

if (!Array.prototype.last) {
  Array.prototype.last = function () {
    return this[this.length - 1];
  };
}
const migration = new Migration();

program
    .allowUnknownOption()
    .option('-o, --owner_n <owner_n>', 'owner number')
    .option('-d, --deposits <deposits>', 'deposits data');

program.parse(process.argv);

const options = program.opts();

options.owner_n = options.owner_n ? +options.owner_n : 2;

const deposits = options.deposits ? JSON.parse(options.deposits) : [
  { tokenId: 'foo', amount: 10000 },
  { tokenId: 'bar', amount: 10000 },
  { tokenId: 'tst', amount: 10000 }
];

let DexAccount;
let dexAccountN;
let accountN;
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

const loadWallets = async (data) => {
  const tokenData = Constants.tokens[data.tokenId];
  data.tokenRoot = migration.load(
    await locklift.factory.getContract('TokenRootUpgradeable', TOKEN_CONTRACTS_PATH),
    tokenData.symbol + 'Root'
  );
  data.vaultWallet = migration.load(
    await locklift.factory.getContract('TokenWalletUpgradeable', TOKEN_CONTRACTS_PATH),
    tokenData.symbol + 'VaultWallet'
  );
  data.vaultWalletBalance = new BigNumber(await data.vaultWallet.call({method: 'balance'}))
      .shiftedBy(-tokenData.decimals).toString();
  data.accountWallet = migration.load(
    await locklift.factory.getContract('TokenWalletUpgradeable', TOKEN_CONTRACTS_PATH),
    tokenData.symbol + 'Wallet' + options.owner_n
  );
  data.accountWalletBalance = new BigNumber(await data.accountWallet.call({method: 'balance'}))
      .shiftedBy(-tokenData.decimals).toString();
  data.dexAccountWallet = await locklift.factory.getContract('TokenWalletUpgradeable', TOKEN_CONTRACTS_PATH);
  const accountNWalletData = await dexAccountN.call({
    method: 'getWalletData',
    params: {token_root: data.tokenRoot.address}
  });
  data.dexAccountWallet.setAddress(accountNWalletData.wallet);
  data.dexAccountVirtualBalance = new BigNumber(accountNWalletData.balance)
      .shiftedBy(-tokenData.decimals).toString();
  data.dexAccountWalletBalance = (await data.dexAccountWallet.call({method: 'balance'}))
      .shiftedBy(-tokenData.decimals).toString();
}


const displayBalancesChanges = async (data) => {
  const oldBalances = {
    vaultWalletBalance: data.vaultWalletBalance,
    accountWalletBalance: data.accountWalletBalance,
    dexAccountVirtualBalance: data.dexAccountVirtualBalance,
    dexAccountWalletBalance: data.dexAccountWalletBalance
  };
  await loadWallets(data);
  for (const [key, value] of Object.entries(oldBalances)) {
    const change = (data[key] - value);
    logger.log(`${key}: ${change >= 0 ? '+' : ''}${change}`);
  }
  data.history.push(oldBalances);
}

const displayBalances = (tokenName, data) => {
  logger.log('='.repeat(30) + `${tokenName.toUpperCase()}` + '='.repeat(30));
  logger.log(`Root: ${data.tokenRoot.address}`);
  logger.log(`${tokenName}VaultWallet(${data.vaultWallet.address}): 
        - balance=${data.vaultWalletBalance}`);
  logger.log(`${tokenName}Wallet${options.owner_n}(${data.accountWallet.address}): 
        - balance=${data.accountWalletBalance}`);
  logger.log(`DexAccount${options.owner_n}${tokenName}Wallet(${data.dexAccountWallet.address}): 
        - balance=${data.dexAccountWalletBalance}
        - virtual_balance=${data.dexAccountVirtualBalance}`);
}


describe('Check Deposit to Dex Account', async function () {
  this.timeout(Constants.TESTS_TIMEOUT);
  before('Load contracts and balances', async function () {
    keyPairs = await locklift.keys.getKeyPairs();
    DexAccount = await locklift.factory.getContract('DexAccount');
    accountN = migration.load(await locklift.factory.getAccount('Wallet'), 'Account' + options.owner_n);
    accountN.afterRun = afterRun;
    dexAccountN = migration.load(DexAccount, 'DexAccount' + options.owner_n);

    for (const deposit of deposits) {
      deposit.history = [];
      await loadWallets(deposit);
      const tokenData = Constants.tokens[deposit.tokenId];
      displayBalances(tokenData.symbol, deposit);
    }

    await migration.balancesCheckpoint();

  })

  for (const deposit of deposits) {
    const tokenData = Constants.tokens[deposit.tokenId];
    describe(`Check ${tokenData.symbol} make deposit to dex account`, async function () {
      before(`Make ${tokenData.symbol} deposit`, async function () {
        logger.log('#################################################');
        logger.log(`# Make ${tokenData.symbol} deposit`);
        await accountN.runTarget({
          contract: deposit.accountWallet,
          method: 'transferToWallet',
          params: {
            amount: new BigNumber(deposit.amount).shiftedBy(tokenData.decimals).toString(),
            recipientTokenWallet: deposit.dexAccountWallet.address,
            remainingGasTo: accountN.address,
            notify: true,
            payload: EMPTY_TVM_CELL
          },
          value: locklift.utils.convertCrystal('0.5', 'nano'),
          keyPair: keyPairs[options.owner_n - 1]
        });
        logger.log('Foo balance changes:')
        await displayBalancesChanges(deposit);
        await logGas();
      });
      it(`Check ${tokenData.symbol} Balances after deposit`, async function () {
        expect(deposit.accountWalletBalance)
            .to
            .equal(
                new BigNumber(deposit.history.last().accountWalletBalance)
                    .minus(deposit.amount).toString(),
                `${tokenData.symbol}Wallet${options.owner_n} has wrong balance after deposit`
            );
        expect(deposit.dexAccountWalletBalance)
            .to
            .equal(
                deposit.history.last().dexAccountWalletBalance,
                `DexAccount${options.owner_n}${tokenData.symbol}Wallet has wrong balance after deposit`
            );
        expect(deposit.dexAccountVirtualBalance)
            .to
            .equal(
                new BigNumber(deposit.history.last().dexAccountVirtualBalance)
                    .plus(deposit.amount).toString(),
                `DexAccount${options.owner_n} ${tokenData.symbol} has wrong balance virtual after deposit`
            );
        expect(deposit.dexAccountWalletBalance)
            .to
            .equal('0', 'DexVault ${tokenData.symbol} wallet has wrong balance after deposit');
      });
    });
  }
});
