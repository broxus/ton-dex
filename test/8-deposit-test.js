const {expect} = require('chai');
const {Migration, TOKEN_CONTRACTS_PATH} = require('../scripts/utils')

const migration = new Migration();

let DexAccount;

let dexAccount2;
let account2;
let tokenFoo;
let fooWallet2;
let fooWallet2Balance;

describe('Check Dex Deposits', async function () {
  before('Load contracts', async function () {
    DexAccount = await locklift.factory.getContract('DexAccount');
    account2 = migration.load(await locklift.factory.getAccount(), 'Account2');
    dexAccount2 = migration.load(DexAccount, 'DexAccount2');
    tokenFoo = migration.load(
      await locklift.factory.getContract('RootTokenContract', TOKEN_CONTRACTS_PATH), 'FooRoot'
    );
    const TokenFooAccount1Wallet = await locklift.factory.getContract('TONTokenWallet', TOKEN_CONTRACTS_PATH);
    fooWallet2 = migration.load(TokenFooAccount1Wallet, 'FooWallet2');
    fooWallet2Balance = (await fooWallet2.call({method: 'balance'})).toNumber();
  })

  describe('Check initial Balances is empty', async function () {
    it('Check FooToken balance', async function () {
      const dexAccountWalletData = await dexAccount2.call({
        method: 'getWalletData',
        params: {token_root: tokenFoo.address}
      })
      expect(dexAccountWalletData.wallet)
        .to
        .equal(locklift.ton.zero_address, 'DexAccount wallet address for FooToken is not empty');
      expect(dexAccountWalletData.balance.toNumber())
        .to
        .equal(0, 'DexAccount FooToken balance is not zero');
      expect(fooWallet2Balance)
        .to
        .be.greaterThan(0, 'TokenFooAccount1Wallet balance is zero');
    });
  });
  describe('Test DexAccount returns deposit', async function () {
    it('Check FooToken balance', async function () {
      const dexAccountWalletData = await dexAccount2.call({
        method: 'getWalletData',
        params: {token_root: tokenFoo.address}
      })
      expect(dexAccountWalletData.wallet)
        .to
        .equal(locklift.ton.zero_address, 'DexAccount wallet address for FooToken is not empty');
      expect(dexAccountWalletData.balance.toNumber())
        .to
        .equal(0, 'DexAccount FooToken balance is not zero');
    });
  });
});
