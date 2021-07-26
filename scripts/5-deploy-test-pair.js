const {Migration, TOKEN_CONTRACTS_PATH, Constants, afterRun} = require(process.cwd()+'/scripts/utils')
const { Command } = require('commander');
const program = new Command();

async function main() {
  const migration = new Migration();
  const keyPairs = await locklift.keys.getKeyPairs();

  const account2 = migration.load(await locklift.factory.getAccount('Wallet'), 'Account2');
  const dexVault = migration.load(await locklift.factory.getContract('DexVault'), 'DexVault');
  const dexRoot = migration.load(await locklift.factory.getContract('DexRoot'), 'DexRoot');

  account2.afterRun = afterRun;

  program
      .allowUnknownOption()
      .option('-p, --pairs <pairs>', 'pairs to deploy')
      .option('-cn, --contract_name <contract_name>', 'New version of contract name');

  program.parse(process.argv);

  const options = program.opts();
  options.contract_name = options.contract_name || 'DexPair';

  const pairs = options.pairs ? JSON.parse(options.pairs) : [['foo', 'bar']];

  for (const p of pairs) {

    const tokenLeft = Constants.tokens[p[0]];
    const tokenRight = Constants.tokens[p[1]];

    const pair = {left: tokenLeft.symbol, right: tokenRight.symbol};

    console.log(`Start deploy pair DexPair${pair.left}${pair.right}`);

    const tokenFoo = migration.load(await locklift.factory.getContract('RootTokenContract', TOKEN_CONTRACTS_PATH), pair.left + 'Root');
    const tokenBar = migration.load(await locklift.factory.getContract('RootTokenContract', TOKEN_CONTRACTS_PATH), pair.right + 'Root');

    await account2.runTarget({
      contract: dexRoot,
      method: 'deployPair',
      params: {
        left_root: tokenFoo.address,
        right_root: tokenBar.address,
        send_gas_to: account2.address,
      },
      value: locklift.utils.convertCrystal(10, 'nano'),
      keyPair: keyPairs[1]
    });

    await afterRun();

    const dexPairFooBarAddress = await dexRoot.call({
      method: 'getExpectedPairAddress',
      params: {
        'left_root': tokenFoo.address,
        'right_root': tokenBar.address,
      }
    })

    console.log(`DexPair${pair.left}${pair.right}: ${dexPairFooBarAddress}`);

    await new Promise(resolve => setTimeout(resolve, 60000));

    const dexPairFooBar = await locklift.factory.getContract(options.contract_name);
    dexPairFooBar.address = dexPairFooBarAddress;
    migration.store(dexPairFooBar, 'DexPair' + pair.left + pair.right);

    const version = await dexPairFooBar.call({method: "getVersion", params: {_answer_id: 0}})
    console.log(`DexPair${pair.left}${pair.right} version = ${version}`);

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

    migration.store(FooBarLpRoot, pair.left + pair.right + 'LpRoot');
    migration.store(FooPairWallet, pair.left + pair.right + 'Pair_' + pair.left + 'Wallet');
    migration.store(BarPairWallet, pair.left + pair.right + 'Pair_' + pair.right + 'Wallet');
    migration.store(FooBarLpPairWallet, pair.left + pair.right + 'Pair_LpWallet');
    migration.store(FooVaultWallet, pair.left + 'VaultWallet');
    migration.store(BarVaultWallet, pair.right + 'VaultWallet');
    migration.store(FooBarLpVaultWallet, pair.left + pair.right + 'LpVaultWallet');
  }
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.log(e);
    process.exit(1);
  });
