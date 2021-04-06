const { expect } = require('chai');
const logger = require('mocha-logger');

const getRandomNonce = () => Math.random() * 64000 | 0;

const stringToBytesArray = (dataString) => {
  return Buffer.from(dataString).toString('hex')
};

async function sleep(ms) {
  ms = ms === undefined ? 1000 : ms;
  return new Promise(resolve => setTimeout(resolve, ms));
}

let tonTokenContractsPath = 'node_modules/ton-eth-bridge-token-contracts/free-ton/build';

let TokenFactory;
let tokenFactory;
let TokenFactoryStorage;
let RootToken;
let TONTokenWallet;
let TokenFactoryCreateNewTokenFor;
let tokenFactoryCreateNewTokenFor

describe('TokeFactory contract', async function() {
  describe('Contracts', async function() {
    it('Load contract factory', async function() {
      TokenFactory = await locklift.factory.getContract('TokenFactory');
      TokenFactoryStorage = await locklift.factory.getContract('TokenFactoryStorage');

      RootToken = await locklift.factory.getContract('RootTokenContract', tonTokenContractsPath);
      TONTokenWallet = await locklift.factory.getContract('TONTokenWallet', tonTokenContractsPath);

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

    });

    it('Deploy contract', async function() {
      this.timeout(20000);

      const [keyPair] = await locklift.keys.getKeyPairs();

      tokenFactory = await locklift.giver.deployContract({
        contract: TokenFactory,
        constructorParams: {
          storage_code_: TokenFactoryStorage.code,
          initial_owner: locklift.giver.giver.address
        },
        initParams: {
          _randomNonce: getRandomNonce(),
        },
        keyPair,
      });
      logger.log(`TokenFactory address: ${tokenFactory.address}`)

      expect(tokenFactory.address).to.be.a('string')
        .and.satisfy(s => s.startsWith('0:'), 'Bad future address');
      await sleep();

      tokenFactory.run({
        method: 'setRootCode',
        params: {root_code_: RootToken.code}
      })
      await sleep();

      tokenFactory.run({
        method: 'setWalletCode',
        params: {wallet_code_: TONTokenWallet.code}
      })
      await sleep();

      expect(await tokenFactory.call({method: 'root_code'}))
        .to
        .equal(RootToken.code, 'Wrong token root code');
      expect(await tokenFactory.call({method: 'wallet_code'}))
        .to
        .equal(TONTokenWallet.code, 'Wrong token wallet code');

      tokenFactoryCreateNewTokenFor = await locklift.giver.deployContract({
        contract: TokenFactoryCreateNewTokenFor,
        constructorParams: {factory: tokenFactory.address},
        initParams: { _randomNonce: getRandomNonce()},
        keyPair,
      }, locklift.utils.convertCrystal(100, 'nano'));
      logger.log(`TokenFactoryCreateNewTokenFor address: ${tokenFactoryCreateNewTokenFor.address}`)
    });

    it('Interact with contract', async function() {
      this.timeout(20000);
      const answer_id = 0;
      await tokenFactoryCreateNewTokenFor.run({
        method: 'newToken',
        params: {
          answer_id: answer_id,
          value: locklift.utils.convertCrystal(10, 'nano'),
          owner: tokenFactoryCreateNewTokenFor.address,
          name: stringToBytesArray('Test'),
          symbol: stringToBytesArray('TST'),
          decimals: 3
        }
        })
      await sleep();
      const deployedTokenRoot = await tokenFactoryCreateNewTokenFor.call({
        method: 'getDeployedToken',
        params: {answer_id: answer_id}
      });
      logger.log(`Deployed TokenRoot: ${deployedTokenRoot}`)
      expect(deployedTokenRoot)
        .to.be.a('string')
        .and
        .not.equal('0:'+'0'.repeat(64), 'Bad Token Root address');
    });
  });
});
