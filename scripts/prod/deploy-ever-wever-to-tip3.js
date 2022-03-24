const { Command } = require('commander');

const logger = require('mocha-logger');
const program = new Command();
const prompts = require('prompts');

const isValidTonAddress = (address) => /^(?:-1|0):[0-9a-fA-F]{64}$/.test(address);

async function main() {
    const [keyPair] = await locklift.keys.getKeyPairs();
    const promptsData = [];

    program
        .allowUnknownOption()
        .option('-evroot', '--weverroot <weverRoot>', 'WEVER Root')
        .option('-ewvault', '--wevervault <weverVault>', 'WEVER Vault')
        .option('-evertotip3', '--evertotip3 <everToTip3>', 'Swap Ever to Tip3 contract');

    program.parse(process.argv);  
    
    const options = program.opts();

    if (!isValidTonAddress(options.weverroot)) {
        promptsData.push({
            type: 'text',
            name: 'weverRoot',
            message: 'WEVER Root',
            validate: value => isValidTonAddress(value) ? true : 'Invalid Ever address'
        })
    }

    if (!isValidTonAddress(options.wevervault)) {
        promptsData.push({
            type: 'text',
            name: 'weverVault',
            message: 'WEVER Vault',
            validate: value => isValidTonAddress(value) ? true : 'Invalid Ever address'
        })
    }

    if (!isValidTonAddress(options.evertotip3)) {
        promptsData.push({
            type: 'text',
            name: 'everToTip3',
            message: 'Swap Ever contract',
            validate: value => isValidTonAddress(value) ? true : 'Invalid Ever address'
        })
    }

    const response = await prompts(promptsData);
    const weverRoot_ = options.weverroot || response.weverRoot;
    const weverVault_ = options.wevervault || response.weverVault;
    const everToTip3_ = options.evertotip3 || response.everToTip3;

    const EverWeverToTIP3 = await locklift.factory.getContract('EverWeverToTip3');

    let everWEverToTip3 = await locklift.giver.deployContract({
        contract: EverWeverToTIP3,
        constructorParams: {
        },
        initParams: {
            randomNonce_: Math.random() * 6400 | 0,
            weverRoot: weverRoot_,
            weverVault: weverVault_,
            everToTip3: everToTip3_
        },
        keyPair,
    }, locklift.utils.convertCrystal('2', 'nano'));

    logger.log(`'Ever and WEver to Tip3': ${everWEverToTip3.address}`);
}

main()
    .then(() => process.exit(0))
    .catch(e => {
        console.log(e);
        process.exit(1);
    });
