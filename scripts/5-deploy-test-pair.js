const {Migration, TOKEN_CONTRACTS_PATH, afterRun} = require(process.cwd()+'/scripts/utils')

async function main() {
  const migration = new Migration();
  const keyPairs = await locklift.keys.getKeyPairs();

  const account2 = migration.load(await locklift.factory.getAccount(), 'Account2');
  account2.afterRun = afterRun;
  const tokenFoo = migration.load(await locklift.factory.getContract('RootTokenContract', TOKEN_CONTRACTS_PATH), 'FooRoot');
  const tokenBar = migration.load(await locklift.factory.getContract('RootTokenContract', TOKEN_CONTRACTS_PATH), 'BarRoot');
  const dexVault = migration.load(await locklift.factory.getContract('DexVault'), 'DexVault');

  const dexRoot = migration.load(await locklift.factory.getContract('DexRoot'), 'DexRoot');
  await account2.runTarget({
    contract: dexRoot,
    method: 'deployPair',
    params: {
      left_root: tokenFoo.address,
      right_root: tokenBar.address,
      send_gas_to: account2.address,
    },
    value: locklift.utils.convertCrystal(6, 'nano'),
    keyPair: keyPairs[1]
  });

  const dexPairFooBarAddress = await dexRoot.call({
    method: 'getExpectedPairAddress',
    params: {
      'left_root': tokenFoo.address,
      'right_root': tokenBar.address,
    }
  })
  console.log(`DexPairFooBar: ${dexPairFooBarAddress}`);
  const dexPairFooBar = await locklift.factory.getContract('DexPair');
  dexPairFooBar.address = dexPairFooBarAddress;
  migration.store(dexPairFooBar, 'DexPairFooBar');

  await new Promise(resolve => setTimeout(resolve, 10000));

  const FooBarLpRoot = await locklift.factory.getContract('RootTokenContract', TOKEN_CONTRACTS_PATH);
  FooBarLpRoot.setAddress(await dexPairFooBar.call({method: "lp_root"}));

  const FooPairWallet = await locklift.factory.getContract('TONTokenWallet', TOKEN_CONTRACTS_PATH);
  FooPairWallet.setAddress(await tokenFoo.call({
    method: "getWalletAddress",
    params: {
      wallet_public_key_: 0,
      owner_address_: dexPairFooBarAddress,
    }
  }));

  const BarPairWallet = await locklift.factory.getContract('TONTokenWallet', TOKEN_CONTRACTS_PATH);
  BarPairWallet.setAddress(await tokenBar.call({
    method: "getWalletAddress",
    params: {
      wallet_public_key_: 0,
      owner_address_: dexPairFooBarAddress,
    }
  }));

  const FooBarLpPairWallet = await locklift.factory.getContract('TONTokenWallet', TOKEN_CONTRACTS_PATH);
  FooBarLpPairWallet.setAddress(await FooBarLpRoot.call({
    method: "getWalletAddress",
    params: {
      wallet_public_key_: 0,
      owner_address_: dexPairFooBarAddress,
    }
  }));

  const FooVaultWallet = await locklift.factory.getContract('TONTokenWallet', TOKEN_CONTRACTS_PATH);
  FooVaultWallet.setAddress(await tokenFoo.call({
    method: "getWalletAddress",
    params: {
      wallet_public_key_: 0,
      owner_address_: dexVault.address,
    }
  }));

  const BarVaultWallet = await locklift.factory.getContract('TONTokenWallet', TOKEN_CONTRACTS_PATH);
  BarVaultWallet.setAddress(await tokenBar.call({
    method: "getWalletAddress",
    params: {
      wallet_public_key_: 0,
      owner_address_: dexVault.address,
    }
  }));

  const FooBarLpVaultWallet = await locklift.factory.getContract('TONTokenWallet', TOKEN_CONTRACTS_PATH);
  FooBarLpVaultWallet.setAddress(await FooBarLpRoot.call({
    method: "getWalletAddress",
    params: {
      wallet_public_key_: 0,
      owner_address_: dexVault.address,
    }
  }));

  migration.store(FooBarLpRoot, 'FooBarLpRoot');
  migration.store(FooPairWallet, 'FooPairWallet');
  migration.store(BarPairWallet, 'BarPairWallet');
  migration.store(FooBarLpPairWallet, 'FooBarLpPairWallet');
  migration.store(FooVaultWallet, 'FooVaultWallet');
  migration.store(BarVaultWallet, 'BarVaultWallet');
  migration.store(FooBarLpVaultWallet, 'FooBarLpVaultWallet');
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.log(e);
    process.exit(1);
  });
