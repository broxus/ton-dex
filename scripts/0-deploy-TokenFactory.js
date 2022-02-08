const {getRandomNonce, Migration, TOKEN_CONTRACTS_PATH} = require(process.cwd()+'/scripts/utils')

async function main() {
  const migration = new Migration();
  const account = migration.load(await locklift.factory.getAccount('Wallet'), 'Account1');

  const TokenFactory = await locklift.factory.getContract('TokenFactory');

  const TokenRoot = await locklift.factory.getContract('TokenRootUpgradeable', TOKEN_CONTRACTS_PATH);
  const TokenWallet = await locklift.factory.getContract('TokenWalletUpgradeable', TOKEN_CONTRACTS_PATH);
  const TokenWalletPlatform = await locklift.factory.getContract('TokenWalletPlatform', TOKEN_CONTRACTS_PATH);

  const [keyPair] = await locklift.keys.getKeyPairs();

  const tokenFactory = await locklift.giver.deployContract({
    contract: TokenFactory,
    constructorParams: {
      _owner: account.address
    },
    initParams: {
      randomNonce_: getRandomNonce(),
    },
    keyPair,
  }, locklift.utils.convertCrystal(2, 'nano'));
  migration.store(tokenFactory, 'TokenFactory');

  console.log(`TokenFactory: ${tokenFactory.address}`);

  await account.runTarget({
    contract: tokenFactory,
    method: 'setRootCode',
    params: {_rootCode: TokenRoot.code},
    keyPair
  })

  await account.runTarget({
    contract: tokenFactory,
    method: 'setWalletCode',
    params: {_walletCode: TokenWallet.code},
    keyPair
  })

  await account.runTarget({
    contract: tokenFactory,
    method: 'setWalletPlatformCode',
    params: {_walletPlatformCode: TokenWalletPlatform.code},
    keyPair
  })
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.log(e);
    process.exit(1);
  });
