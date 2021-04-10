const {getRandomNonce, Migration} = require('../../../../../scripts/utils')

const migration = new Migration();

async function main() {
  const Account = await locklift.factory.getAccount();
  const [keyPair] = await locklift.keys.getKeyPairs();

  const account = await locklift.giver.deployContract({
    contract: Account,
    constructorParams: {},
    initParams: {
      _randomNonce: getRandomNonce(),
    },
    keyPair,
  });
  migration.store(account, 'DevAccount');
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.log(e);
    process.exit(1);
  });
