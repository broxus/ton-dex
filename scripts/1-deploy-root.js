const getRandomNonce = () => Math.random() * 64000 | 0;


async function main() {
  const DexRoot = await locklift.factory.getContract('DexRoot');
  const [keyPair] = await locklift.keys.getKeyPairs();
  
  const root = await locklift.giver.deployContract({
    contract: DexRoot,
    constructorParams: {},
    initParams: {
      _nonce: getRandomNonce(),
    },
    keyPair,
  });

}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.log(e);
    process.exit(1);
  });
