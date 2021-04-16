const {Migration} = require(process.cwd()+'/scripts/utils')
const range = n => [...Array(n).keys()];

const migration = new Migration();

async function main() {
  migration.reset();
  const Account = await locklift.factory.getAccount();
  const keyPairs = await locklift.keys.getKeyPairs();

  for (let i of range(3)) {
    let account = await locklift.giver.deployContract({
      contract: Account,
      constructorParams: {},
      initParams: {
        _randomNonce: Math.random() * 6400 | 0,
      },
      keyPair: keyPairs[i],
    }, locklift.utils.convertCrystal(100, 'nano'));
    const name = `${account.name}${i+1}`;
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
