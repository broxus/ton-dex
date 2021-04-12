const {Migration, tonTokenContractsPath} = require('../../../../../scripts/utils')

async function main() {
  const migration = new Migration();
  const [keyPair] = await locklift.keys.getKeyPairs();

  const account0 = migration.load(await locklift.factory.getAccount(), 'Account0');
  const account1 = migration.load(await locklift.factory.getAccount(), 'Account1');
  const account2 = migration.load(await locklift.factory.getAccount(), 'Account2');

  const tokenFoo = migration.load(
    await locklift.factory.getContract('RootTokenContract', tonTokenContractsPath), 'TokenRootFoo'
  );
  const tokenBar = migration.load(
    await locklift.factory.getContract('RootTokenContract', tonTokenContractsPath), 'TokenRootBar'
  );
  const tokensToMint = [
    {
      contract: tokenFoo,
      owner: account1.address,
      tokens: 10000,
      alias: 'TokenFooAccount1Wallet'
    },
    {
      contract: tokenBar,
      owner: account1.address,
      tokens: 10000,
      alias: 'TokenBarAccount1Wallet'
    },
    {
      contract: tokenFoo,
      owner: account2.address,
      tokens: 10000,
      alias: 'TokenFooAccount2Wallet'
    }
  ]
  for (const tokenData of tokensToMint) {
    await account0.runTarget({
      contract: tokenData.contract,
      method: 'deployWallet',
      params: {
        tokens: tokenData.tokens,
        deploy_grams: locklift.utils.convertCrystal(1, 'nano'),
        wallet_public_key_: 0,
        owner_address_: tokenData.owner,
        gas_back_address: account0.address
      },
      value: locklift.utils.convertCrystal(2, 'nano'),
      keyPair
    });
    const tokenWalletAddress = await tokenData.contract.call({
      method: 'getWalletAddress', params: {
        wallet_public_key_: 0,
        owner_address_: tokenData.owner
      }
    });
    const tokenWallet = await locklift.factory.getContract('TONTokenWallet', tonTokenContractsPath);
    tokenWallet.address = tokenWalletAddress
    migration.store(tokenWallet, tokenData.alias);
    console.log(`${tokenData.alias}: ${tokenWalletAddress}`);
  }

}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.log(e);
    process.exit(1);
  });
