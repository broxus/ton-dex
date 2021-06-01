const {Migration} = require(process.cwd()+'/scripts/utils');
const { Command } = require('commander');
const program = new Command();

const range = n => [...Array(n).keys()];

const migration = new Migration();

async function main() {
  const Account = await locklift.factory.getAccount('Wallet');
  const keyPairs = await locklift.keys.getKeyPairs();

  program
      .allowUnknownOption()
      .option('-n, --key_number <key_number>', 'count of accounts')
      .option('-b, --balance <balance>', 'count of accounts');

  program.parse(process.argv);

  const options = program.opts();

  const key_number = +(options.key_number || '0');
  const balance = +(options.balance || '10');

  let account = await locklift.giver.deployContract({
    contract: Account,
    constructorParams: {},
    initParams: {
      _randomNonce: Math.random() * 6400 | 0,
    },
    keyPair: keyPairs[key_number],
  }, locklift.utils.convertCrystal(balance, 'nano'));
  const name = `Account${key_number+1}`;
  migration.store(account, name);
  console.log(`${name}: ${account.address}`);
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.log(e);
    process.exit(1);
  });
