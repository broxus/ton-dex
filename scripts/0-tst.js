const {getRandomNonce} = require(process.cwd()+'/scripts/utils')

async function main() {
    const Test = await locklift.factory.getAccount('Test');
    const keyPairs = await locklift.keys.getKeyPairs();

    let tst = await locklift.giver.deployContract({
        contract: Test,
        constructorParams: {},
        initParams: {
            _nonce: getRandomNonce(),
        },
        keyPair: keyPairs[0],
    }, locklift.utils.convertCrystal(0.1, 'nano'));
    const name = `Test`;
    console.log(`${name}: ${tst.address}`);

    const tx = await tst.run({
        method: 'test1',
        params: {},
        keyPair: keyPairs[0]
    }).catch(e => {
        console.log('error: ', e);
    });

    console.log('Tx: ', tx.id)
}

main()
    .then(() => process.exit(0))
    .catch(e => {
        console.log(e);
        process.exit(1);
    });
