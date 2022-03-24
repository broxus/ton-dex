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
        .option('-ewvault', '--wevervault <weverVault>', 'WEVER Vault');

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

    const response = await prompts(promptsData);
    const weverRoot_ = options.weverroot || response.weverRoot;
    const weverVault_ = options.wevervault || response.weverRoot;

    const EverToTip3 = await locklift.factory.getContract('EverToTip3');

    let everTip3 = await locklift.giver.deployContract({
        contract: EverToTip3,
        constructorParams: {
        },
        initParams: {
            randomNonce_: Math.random() * 6400 | 0,
            weverRoot: weverRoot_,
            weverVault: weverVault_,
        },
        keyPair,
    }, locklift.utils.convertCrystal('2', 'nano'));

    logger.log(`'Ever to Tip3': ${everTip3.address}`);
}

main()
    .then(() => process.exit(0))
    .catch(e => {
        console.log(e);
        process.exit(1);
    });
