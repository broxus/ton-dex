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
    .option('-d, --deposits <deposits>', 'deposits data');

program.parse(process.argv);

const options = program.opts();

const deposits = options.deposits ? JSON.parse(options.deposits) : [
  { tokenId: 'foo', amount: 10000 },
  { tokenId: 'bar', amount: 10000 },
  { tokenId: 'tst', amount: 10000 }
];

let DexAccount;
let dexAccount2;
let account2;
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
    await locklift.factory.getContract('RootTokenContract', TOKEN_CONTRACTS_PATH),
    tokenData.symbol + 'Root'
  );
  data.vaultWallet = migration.load(
    await locklift.factory.getContract('TONTokenWallet', TOKEN_CONTRACTS_PATH),
    tokenData.symbol + 'VaultWallet'
  );
  data.vaultWalletBalance = new BigNumber(await data.vaultWallet.call({method: 'balance'}))
      .shiftedBy(-tokenData.decimals).toString();
  data.accountWallet = migration.load(
    await locklift.factory.getContract('TONTokenWallet', TOKEN_CONTRACTS_PATH),
    tokenData.symbol + 'Wallet2'
  );
  data.accountWalletBalance = new BigNumber(await data.accountWallet.call({method: 'balance'}))
      .shiftedBy(-tokenData.decimals).toString();
  data.dexAccountWallet = await locklift.factory.getContract('TONTokenWallet', TOKEN_CONTRACTS_PATH);
  const account2WalletData = await dexAccount2.call({
    method: 'getWalletData',
    params: {token_root: data.tokenRoot.address}
  });
  data.dexAccountWallet.setAddress(account2WalletData.wallet);
  data.dexAccountVirtualBalance = new BigNumber(account2WalletData.balance)
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
  logger.log(`${tokenName}Wallet2(${data.accountWallet.address}): 
        - balance=${data.accountWalletBalance}`);
  logger.log(`DexAccount2${tokenName}Wallet(${data.dexAccountWallet.address}): 
        - balance=${data.dexAccountWalletBalance}
        - virtual_balance=${data.dexAccountVirtualBalance}`);
}


describe('Check Deposit to Dex Account', async function () {
  this.timeout(Constants.TESTS_TIMEOUT);
  before('Load contracts and balances', async function () {
    keyPairs = await locklift.keys.getKeyPairs();
    DexAccount = await locklift.factory.getContract('DexAccount');
    account2 = migration.load(await locklift.factory.getAccount('Wallet'), 'Account2');
    account2.afterRun = afterRun;
    dexAccount2 = migration.load(DexAccount, 'DexAccount2');

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
        await account2.runTarget({
          contract: deposit.accountWallet,
          method: 'transfer',
          params: {
            to: deposit.dexAccountWallet.address,
            tokens: new BigNumber(deposit.amount).shiftedBy(tokenData.decimals).toString(),
            grams: 0,
            send_gas_to: account2.address,
            notify_receiver: true,
            payload: EMPTY_TVM_CELL
          },
          value: locklift.utils.convertCrystal('0.5', 'nano'),
          keyPair: keyPairs[1]
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
                `${tokenData.symbol}Wallet2 has wrong balance after deposit`
            );
        expect(deposit.dexAccountWalletBalance)
            .to
            .equal(
                deposit.history.last().dexAccountWalletBalance,
                'DexAccount2FooWallet has wrong balance after deposit'
            );
        expect(deposit.dexAccountVirtualBalance)
            .to
            .equal(
                new BigNumber(deposit.history.last().dexAccountVirtualBalance)
                    .plus(deposit.amount).toString(),
                'DexAccount2 Foo has wrong balance virtual after deposit'
            );
        expect(deposit.dexAccountWalletBalance)
            .to
            .equal('0', 'DexVault Foo wallet has wrong balance after deposit');
      });
    });
  }
});
