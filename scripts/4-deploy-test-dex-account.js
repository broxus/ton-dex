const {Migration} = require(process.cwd()+'/scripts/utils')
const { Command } = require('commander');
const program = new Command();

program
    .allowUnknownOption()
    .option('-o, --owner_n <owner_n>', 'owner number')
    .option('-cn, --contract_name <contract_name>', 'DexAccount contract name');

program.parse(process.argv);

const options = program.opts();

options.owner_n = options.owner_n ? +options.owner_n : 2;
options.contract_name = options.contract_name || 'DexAccount';

async function main() {
  const migration = new Migration();
  const keyPairs = await locklift.keys.getKeyPairs();

  const accountN = migration.load(await locklift.factory.getAccount('Wallet'), 'Account' + options.owner_n);
  const dexRoot = migration.load(await locklift.factory.getContract('DexRoot'), 'DexRoot');
  await accountN.runTarget({
    contract: dexRoot,
    method: 'deployAccount',
    params: {
      'account_owner': accountN.address,
      'send_gas_to': accountN.address
    },
    keyPair: keyPairs[options.owner_n - 1],
    value: locklift.utils.convertCrystal(4, 'nano')
  });
  const dexAccountNAddress = await dexRoot.call({
    method: 'getExpectedAccountAddress',
    params: {'account_owner': accountN.address}
  });
  console.log(`DexAccount${options.owner_n}: ${dexAccountNAddress}`);
  const dexAccountN = await locklift.factory.getContract(options.contract_name);
  dexAccountN.address = dexAccountNAddress;
  migration.store(dexAccountN, 'DexAccount' + options.owner_n);
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.log(e);
    process.exit(1);
  });
