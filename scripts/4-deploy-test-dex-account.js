const {Migration} = require(process.cwd()+'/scripts/utils')


async function main() {
  const migration = new Migration();
  const keyPairs = await locklift.keys.getKeyPairs();

  const account2 = migration.load(await locklift.factory.getAccount(), 'Account2');
  const dexRoot = migration.load(await locklift.factory.getContract('DexRoot'), 'DexRoot');
  await account2.runTarget({
    contract: dexRoot,
    method: 'deployAccount',
    params: {
      'account_owner': account2.address,
      'send_gas_to': account2.address
    },
    keyPair: keyPairs[1],
    value: locklift.utils.convertCrystal(4, 'nano')
  });
  const dexAccount2Address = await dexRoot.call({
    method: 'getExpectedAccountAddress',
    params: {'account_owner': account2.address}
  });
  console.log(`DexAccount2: ${dexAccount2Address}`);
  const dexAccount2 = await locklift.factory.getContract('DexAccount');
  dexAccount2.address = dexAccount2Address;
  migration.store(dexAccount2, 'DexAccount2');
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.log(e);
    process.exit(1);
  });
