const fs = require('fs');

let dexPairs;
let dexOwner;

const DEX_ROOT_ADDRESS = '0:943bad2e74894aa28ae8ddbe673be09a0f3818fd170d12b4ea8ef1ea8051e940';
const DEX_OWNER_ADDRESS = '';
const DEX_OWNER_WALLET_TYPE = 'SafeMultisigWallet';

const NewCodeContract = 'DexPairV4';

const afterRun = async (tx) => {
    await new Promise(resolve => setTimeout(resolve, 1000));
};

const data = fs.readFileSync('./dex_pairs.json', 'utf8');
if (data) dexPairs = JSON.parse(data);

async function main() {
  const keyPairs = await locklift.keys.getKeyPairs();
  const DEX_OWNER_KEYS = keyPairs[0];

  const dexRoot = await locklift.factory.getContract('DexRoot');
  dexRoot.setAddress(DEX_ROOT_ADDRESS);


  let dexOwner;
  if (DEX_OWNER_WALLET_TYPE === 'SafeMultisigWallet'){
      dexOwner = await locklift.factory.getAccount('SafeMultisigWallet', 'safemultisig');
  } else {
      dexOwner = await locklift.factory.getAccount(DEX_OWNER_WALLET_TYPE);
  }
  dexOwner.setAddress(DEX_OWNER_ADDRESS);
  dexOwner.afterRun = afterRun;

  if (NewCodeContract) {
      const NextVersionContract = await locklift.factory.getContract(NewCodeContract);
      console.log(`Installing new DexPair contract in DexRoot: ${dexRoot.address}`);
      const startVersion = await dexRoot.call({method: 'getPairVersion', params: { _answer_id: 0 }});
      console.log(`Start version = ${startVersion}`);

      await dexOwner.runTarget({
          contract: dexRoot,
          method: 'installOrUpdatePairCode',
          params: {code: NextVersionContract.code},
          value: locklift.utils.convertCrystal(5, 'nano'),
          keyPair: DEX_OWNER_KEYS
      });

      await new Promise(resolve => setTimeout(resolve, 120000));

      const endVersion = await dexRoot.call({method: 'getPairVersion', params: { _answer_id: 0 }});
      console.log(`End version = ${endVersion}`);
  }

  console.log(`Start force upgrade DexPairs. Count = ${dexPairs.length}`);

  for(let indx in dexPairs) {
      const pairData = dexPairs[indx];
      console.log(`${1 + (+indx)}/${dexPairs.length}: Upgrading DexPair(${pairData.dexPair}). left = ${pairData.left}, right = ${pairData.right}`);
      const tx = await dexOwner.runTarget({
          contract: dexRoot,
          method: 'upgradePair',
          params: {
              left_root: pairData.left,
              right_root: pairData.right,
              send_gas_to: dexOwner.address
          },
          value: locklift.utils.convertCrystal(6, 'nano'),
          keyPair: DEX_OWNER_KEYS
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

