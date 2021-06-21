const {Migration, TOKEN_CONTRACTS_PATH, Constants} = require(process.cwd()+'/scripts/utils');
const { Command } = require('commander');
const program = new Command();
const BigNumber = require('bignumber.js');
BigNumber.config({EXPONENTIAL_AT: 257});

const afterRun = async (tx) => {
  await new Promise(resolve => setTimeout(resolve, 1000));
};

async function main() {
  const migration = new Migration();
  const [keyPair] = await locklift.keys.getKeyPairs();

  const rootOwner = migration.load(await locklift.factory.getAccount('Wallet'), 'Account1');

  rootOwner.afterRun = afterRun;

  program
      .allowUnknownOption()
      .option('-m, --mints <mints>', 'mint params');

  program.parse(process.argv);

  const options = program.opts();

  const mints = options.mints ? JSON.parse(options.mints) : [
    {
      account: 2,
      amount: 20000,
      token: 'foo'
    },
    {
      account: 2,
      amount: 20000,
      token: 'bar'
    },
    {
      account: 2,
      amount: 20000,
      token: 'tst'
    },
    {
      account: 3,
      amount: 110000,
      token: 'foo'
    },

  ];

  for (const mint of mints) {

    const token = Constants.tokens[mint.token];
    const account = migration.load(await locklift.factory.getAccount('Wallet'), 'Account' + mint.account);
    const amount = new BigNumber(mint.amount).shiftedBy(token.decimals);

    const tokenRoot = migration.load(
        await locklift.factory.getContract('RootTokenContract', TOKEN_CONTRACTS_PATH), token.symbol + 'Root'
    );

    await rootOwner.runTarget({
      contract: tokenRoot,
      method: 'deployWallet',
      params: {
        tokens: amount,
        deploy_grams: locklift.utils.convertCrystal(1, 'nano'),
        wallet_public_key_: 0,
        owner_address_: account.address,
        gas_back_address: rootOwner.address
      },
      value: locklift.utils.convertCrystal(2, 'nano'),
      keyPair
    });
    const tokenWalletAddress = await tokenRoot.call({
      method: 'getWalletAddress', params: {
        wallet_public_key_: 0,
        owner_address_: account.address
      }
    });
    const tokenWallet = await locklift.factory.getContract('TONTokenWallet', TOKEN_CONTRACTS_PATH);
    tokenWallet.setAddress(tokenWalletAddress);
    const alias = token.symbol + 'Wallet' + mint.account;
    migration.store(tokenWallet, alias);
    console.log(`${alias}: ${tokenWalletAddress}`);
  }

}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.log(e);
    process.exit(1);
  });
