const {Migration, TOKEN_CONTRACTS_PATH} = require(process.cwd()+'/scripts/utils')

const BigNumber = require('bignumber.js');
BigNumber.config({EXPONENTIAL_AT: 257});

const afterRun = async (tx) => {
  await new Promise(resolve => setTimeout(resolve, 1000));
};

const FOO_DECIMALS = 3;
const BAR_DECIMALS = 9;

async function main() {
  const migration = new Migration();
  const [keyPair] = await locklift.keys.getKeyPairs();

  const account1 = migration.load(await locklift.factory.getAccount(), 'Account1');
  const account2 = migration.load(await locklift.factory.getAccount(), 'Account2');
  const account3 = migration.load(await locklift.factory.getAccount(), 'Account3');

  account1.afterRun = afterRun;

  const tokenFoo = migration.load(
    await locklift.factory.getContract('RootTokenContract', TOKEN_CONTRACTS_PATH), 'FooRoot'
  );
  const tokenBar = migration.load(
    await locklift.factory.getContract('RootTokenContract', TOKEN_CONTRACTS_PATH), 'BarRoot'
  );
  const tokensToMint = [
    {
      contract: tokenFoo,
      owner: account2.address,
      tokens: new BigNumber(20000).times(new BigNumber(10).pow(FOO_DECIMALS)).toString(),
      alias: 'FooWallet2'
    },
    {
      contract: tokenBar,
      owner: account2.address,
      tokens: new BigNumber(20000).times(new BigNumber(10).pow(BAR_DECIMALS)).toString(),
      alias: 'BarWallet2'
    },
    {
      contract: tokenFoo,
      owner: account3.address,
      tokens: new BigNumber(110000).times(new BigNumber(10).pow(FOO_DECIMALS)).toString(),
      alias: 'FooWallet3'
    }
  ]
  for (const tokenData of tokensToMint) {
    await account1.runTarget({
      contract: tokenData.contract,
      method: 'deployWallet',
      params: {
        tokens: tokenData.tokens,
        deploy_grams: locklift.utils.convertCrystal(1, 'nano'),
        wallet_public_key_: 0,
        owner_address_: tokenData.owner,
        gas_back_address: account1.address
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
    const tokenWallet = await locklift.factory.getContract('TONTokenWallet', TOKEN_CONTRACTS_PATH);
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
