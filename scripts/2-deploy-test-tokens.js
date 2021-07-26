const {getRandomNonce, Migration, stringToBytesArray, afterRun, Constants} = require(process.cwd()+'/scripts/utils');
const { Command } = require('commander');
const program = new Command();

async function main() {
  const migration = new Migration();
  const [keyPair] = await locklift.keys.getKeyPairs();

  const account = migration.load(await locklift.factory.getAccount('Wallet'), 'Account1');

  const TokenFactory = await locklift.factory.getContract('TokenFactory');
  const tokenFactory = migration.load(TokenFactory, 'TokenFactory');

  const TokenFactoryCreateNewTokenFor = await locklift.factory.getContract('TokenFactoryCreateNewTokenFor');
  const tokenFactoryCreateNewTokenFor = await locklift.giver.deployContract({
    contract: TokenFactoryCreateNewTokenFor,
    constructorParams: {factory: tokenFactory.address},
    initParams: {_randomNonce: getRandomNonce()},
    keyPair,
  }, locklift.utils.convertCrystal(20, 'nano'));

  tokenFactoryCreateNewTokenFor.afterRun = afterRun;

  program
      .allowUnknownOption()
      .option('-t, --tokens <tokens>', 'tokens to deploy');

  program.parse(process.argv);

  const options = program.opts();

  let tokens = options.tokens ? JSON.parse(options.tokens) : ['foo', 'bar', 'tst'];

  for (const tokenId of tokens) {
    const tokenData = Constants.tokens[tokenId];
    let index = getRandomNonce()+tokens.indexOf(tokenId);
    await tokenFactoryCreateNewTokenFor.run({
      method: 'newToken',
      params: {
        answer_id: index,
        value: locklift.utils.convertCrystal(3, 'nano'),
        owner: account.address,
        name: stringToBytesArray(tokenData.name),
        symbol: stringToBytesArray(tokenData.symbol),
        decimals: tokenData.decimals
      }
    });
    await afterRun();
    const deployedTokenRoot = await tokenFactoryCreateNewTokenFor.call({
      method: 'getDeployedToken',
      params: {answer_id: index}
    });
    console.log(`Token ${tokenData.name}: ${deployedTokenRoot}`)
    migration.store({
      name: tokenData.symbol + 'Root',
      address: deployedTokenRoot,
    }, `${tokenData.symbol}Root`);
  }
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.log(e);
    process.exit(1);
  });
