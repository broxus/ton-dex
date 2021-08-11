const fs = require('fs');

const OLD_DEX_ACCOUNT_CODE_HASH = '74007460d28b8e5c0d3bdb0b152d81833f20fa66e2b636cf9fdeab0918265cd0';
const DEX_ROOT_ADDRESS = '0:943bad2e74894aa28ae8ddbe673be09a0f3818fd170d12b4ea8ef1ea8051e940';

async function main() {
  const dexOwnersToUpdate = [];
  const dexAccount = await locklift.factory.getContract('DexAccount');

  let lastAddress = locklift.utils.zeroAddress;
  let hasResults = true;
  while (hasResults) {
    let result = await locklift.ton.client.net.query_collection({
      collection: 'accounts',
      filter: {
        code_hash: {eq: OLD_DEX_ACCOUNT_CODE_HASH},
        id: {gt: lastAddress}
      },
      order: [{path: 'id', direction: 'ASC'}],
      limit: 50,
      result: 'id'
    });
    result = result.result;
    hasResults = result.length === 50;
    if (hasResults) {
      lastAddress = result[49].id;
    }
    for (const dexAccountAddress of result) {
      dexAccount.setAddress(dexAccountAddress.id);
      if ((await dexAccount.call({method: 'getRoot'})) === DEX_ROOT_ADDRESS) {
        const owner = await dexAccount.call({method: 'getOwner'})
        console.log(`DexAccount ${dexAccountAddress.id}, owner = ${owner}`);
        dexOwnersToUpdate.push({
          dexAccount: dexAccountAddress.id,
          owner: owner
        });
      }
    }
  }
  fs.writeFileSync('./dex_accounts.json', JSON.stringify(dexOwnersToUpdate));

}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.log(e);
    process.exit(1);
  });

