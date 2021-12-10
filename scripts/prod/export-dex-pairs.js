const fs = require('fs');

const OLD_DEX_PAIR_CODE_HASH = '04693de56d179b1f009b68f118a0d28700be24d25db09be62881f4ce92ec20dc';
const DEX_ROOT_ADDRESS = '0:943bad2e74894aa28ae8ddbe673be09a0f3818fd170d12b4ea8ef1ea8051e940';

async function main() {
  const dexOwnersToUpdate = [];
  const dexPair = await locklift.factory.getContract('DexPairV2');

  let lastAddress = locklift.utils.zeroAddress;
  let hasResults = true;
  while (hasResults) {
    let result = await locklift.ton.client.net.query_collection({
      collection: 'accounts',
      filter: {
        code_hash: {eq: OLD_DEX_PAIR_CODE_HASH},
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
    for (const dexPair of result) {
      dexPair.setAddress(dexPair.id);
      if ((await dexPair.call({method: 'getRoot'})) === DEX_ROOT_ADDRESS) {
        const roots = await dexPair.call({method: 'getTokenRoots'})
        console.log(`DexPair ${dexPair.id}, left = ${roots.left}, right = ${roots.right}, lp = ${roots.lp}`);
        dexOwnersToUpdate.push({
          dexPair: dexPair.id,
          left: roots.left,
          right: roots.right,
          lp: roots.lp
        });
      }
    }
  }
  fs.writeFileSync('./dex_pairs.json', JSON.stringify(dexOwnersToUpdate));

}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.log(e);
    process.exit(1);
  });

