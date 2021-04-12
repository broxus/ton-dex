const {Migration, tonTokenContractsPath} = require('../../../../../scripts/utils')


async function main() {
  const migration = new Migration();
  const [keyPair] = await locklift.keys.getKeyPairs();

  const account1 = migration.load(await locklift.factory.getAccount(), 'Account1');
  const tokenFoo = migration.load(await locklift.factory.getContract('RootTokenContract', tonTokenContractsPath), 'TokenRootFoo');
  const tokenBar = migration.load(await locklift.factory.getContract('RootTokenContract', tonTokenContractsPath), 'TokenRootBar');
  const dexRoot = migration.load(await locklift.factory.getContract('DexRoot'), 'DexRoot');
  await account1.runTarget({
    contract: dexRoot,
    method: 'deployPair',
    params: {
      left_root: tokenFoo.address,
      right_root: tokenBar.address,
      send_gas_to: account1.address,
    },
    value: locklift.utils.convertCrystal(6, 'nano'),
    keyPair
  });
  console.log(await dexRoot.call({
    method: 'getExpectedPairAddress', params: {
      'left_root': tokenFoo.address,
      'right_root': tokenBar.address,

    }
  }))
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.log(e);
    process.exit(1);
  });
