const {Migration, afterRun} = require(process.cwd() + '/scripts/utils')
const migration = new Migration();

async function main() {
  const account = migration.load(await locklift.factory.getAccount(), 'Account1');
  account.afterRun = afterRun;
  const [keyPair] = await locklift.keys.getKeyPairs();

  const dexRoot = migration.load(await locklift.factory.getContract('DexRoot'), 'DexRoot');
  const NewDexRoot = await locklift.factory.getContract('NewDexRoot');

  console.log(`Upgrading DexRoot contract: ${dexRoot.address}`);
  await account.runTarget({
    contract: dexRoot,
    method: 'upgrade',
    params: {
      code: NewDexRoot.code
    },
    value: locklift.utils.convertCrystal(11, 'nano'),
    keyPair
  });
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.log(e);
    process.exit(1);
  });
