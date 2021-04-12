const {Migration} = require('../../../../../scripts/utils')


async function main() {
  const migration = new Migration();
  const [keyPair] = await locklift.keys.getKeyPairs();

  const account1 = migration.load(await locklift.factory.getAccount(), 'Account1');
  const dexRoot = migration.load(await locklift.factory.getContract('DexRoot'), 'DexRoot');
  await account1.runTarget({
    contract: dexRoot,
    method: 'deployAccount',
    params: {
      'account_owner': account1.address,
      'send_gas_to': account1.address
    },
    keyPair
  });
  console.log(`DexAccount1: ` +
    await dexRoot.call({method: 'getExpectedAccountAddress', params: {'account_owner': account1.address}})
  );
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.log(e);
    process.exit(1);
  });
