const {Migration, TOKEN_CONTRACTS_PATH, afterRun} = require(process.cwd() + '/scripts/utils')
const migration = new Migration();

async function main() {
  const account = migration.load(await locklift.factory.getAccount('Wallet'), 'Account1');
  account.afterRun = afterRun;
  const [keyPair] = await locklift.keys.getKeyPairs();
  const dexRoot = migration.load(await locklift.factory.getContract('DexRoot'), 'DexRoot');
  const NewDexPair = await locklift.factory.getContract('TestNewDexPair');

  console.log(`Installing new DexPair contract in DexRoot: ${dexRoot.address}`);
  await account.runTarget({
    contract: dexRoot,
    method: 'installOrUpdatePairCode',
    params: {code: NewDexPair.code},
    value: locklift.utils.convertCrystal(1, 'nano'),
    keyPair
  });

  const pairs_to_update = [
    {
      left: migration.load(await locklift.factory.getContract('RootTokenContract', TOKEN_CONTRACTS_PATH), 'FooRoot'),
      right: migration.load(await locklift.factory.getContract('RootTokenContract', TOKEN_CONTRACTS_PATH), 'BarRoot')
    }
  ]
  await Promise.all(pairs_to_update.map(async (pair) => {
    console.log(`Upgrading DexPair contract:\n\t- left=${pair.left.address}\n\t- right=${pair.right.address}`);

    const tx = await account.runTarget({
      contract: dexRoot,
      method: 'upgradePair',
      params: {
        left_root: pair.left.address,
        right_root: pair.right.address,
        send_gas_to: account.address
      },
      value: locklift.utils.convertCrystal(6, 'nano'),
      keyPair
    });
    console.log(`Transaction id: ${tx.transaction.id}`);
  }));
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.log(e);
    process.exit(1);
  });
