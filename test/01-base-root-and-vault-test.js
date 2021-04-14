const {expect} = require('chai');
const {Migration} = require(process.cwd()+'/scripts/utils')

const migration = new Migration();

let DexRoot;
let DexVault;
let DexPlatform;
let DexAccount;
let DexPair;
let TokenFactory;
let DexVaultLpTokenPending;

let dexRoot;
let dexVault;
let tokenFactory;

describe('Check for correct deployment', async function () {
  before('Load contracts', async function () {
    DexRoot = await locklift.factory.getContract('DexRoot');
    DexVault = await locklift.factory.getContract('DexVault');
    DexPlatform = await locklift.factory.getContract('DexPlatform');
    DexAccount = await locklift.factory.getContract('DexAccount');
    DexPair = await locklift.factory.getContract('DexPair');
    TokenFactory = await locklift.factory.getContract('TokenFactory');
    DexVaultLpTokenPending = await locklift.factory.getContract('DexVaultLpTokenPending');

    dexRoot = migration.load(DexRoot, 'DexRoot');
    dexVault = migration.load(DexVault, 'DexVault');
    tokenFactory = migration.load(TokenFactory, 'TokenFactory');

  })
  describe('Check DexRoot', async function () {
    it('Check DexRoot deployed', async function () {
      expect((await locklift.ton.getAccountType(dexRoot.address)).acc_type)
        .to
        .equal(1, 'DexRoot Account not Active');
    });
    it('Check Platform code is installed', async function () {
      expect(await dexRoot.call({method: 'platform_code'}))
        .to
        .equal(DexPlatform.code, 'Wrong platform code in DexRoot');
    });
    it('Check Account code is installed', async function () {
      expect(await dexRoot.call({method: 'account_code'}))
        .to
        .equal(DexAccount.code, 'Wrong Account code in DexRoot');
    });
    it('Check Pair code is installed', async function () {
      expect(await dexRoot.call({method: 'pair_code'}))
        .to
        .equal(DexPair.code, 'Wrong Pair code in DexRoot');
    });
    it('Check Vault address', async function () {
      expect(await dexRoot.call({method: 'getVault', params: {_answer_id: 0}}))
        .to
        .equal(dexVault.address, 'Wrong DexVault address in DexRoot');
    });
    it('Check is Dex Active', async function () {
      expect(await dexRoot.call({method: 'isActive', params: {_answer_id: 0}}))
        .to
        .equal(true, 'DexRoot is not Active');
    });
  });
  describe('Check DexVault', async function () {
    it('Check DexVault deployed', async function () {
      expect((await locklift.ton.getAccountType(dexVault.address)).acc_type)
        .to
        .equal(1, 'DexVault Account not Active');
    });
    it('Check Platform code is installed', async function () {
      expect(await dexVault.call({method: 'platform_code'}))
        .to
        .equal(DexPlatform.code, 'Wrong platform code in DexVault');
    });
    it('Check Root address', async function () {
      expect(await dexVault.call({method: 'root'}))
        .to
        .equal(dexRoot.address, 'Wrong DexRoot address in DexVault');
    });
    it('Check TokenFactory address', async function () {
      expect(await dexVault.call({method: 'token_factory'}))
        .to
        .equal(tokenFactory.address, 'Wrong TokenFactory address in DexVault');
    });
    it('Check DexVaultLpTokenPending code is installed', async function () {
      expect(await dexVault.call({method: 'lp_token_pending_code'}))
        .to
        .equal(DexVaultLpTokenPending.code, 'Wrong DexVaultLpTokenPending code in DexVault');
    });
  });

});
