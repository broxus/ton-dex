const {getRandomNonce, Migration, tonTokenContractsPath} = require('../../../../../scripts/utils')

async function main() {
  const migration = new Migration();
  const account = migration.load(await locklift.factory.getAccount(), 'Account0');

  const TokenFactory = await locklift.factory.getContract('TokenFactory');
  const TokenFactoryStorage = await locklift.factory.getContract('TokenFactoryStorage');

  const RootToken = await locklift.factory.getContract('RootTokenContract', tonTokenContractsPath);
  const TONTokenWallet = await locklift.factory.getContract('TONTokenWallet', tonTokenContractsPath);

  const [keyPair] = await locklift.keys.getKeyPairs();

  const tokenFactory = await locklift.giver.deployContract({
    contract: TokenFactory,
    constructorParams: {
      storage_code_: TokenFactoryStorage.code,
      initial_owner: account.address
    },
    initParams: {
      _nonce: getRandomNonce(),
    },
    keyPair,
  });
  migration.store(tokenFactory, 'TokenFactory');

  console.log(`TokenFactory: ${tokenFactory.address}`);

  await account.runTarget({
    contract: tokenFactory,
    method: 'setRootCode',
    params: {root_code_: RootToken.code},
    keyPair
  })

  await account.runTarget({
    contract: tokenFactory,
    method: 'setWalletCode',
    params: {wallet_code_: TONTokenWallet.code},
    keyPair
  })
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.log(e);
    process.exit(1);
  });
