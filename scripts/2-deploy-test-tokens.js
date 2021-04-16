const {getRandomNonce, Migration, stringToBytesArray, afterRun} = require(process.cwd()+'/scripts/utils')

const FOO_DECIMALS = 3;
const BAR_DECIMALS = 9;

async function main() {
  const migration = new Migration();
  const [keyPair] = await locklift.keys.getKeyPairs();

  const account = migration.load(await locklift.factory.getAccount(), 'Account1');

  const TokenFactory = await locklift.factory.getContract('TokenFactory');
  const tokenFactory = migration.load(TokenFactory, 'TokenFactory');

  const TokenFactoryCreateNewTokenFor = await locklift.factory.getContract('TokenFactoryCreateNewTokenFor');
  const tokenFactoryCreateNewTokenFor = await locklift.giver.deployContract({
    contract: TokenFactoryCreateNewTokenFor,
    constructorParams: {factory: tokenFactory.address},
    initParams: {_randomNonce: getRandomNonce()},
    keyPair,
  }, locklift.utils.convertCrystal(100, 'nano'));

  TokenFactoryCreateNewTokenFor.afterRun = afterRun;

  const tokensToCreate = [
    {
      name: 'Foo',
      symbol: 'Foo',
      decimals: FOO_DECIMALS,
      owner: account.address,
      amount: 3
    },
    {
      name: 'Bar',
      symbol: 'Bar',
      decimals: BAR_DECIMALS,
      owner: account.address,
      amount: 3
    }
  ]

  for (const tokenData of tokensToCreate) {
    let index = getRandomNonce()+tokensToCreate.indexOf(tokenData);
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
    });
    const deployedTokenRoot = await tokenFactoryCreateNewTokenFor.call({
      method: 'getDeployedToken',
      params: {answer_id: index}
    });
    console.log(`Token ${tokenData.name}: ${deployedTokenRoot}`)
    migration.store({
      name: 'TokenRoot',
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
