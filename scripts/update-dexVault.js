const {Migration, afterRun} = require(process.cwd() + '/scripts/utils')
const migration = new Migration();

async function main() {
  const account = migration.load(await locklift.factory.getAccount('Wallet'), 'Account1');
  account.afterRun = afterRun;
  const [keyPair] = await locklift.keys.getKeyPairs();

  const dexVault = migration.load(await locklift.factory.getContract('DexVault'), 'DexVault');
  const NewDexVault = await locklift.factory.getContract('NewDexVault');

  console.log(`Upgrading DexVault contract: ${dexVault.address}`);
  await account.runTarget({
    contract: dexVault,
    method: 'upgrade',
    params: {
      code: NewDexVault.code
    },
    value: locklift.utils.convertCrystal(6, 'nano'),
    keyPair
  });
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.log(e);
    process.exit(1);
  });
