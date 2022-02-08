const {Migration, afterRun, Constants, TOKEN_CONTRACTS_PATH, getRandomNonce} = require(process.cwd()+'/scripts/utils');
const { Command } = require('commander');
const program = new Command();

async function main() {
  const migration = new Migration();
  const [keyPair] = await locklift.keys.getKeyPairs();

  const account = migration.load(await locklift.factory.getAccount('Wallet'), 'Account1');

  account.afterRun = afterRun;

  program
      .allowUnknownOption()
      .option('-t, --tokens <tokens>', 'tokens to deploy');

  program.parse(process.argv);

  const options = program.opts();

  let tokens = options.tokens ? JSON.parse(options.tokens) : ['foo', 'bar', 'tst'];

  const TokenRootUpgradeable = await locklift.factory.getContract('TokenRootUpgradeable', TOKEN_CONTRACTS_PATH);
  const TokenWalletUpgradeable = await locklift.factory.getContract('TokenWalletUpgradeable', TOKEN_CONTRACTS_PATH);
  const TokenWalletPlatform = await locklift.factory.getContract('TokenWalletPlatform', TOKEN_CONTRACTS_PATH);
  const TokenRoot = await locklift.factory.getContract('TokenRoot', TOKEN_CONTRACTS_PATH);
  const TokenWallet = await locklift.factory.getContract('TokenWallet', TOKEN_CONTRACTS_PATH);

  for (const tokenId of tokens) {
    const tokenData = Constants.tokens[tokenId];
    let tokenRoot = await locklift.giver.deployContract({
        contract: tokenData.upgradeable ? TokenRootUpgradeable : TokenRoot,
        constructorParams: {
            initialSupplyTo: locklift.utils.zeroAddress,
            initialSupply: '0',
            deployWalletValue: '0',
            mintDisabled: false,
            burnByRootDisabled: true,
            burnPaused: true,
            remainingGasTo: locklift.utils.zeroAddress
        },
        initParams: {
            randomNonce_: getRandomNonce(),
            deployer_: locklift.utils.zeroAddress,
            name_: tokenData.name,
            symbol_: tokenData.symbol,
            decimals_: tokenData.decimals,
            walletCode_: tokenData.upgradeable ? TokenWalletUpgradeable.code : TokenWallet.code,
            rootOwner_: account.address,
            platformCode_: tokenData.upgradeable ? TokenWalletPlatform.code : undefined
        },
        keyPair
    }, locklift.utils.convertCrystal('3', 'nano'));

    console.log(`Token ${tokenData.name}: ${tokenRoot.address}`)
    migration.store({
      name: tokenData.symbol + 'Root',
      address: tokenRoot.address,
    }, `${tokenData.symbol}Root`);
  }
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.log(e);
    process.exit(1);
  });
