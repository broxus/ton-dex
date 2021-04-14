const {getRandomNonce, Migration} = require(process.cwd()+'/scripts/utils')

async function main() {
  const migration = new Migration();
  const account = migration.load(await locklift.factory.getAccount(), 'Account1');

  const DexPlatform = await locklift.factory.getContract('DexPlatform');
  const DexAccount = await locklift.factory.getContract('DexAccount');
  const DexPair = await locklift.factory.getContract('DexPair');
  const DexVaultLpTokenPending = await locklift.factory.getContract('DexVaultLpTokenPending');

  const [keyPair] = await locklift.keys.getKeyPairs();

  const DexRoot = await locklift.factory.getContract('DexRoot');
  console.log(`Deploying DexRoot...`);
  const dexRoot = await locklift.giver.deployContract({
    contract: DexRoot,
    constructorParams: {
      initial_owner: account.address,
      initial_vault: locklift.ton.zero_address
    },
    initParams: {
      _nonce: getRandomNonce(),
    },
    keyPair,
  });
  console.log(`DexRoot address: ${dexRoot.address}`);

  const DexVault = await locklift.factory.getContract('DexVault');
  console.log(`Deploying DexVault...`);
  const dexVault = await locklift.giver.deployContract({
    contract: DexVault,
    constructorParams: {
      owner_: account.address,
      token_factory_: migration.load(await locklift.factory.getAccount(), 'TokenFactory').address,
      root_: dexRoot.address
    },
    initParams: {
      _nonce: getRandomNonce(),
    },
    keyPair,
  });
  console.log(`DexVault address: ${dexVault.address}`);

  console.log(`DexVault: installing Platform code...`);
  await account.runTarget({
    contract: dexVault,
    method: 'installPlatformOnce',
    params: {code: DexPlatform.code},
    keyPair
  });

  console.log(`DexVault: installing VaultLpTokenPending code...`);
  await account.runTarget({
    contract: dexVault,
    method: 'installOrUpdateLpTokenPendingCode',
    params: {code: DexVaultLpTokenPending.code},
    keyPair
  });

  console.log(`DexRoot: installing vault address...`);
  await account.runTarget({
    contract: dexRoot,
    method: 'setVaultOnce',
    params: {new_vault: dexVault.address},
    keyPair
  });

  console.log(`DexRoot: installing Platform code...`);
  await account.runTarget({
    contract: dexRoot,
    method: 'installPlatformOnce',
    params: {code: DexPlatform.code},
    keyPair
  });

  console.log(`DexRoot: installing DexAccount code...`);
  await account.runTarget({
    contract: dexRoot,
    method: 'installOrUpdateAccountCode',
    params: {code: DexAccount.code},
    keyPair
  });

  console.log(`DexRoot: installing DexPair code...`);
  await account.runTarget({
    contract: dexRoot,
    method: 'installOrUpdatePairCode',
    params: {code: DexPair.code},
    keyPair
  });

  console.log(`DexRoot: set Dex is active...`);
  await account.runTarget({
    contract: dexRoot,
    method: 'setActive',
    params: {new_active: true},
    keyPair
  });

  migration.store(dexRoot, 'DexRoot');
  migration.store(dexVault, 'DexVault');
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.log(e);
    process.exit(1);
  });
