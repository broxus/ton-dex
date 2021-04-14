const {expect} = require('chai');
const logger = require('mocha-logger');
const {Migration, TOKEN_CONTRACTS_PATH} = require(process.cwd() + '/scripts/utils');

if (!Array.prototype.last) {
  Array.prototype.last = function () {
    return this[this.length - 1];
  };
}

const migration = new Migration();
const EMPTY_TVM_CELL = 'te6ccgEBAQEAAgAAAA==';

const DEPOSIT_AMOUNT = 100;

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
  history: []
};
let barData = {
  aliases: {
    tokenRoot: 'BarRoot',
    vaultWallet: 'BarVaultWallet',
    accountWallet: 'BarWallet2',
  },
  history: []
};

const loadWallets = async (data) => {
  data.tokenRoot = migration.load(
    await locklift.factory.getContract('RootTokenContract', TOKEN_CONTRACTS_PATH),
    data.aliases.tokenRoot
  );
  data.vaultWallet = migration.load(
    await locklift.factory.getContract('TONTokenWallet', TOKEN_CONTRACTS_PATH), data.aliases.vaultWallet
  );
  data.vaultWalletBalance = (await data.vaultWallet.call({method: 'balance'})).toNumber();
  data.accountWallet = migration.load(
    await locklift.factory.getContract('TONTokenWallet', TOKEN_CONTRACTS_PATH), data.aliases.accountWallet
  );
  data.accountWalletBalance = (await data.accountWallet.call({method: 'balance'})).toNumber();
  data.dexAccountWallet = await locklift.factory.getContract('TONTokenWallet', TOKEN_CONTRACTS_PATH);
  const account2WalletData = await dexAccount2.call({
    method: 'getWalletData',
    params: {token_root: data.tokenRoot.address}
  });
  data.dexAccountWallet.setAddress(account2WalletData.wallet);
  data.dexAccountVirtualBalance = account2WalletData.balance.toNumber();
  data.dexAccountWalletBalance = (await data.dexAccountWallet.call({method: 'balance'})).toNumber();
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
    const change = data[key] - value;
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
  before('Load contracts and balances', async function () {
    keyPairs = await locklift.keys.getKeyPairs();
    DexAccount = await locklift.factory.getContract('DexAccount');
    account2 = migration.load(await locklift.factory.getAccount(), 'Account2');
    dexAccount2 = migration.load(DexAccount, 'DexAccount2');

    await loadWallets(fooData);
    displayBalances('Foo', fooData);

    await loadWallets(barData);
    displayBalances('Bar', barData);

  })

  describe('Check Foo make deposit to dex account', async function () {
    before('Make Foo deposit', async function () {
      await account2.runTarget({
        contract: fooData.accountWallet,
        method: 'transfer',
        params: {
          to: fooData.dexAccountWallet.address,
          tokens: DEPOSIT_AMOUNT,
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

    });
    it('Check Foo Balances after deposit', async function () {
      expect(fooData.accountWalletBalance)
        .to
        .equal(
          fooData.history.last().accountWalletBalance - DEPOSIT_AMOUNT,
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
          fooData.history.last().dexAccountVirtualBalance + DEPOSIT_AMOUNT,
          'DexAccount2 Foo has wrong balance virtual after deposit'
        );
      expect(fooData.dexAccountWalletBalance)
        .to
        .equal(0, 'DexVault Foo wallet has wrong balance after deposit');
    });
  });

  describe('Check Bar make deposit to dex account', async function () {
    before('Make Bar deposit', async function () {
      await account2.runTarget({
        contract: barData.accountWallet,
        method: 'transfer',
        params: {
          to: barData.dexAccountWallet.address,
          tokens: DEPOSIT_AMOUNT,
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

    });
    it('Check Bar Balances after deposit', async function () {
      expect(barData.accountWalletBalance)
        .to
        .equal(
          barData.history.last().accountWalletBalance - DEPOSIT_AMOUNT,
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
          barData.history.last().dexAccountVirtualBalance + DEPOSIT_AMOUNT,
          'DexAccount2 Bar has wrong balance virtual after deposit'
        );
      expect(barData.dexAccountWalletBalance)
        .to
        .equal(0, 'DexVault Bar wallet has wrong balance after deposit');
    });
  });
});
