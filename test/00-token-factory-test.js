const {expect} = require('chai');
const logger = require('mocha-logger');
const {
  getRandomNonce,
  Migration,
  stringToBytesArray,
  TOKEN_CONTRACTS_PATH,
  Constants,
  afterRun
} = require(process.cwd() + '/scripts/utils')

const BigNumber = require('bignumber.js');
BigNumber.config({EXPONENTIAL_AT: 257});

const migration = new Migration();

let TokenFactory;
let tokenFactory;
let TokenRoot;
let TokenWallet;
let TokenWalletPlatform;
let account;


async function latestCreatedRoot() {
    const {
        result
    } = await locklift.ton.client.net.query_collection({
        collection: 'messages',
        filter: {
            src: {eq: tokenFactory.address},
            msg_type: {eq: 2}
        },
        order: [{path: 'created_at', direction: "DESC"}, {path: 'created_lt', direction: "DESC"}],
        limit: 1,
        result: 'body id src created_at created_lt'
    });

    const decodedMessage = await locklift.ton.client.abi.decode_message_body({
      abi: {
        type: 'Contract',
        value: tokenFactory.abi
      },
      body: result[0].body,
      is_internal: false
    });

    return decodedMessage.value.tokenRoot;
}

describe('TokeFactory contract', async function () {
  this.timeout(Constants.TESTS_TIMEOUT);
  describe('Contracts', async function () {
    it('Load contract factory', async function () {
      TokenFactory = await locklift.factory.getContract('TokenFactory');

      TokenRoot = await locklift.factory.getContract('TokenRootUpgradeable', TOKEN_CONTRACTS_PATH);
      TokenWallet = await locklift.factory.getContract('TokenWalletUpgradeable', TOKEN_CONTRACTS_PATH);
      TokenWalletPlatform = await locklift.factory.getContract('TokenWalletPlatform', TOKEN_CONTRACTS_PATH);

      expect(TokenFactory.code)
        .not.to.equal(undefined, 'TokenFactory Code should be available');
      expect(TokenFactory.abi)
        .not.to.equal(undefined, 'TokenFactory ABI should be available');

      expect(TokenRoot.abi)
        .not.to.equal(undefined, 'TokenRoot ABI should be available');
      expect(TokenFactory.code)
        .not.to.equal(undefined, 'TokenRoot Code should be available');

      expect(TokenWallet.abi)
        .not.to.equal(undefined, 'TokenWallet ABI should be available');
      expect(TokenWallet.code)
        .not.to.equal(undefined, 'TokenWallet Code should be available');

      expect(TokenWalletPlatform.abi)
        .not.to.equal(undefined, 'TokenWalletPlatform ABI should be available');
      expect(TokenWalletPlatform.code)
        .not.to.equal(undefined, 'TokenWalletPlatform Code should be available');

      tokenFactory = migration.load(TokenFactory, 'TokenFactory');
      account = migration.load(await locklift.factory.getAccount('Wallet'), 'Account1');
      const [keyPair] = await locklift.keys.getKeyPairs();
      account.setKeyPair(keyPair);
      account.afterRun = afterRun;

      logger.log(`TokenFactory address: ${tokenFactory.address}`)
    });

    it('Check deployed contracts', async function () {
      expect(tokenFactory.address).to.be.a('string')
        .and.satisfy(s => s.startsWith('0:'), 'Bad future address');
      expect(await tokenFactory.call({method: 'rootCode', params: {}}))
        .to
        .equal(TokenRoot.code, 'Wrong token root code');
      expect(await tokenFactory.call({method: 'walletCode', params: {}}))
        .to
        .equal(TokenWallet.code, 'Wrong token wallet code');
      expect(await tokenFactory.call({method: 'walletPlatformCode', params: {}}))
          .to
          .equal(TokenWalletPlatform.code, 'Wrong platform code');
    });

    it('Interact with contract', async function () {
      let tokensToCreate = [
        {
          name: 'Test 1',
          symbol: 'TST1',
          decimals: 3,
          owner: account.address,
          amount: 10,
          mintDisabled: false,
          burnByRootDisabled: false,
          burnPaused: false,
          initialSupplyTo: locklift.utils.zeroAddress,
          initialSupply: '0',
          deployWalletValue: '0',
          contract: null
        },
        {
          name: 'Test 2',
          symbol: 'TST2',
          decimals: 4,
          owner: account.address,
          amount: 10,
          mintDisabled: true,
          burnByRootDisabled: true,
          burnPaused: true,
          initialSupplyTo: account.address,
          initialSupply: '100',
          deployWalletValue: locklift.utils.convertCrystal(0.1, 'nano'),
          contract: null
        }
      ];

      for (const tokenData of tokensToCreate) {
        let index = tokensToCreate.indexOf(tokenData);

        await account.runTarget({
          contract: tokenFactory,
          method: 'createToken',
          params: {
            callId: index,
            name: tokenData.name,
            symbol: tokenData.symbol,
            decimals: tokenData.decimals,
            initialSupplyTo: tokenData.initialSupplyTo,
            initialSupply: new BigNumber(tokenData.initialSupply).shiftedBy(tokenData.decimals).toString(),
            deployWalletValue: tokenData.deployWalletValue,
            mintDisabled: tokenData.mintDisabled,
            burnByRootDisabled: tokenData.burnByRootDisabled,
            burnPaused: tokenData.burnPaused,
            remainingGasTo: account.address
          },
          value: locklift.utils.convertCrystal(3, 'nano'),
        });

        await afterRun();

        const deployedTokenRoot = await latestCreatedRoot();
        logger.log(`Deployed ${tokenData.symbol}: ${deployedTokenRoot}`)

        expect(deployedTokenRoot)
          .to.be.a('string')
          .and
          .not.equal(locklift.ton.zero_address, 'Bad Token Root address');
        let deployedTokenRootContract = await locklift.factory.getContract('TokenRootUpgradeable', TOKEN_CONTRACTS_PATH);
        deployedTokenRootContract.setAddress(deployedTokenRoot);

        const name = await deployedTokenRootContract.call({ method: 'name', params: {}});
        const symbol = await deployedTokenRootContract.call({ method: 'symbol', params: {}});
        const decimals = await deployedTokenRootContract.call({ method: 'decimals', params: {}});
        const owner = await deployedTokenRootContract.call({ method: 'rootOwner', params: {}});
        const mintDisabled = await deployedTokenRootContract.call({ method: 'mintDisabled', params: {}});
        const burnByRootDisabled = await deployedTokenRootContract.call({ method: 'burnByRootDisabled', params: {}});
        const burnPaused = await deployedTokenRootContract.call({ method: 'burnPaused', params: {}});

        const walletCode = await deployedTokenRootContract.call({ method: 'walletCode', params: {}});
        const platformCode = await deployedTokenRootContract.call({ method: 'platformCode', params: {}});

        if (tokenData.initialSupplyTo !== locklift.utils.zeroAddress) {
          const totalSupply = await deployedTokenRootContract.call({ method: 'totalSupply', params: {}});
          const wallet = await deployedTokenRootContract.call({ method: 'walletOf', params: {
            walletOwner: tokenData.initialSupplyTo
          }});
          TokenWallet.setAddress(wallet);
          const balance = await TokenWallet.call({ method: 'balance', params: {}});

          expect(new BigNumber(tokenData.initialSupply).shiftedBy(tokenData.decimals).toString())
            .to
            .equal(totalSupply.toString(), 'Wrong totalSupply in deployed Token');
          expect(new BigNumber(tokenData.initialSupply).shiftedBy(tokenData.decimals).toString())
            .to
            .equal(balance.toString(), 'Wrong initialSupply of deployed Token');
        }

        expect(name)
          .to
          .equal(tokenData.name, 'Wrong Token name in deployed Token');
        expect(symbol)
          .to
          .equal(tokenData.symbol, 'Wrong Token symbol in deployed Token');
        expect(decimals.toNumber())
            .to
            .equal(tokenData.decimals, 'Wrong Token decimals in deployed Token');
        expect(owner)
            .to
            .equal(tokenData.owner, 'Wrong Token owner in deployed Token');
        expect(mintDisabled)
            .to
            .equal(tokenData.mintDisabled, 'Wrong Token owner in deployed Token');
        expect(burnByRootDisabled)
            .to
            .equal(tokenData.burnByRootDisabled, 'Wrong Token owner in deployed Token');
        expect(burnPaused)
            .to
            .equal(tokenData.burnPaused, 'Wrong Token owner in deployed Token');
        expect(walletCode)
          .to
          .equal(TokenWallet.code, 'Wrong Token Wallet code in deployed Token');
        expect(platformCode)
            .to
            .equal(TokenWalletPlatform.code, 'Wrong Platform code in deployed Token');
      }
    });
  });
});
