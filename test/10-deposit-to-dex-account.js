const {expect} = require('chai');
const logger = require('mocha-logger');
const BigNumber = require('bignumber.js');
BigNumber.config({EXPONENTIAL_AT: 257});
const {Migration, TOKEN_CONTRACTS_PATH, afterRun, EMPTY_TVM_CELL, Constants} = require(process.cwd() + '/scripts/utils');

if (!Array.prototype.last) {
  Array.prototype.last = function () {
    return this[this.length - 1];
  };
}
const migration = new Migration();

let DexAccount;
let dexAccount2;
let account2;
let keyPairs;
let fooData = {
  aliases: {
    tokenRoot: 'FooRoot',
    vaultWallet: 'FooVaultWallet',
    accountWallet: 'FooWallet2',
  },
  history: [],
  decimals: Constants.FOO_DECIMALS,
  decimals_modifier: Constants.FOO_DECIMALS_MODIFIER,
  deposit_amount: new BigNumber(10000).times(Constants.FOO_DECIMALS_MODIFIER)
};
let barData = {
  aliases: {
    tokenRoot: 'BarRoot',
    vaultWallet: 'BarVaultWallet',
    accountWallet: 'BarWallet2',
  },
  history: [],
  decimals: Constants.BAR_DECIMALS,
  decimals_modifier: Constants.BAR_DECIMALS_MODIFIER,
  deposit_amount: new BigNumber(10000).times(Constants.BAR_DECIMALS_MODIFIER)


};

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
  data.tokenRoot = migration.load(
    await locklift.factory.getContract('RootTokenContract', TOKEN_CONTRACTS_PATH),
    data.aliases.tokenRoot
  );
  data.vaultWallet = migration.load(
    await locklift.factory.getContract('TONTokenWallet', TOKEN_CONTRACTS_PATH), data.aliases.vaultWallet
  );
  data.vaultWalletBalance = new BigNumber(await data.vaultWallet.call({method: 'balance'}))
    .div(data.decimals_modifier).toString();
  data.accountWallet = migration.load(
    await locklift.factory.getContract('TONTokenWallet', TOKEN_CONTRACTS_PATH), data.aliases.accountWallet
  );
  data.accountWalletBalance = new BigNumber(await data.accountWallet.call({method: 'balance'}))
    .div(data.decimals_modifier).toString();
  data.dexAccountWallet = await locklift.factory.getContract('TONTokenWallet', TOKEN_CONTRACTS_PATH);
  const account2WalletData = await dexAccount2.call({
    method: 'getWalletData',
    params: {token_root: data.tokenRoot.address}
  });
  data.dexAccountWallet.setAddress(account2WalletData.wallet);
  data.dexAccountVirtualBalance = new BigNumber(account2WalletData.balance).div(data.decimals_modifier).toString();
  data.dexAccountWalletBalance = (await data.dexAccountWallet.call({method: 'balance'})).toString();
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
    account2 = migration.load(await locklift.factory.getAccount(), 'Account2');
    account2.afterRun = afterRun;
    dexAccount2 = migration.load(DexAccount, 'DexAccount2');

    await loadWallets(fooData);
    displayBalances('Foo', fooData);

    await loadWallets(barData);
    displayBalances('Bar', barData);

    await migration.balancesCheckpoint();

  })

  describe('Check Foo make deposit to dex account', async function () {
    before('Make Foo deposit', async function () {
      logger.log('#################################################');
      logger.log('# Make Foo deposit');
      await account2.runTarget({
        contract: fooData.accountWallet,
        method: 'transfer',
        params: {
          to: fooData.dexAccountWallet.address,
          tokens: fooData.deposit_amount.toString(),
          grams: 0,
          send_gas_to: account2.address,
          notify_receiver: true,
          payload: EMPTY_TVM_CELL
        },
        value: locklift.utils.convertCrystal('0.5', 'nano'),
        keyPair: keyPairs[1]
      });
      logger.log('Foo balance changes:')
      await displayBalancesChanges(fooData);
      await logGas();
    });
    it('Check Foo Balances after deposit', async function () {
      expect(fooData.accountWalletBalance)
        .to
        .equal(
          new BigNumber(fooData.history.last().accountWalletBalance)
            .minus(fooData.deposit_amount.div(fooData.decimals_modifier)).toString(),
          'FooWallet2 has wrong balance after deposit'
        );
      expect(fooData.dexAccountWalletBalance)
        .to
        .equal(
          fooData.history.last().dexAccountWalletBalance,
          'DexAccount2FooWallet has wrong balance after deposit'
        );
      expect(fooData.dexAccountVirtualBalance)
        .to
        .equal(
          new BigNumber(fooData.history.last().dexAccountVirtualBalance)
            .plus(fooData.deposit_amount.div(fooData.decimals_modifier)).toString(),
          'DexAccount2 Foo has wrong balance virtual after deposit'
        );
      expect(fooData.dexAccountWalletBalance)
        .to
        .equal('0', 'DexVault Foo wallet has wrong balance after deposit');
    });
  });

  describe('Check Bar make deposit to dex account', async function () {
    before('Make Bar deposit', async function () {
      logger.log('#################################################');
      logger.log('# Make Bar deposit');
      await account2.runTarget({
        contract: barData.accountWallet,
        method: 'transfer',
        params: {
          to: barData.dexAccountWallet.address,
          tokens: barData.deposit_amount.toString(),
          grams: 0,
          send_gas_to: account2.address,
          notify_receiver: true,
          payload: EMPTY_TVM_CELL
        },
        value: locklift.utils.convertCrystal('0.5', 'nano'),
        keyPair: keyPairs[1]
      });
      logger.log('Bar balance changes:')
      await displayBalancesChanges(barData);
      await logGas();

    });
    it('Check Bar Balances after deposit', async function () {
      expect(barData.accountWalletBalance)
        .to
        .equal(
          new BigNumber(barData.history.last().accountWalletBalance)
            .minus(barData.deposit_amount.div(barData.decimals_modifier)).toString(),
          'BarWallet2 has wrong balance after deposit'
        );
      expect(barData.dexAccountWalletBalance)
        .to
        .equal(
          barData.history.last().dexAccountWalletBalance,
          'DexAccount2BarWallet has wrong balance after deposit'
        );
      expect(barData.dexAccountVirtualBalance)
        .to
        .equal(
          new BigNumber(barData.history.last().dexAccountVirtualBalance)
            .plus(barData.deposit_amount.div(barData.decimals_modifier)).toString(),
          'DexAccount2 Bar has wrong balance virtual after deposit'
        );
      expect(barData.dexAccountWalletBalance)
        .to
        .equal('0', 'DexVault Bar wallet has wrong balance after deposit');
    });
  });
});
