const {expect} = require('chai');
const logger = require('mocha-logger');
const {
  getRandomNonce,
  Migration,
  stringToBytesArray,
  sleep,
  TOKEN_CONTRACTS_PATH
} = require(process.cwd() + '/scripts/utils')

const migration = new Migration();

let TokenFactory;
let tokenFactory;
let TokenFactoryStorage;
let RootToken;
let TONTokenWallet;
let TokenFactoryCreateNewTokenFor;
let tokenFactoryCreateNewTokenFor
let account;

describe('TokeFactory contract', async function () {
  describe('Contracts', async function () {
    it('Load contract factory', async function () {
      TokenFactory = await locklift.factory.getContract('TokenFactory');
      TokenFactoryStorage = await locklift.factory.getContract('TokenFactoryStorage');

      RootToken = await locklift.factory.getContract('RootTokenContract', TOKEN_CONTRACTS_PATH);
      TONTokenWallet = await locklift.factory.getContract('TONTokenWallet', TOKEN_CONTRACTS_PATH);

      TokenFactoryCreateNewTokenFor = await locklift.factory.getContract('TokenFactoryCreateNewTokenFor');

      expect(TokenFactory.code)
        .not.to.equal(undefined, 'TokenFactory Code should be available');
      expect(TokenFactory.abi)
        .not.to.equal(undefined, 'TokenFactory ABI should be available');

      expect(TokenFactoryStorage.code)
        .not.to.equal(undefined, 'TokenFactoryStorage Code should be available');
      expect(TokenFactoryStorage.abi)
        .not.to.equal(undefined, 'TokenFactoryStorage ABI should be available');

      expect(RootToken.abi)
        .not.to.equal(undefined, 'RootToken ABI should be available');
      expect(TokenFactory.code)
        .not.to.equal(undefined, 'RootToken Code should be available');

      expect(TONTokenWallet.abi)
        .not.to.equal(undefined, 'TONTokenWallet ABI should be available');
      expect(TONTokenWallet.code)
        .not.to.equal(undefined, 'TONTokenWallet Code should be available');

      tokenFactory = migration.load(TokenFactory, 'TokenFactory');
      account = migration.load(await locklift.factory.getAccount(), 'Account1');

      logger.log(`TokenFactory address: ${tokenFactory.address}`)
    });

    it('Check deployed contracts', async function () {
      expect(tokenFactory.address).to.be.a('string')
        .and.satisfy(s => s.startsWith('0:'), 'Bad future address');
      expect(await tokenFactory.call({method: 'root_code'}))
        .to
        .equal(RootToken.code, 'Wrong token root code');
      expect(await tokenFactory.call({method: 'wallet_code'}))
        .to
        .equal(TONTokenWallet.code, 'Wrong token wallet code');
    });

    it('Deploy contracts for tests', async function () {
      this.timeout(20000);

      const [keyPair] = await locklift.keys.getKeyPairs();

      tokenFactoryCreateNewTokenFor = await locklift.giver.deployContract({
        contract: TokenFactoryCreateNewTokenFor,
        constructorParams: {factory: tokenFactory.address},
        initParams: {_randomNonce: getRandomNonce()},
        keyPair,
      }, locklift.utils.convertCrystal(100, 'nano'));

      logger.log(`TokenFactoryCreateNewTokenFor address: ${tokenFactoryCreateNewTokenFor.address}`)
    });

    it('Interact with contract', async function () {
      this.timeout(200000);
      let tokensToCreate = [
        {
          name: 'Test1',
          symbol: 'TST1',
          decimals: 3,
          owner: tokenFactoryCreateNewTokenFor.address,
          amount: 10
        },
        {
          name: 'Test2',
          symbol: 'TST2',
          decimals: 4,
          owner: tokenFactoryCreateNewTokenFor.address,
          amount: 10
        }
      ]
      for (const tokenData of tokensToCreate) {
        let index = tokensToCreate.indexOf(tokenData);
        await tokenFactoryCreateNewTokenFor.run({
          method: 'newToken',
          params: {
            answer_id: index,
            value: locklift.utils.convertCrystal(tokenData.amount, 'nano'),
            owner: tokenData.owner,
            name: stringToBytesArray(tokenData.name),
            symbol: stringToBytesArray(tokenData.symbol),
            decimals: tokenData.decimals
          }
        })
        await sleep();
        const deployedTokenRoot = await tokenFactoryCreateNewTokenFor.call({
          method: 'getDeployedToken',
          params: {answer_id: index}
        });
        logger.log(`Deployed TokenRoot: ${deployedTokenRoot}`)

        expect(deployedTokenRoot)
          .to.be.a('string')
          .and
          .not.equal(locklift.ton.zero_address, 'Bad Token Root address');
        let deployedTokenRootContract = RootToken;
        deployedTokenRootContract.setAddress(deployedTokenRoot);
        const deployedTokenRootDetails = await deployedTokenRootContract.call({
          method: 'getDetails',
          params: {'_answer_id': 0}
        })
        expect(deployedTokenRootDetails.name.toString())
          .to
          .equal(tokenData.name, 'Wrong Token name in deployed Token');
        expect(deployedTokenRootDetails.symbol.toString())
          .to
          .equal(tokenData.symbol, 'Wrong Token symbol in deployed Token');
        expect(deployedTokenRootDetails.decimals.toNumber())
          .to
          .equal(tokenData.decimals, 'Wrong Token decimals in deployed Token');
        expect(deployedTokenRootDetails.wallet_code)
          .to
          .equal(TONTokenWallet.code, 'Wrong Token Wallet code in deployed Token');
        expect(deployedTokenRootDetails.root_owner_address)
          .to
          .equal(tokenData.owner, 'Wrong Token owner in deployed Token');
      }
    });
  });
});
