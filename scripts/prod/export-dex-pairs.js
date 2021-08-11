const fs = require('fs');

const OLD_DEX_PAIR_CODE_HASH = '71597689db5b652e8fa5c80180ccc68d76f07b7dddb2e8c1546b11caba2453b1';
const DEX_ROOT_ADDRESS = '0:20f4220c7aeb1cdaa630db86b1660404ef888152e8ce50ddc86fe4bf96cfb17c';

async function main() {
  const dexOwnersToUpdate = [];
  const dexAccount = await locklift.factory.getContract('DexPairV2');

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
      dexAccount.setAddress(dexPair.id);
      if ((await dexAccount.call({method: 'getRoot'})) === DEX_ROOT_ADDRESS) {
        const roots = await dexAccount.call({method: 'getTokenRoots'})
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

