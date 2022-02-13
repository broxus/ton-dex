const { Command } = require('commander');
const program = new Command();

program
    .allowUnknownOption()
    .option('-cn, --contract_name <contract_name>', 'Contract name');

program.parse(process.argv);

const options = program.opts();
options.contract_name = options.contract_name || 'DexVaultLpTokenPending';

async function main() {

  const Contract = await locklift.factory.getContract(options.contract_name);

  console.log(`${options.contract_name} code:`);
  console.log(`${Contract.code}`);

}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.log(e);
    process.exit(1);
  });
