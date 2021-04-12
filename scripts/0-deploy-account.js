const {Migration} = require('../../../../../scripts/utils')
const range = n => [...Array(n).keys()];

const migration = new Migration();

async function main() {
  const Account = await locklift.factory.getAccount();
  const [keyPair] = await locklift.keys.getKeyPairs();

  for (let i of range(3)) {
    let account = await locklift.giver.deployContract({
      contract: Account,
      constructorParams: {},
      initParams: {
        _randomNonce: Math.random() * 6400 | 0,
      },
      keyPair,
    }, locklift.utils.convertCrystal(100, 'nano'));
    const name = `${account.name}${i}`;
    migration.store(account, name);
    console.log(`${name}: ${account.address}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.log(e);
    process.exit(1);
  });
