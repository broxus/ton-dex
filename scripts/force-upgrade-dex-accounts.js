const fs = require('fs');

let dexAccounts;
let dexOwner;

const DEX_ROOT_ADDRESS = '0:943bad2e74894aa28ae8ddbe673be09a0f3818fd170d12b4ea8ef1ea8051e940';
const DEX_OWNER_ADDRESS = '';
const DEX_OWNER_KEYS = {};

const afterRun = async (tx) => {
    await new Promise(resolve => setTimeout(resolve, 5000));
};

const data = fs.readFileSync('./dex_accounts.json', 'utf8');
if (data) dexAccounts = JSON.parse(data);

async function main() {
  const dexRoot = await locklift.factory.getContract('DexRoot');
  dexRoot.setAddress(DEX_ROOT_ADDRESS);

  const dexOwner = await locklift.factory.getAccount('SafeMultisigWallet', 'safemultisig');
  dexOwner.setAddress(DEX_OWNER_ADDRESS);
  dexOwner.afterRun = afterRun;


  console.log(`Start force upgrade DexAccounts. Count = ${dexAccounts.length}`);

  for(let indx in dexAccounts) {
      const accountData = dexAccounts[indx];
      console.log(`${indx + 1}/${dexAccounts.length}: Upgrading DexAccount(${accountData.dexAccount}). owner = ${accountData.owner}`);
      const tx = await dexOwner.runTarget({
          contract: dexRoot,
          method: 'forceUpgradeAccount',
          params: {
              account_owner: accountData.owner,
              send_gas_to: dexOwner.address
          },
          value: locklift.utils.convertCrystal(6, 'nano'),
          DEX_OWNER_KEYS
      });
      console.log(`Transaction id: ${tx.transaction.id}`);
      console.log(``);
  }
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.log(e);
    process.exit(1);
  });

