const {getRandomNonce, Migration, TOKEN_CONTRACTS_PATH} = require(process.cwd()+'/scripts/utils')
const {Command} = require('commander');
const program = new Command();

async function main() {
    const migration = new Migration();

    const EverToTip3 = await locklift.factory.getContract('EverToTip3');
    const Tip3ToEver = await locklift.factory.getContract('Tip3ToEver');
    const EverWeverToTip3 = await locklift.factory.getContract('EverWeverToTip3');

    const [keyPair] = await locklift.keys.getKeyPairs();

    const weverRoot = migration.load(await locklift.factory.getContract('TokenRootUpgradeable', TOKEN_CONTRACTS_PATH), 'WEVERRoot').address;
    const weverVault = migration.load(await locklift.factory.getContract('TestWeverVault'), 'WEVERVault').address;

    console.log(`Deploying EverToTip3 contract...`);
    const everToTip3 = await locklift.giver.deployContract({
        contract: EverToTip3,
        constructorParams: {
        },
        initParams: {
            randomNonce_: getRandomNonce(),
            weverRoot: weverRoot,
            weverVault: weverVault
        },
        keyPair,
    }, locklift.utils.convertCrystal('2', 'nano'));    
    console.log(`EverToTip3 deploing end. Address: ${everToTip3.address}`);

    console.log(`Deploying Tip3ToEver...`);
    const tip3ToEver = await locklift.giver.deployContract({
        contract: Tip3ToEver,
        constructorParams: {
        },
        initParams: {
            randomNonce_: getRandomNonce(),
            weverRoot: weverRoot,
            weverVault: weverVault
        },
        keyPair,
    }, locklift.utils.convertCrystal('2', 'nano'));    
    console.log(`Tip3ToEver deploying end. Address: ${tip3ToEver.address}`);

    console.log(`Deploying EverWeverToTip3...`);
    const everWEverToTIP3 = await locklift.giver.deployContract({
        contract: EverWeverToTip3,
        constructorParams: {
        },
        initParams: {
            randomNonce_: getRandomNonce(),
            weverRoot: weverRoot,
            weverVault: weverVault,
            everToTip3: everToTip3.address
        },
        keyPair,
    }, locklift.utils.convertCrystal('2', 'nano'));    
    console.log(`EverWeverToTip3 deploing end. Address: ${everWEverToTIP3.address}`);

    migration.store(everToTip3, 'EverToTip3');
    migration.store(tip3ToEver, 'Tip3ToEver');
    migration.store(everWEverToTIP3, 'EverWeverToTip3');
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.log(e);
    process.exit(1);
  });
