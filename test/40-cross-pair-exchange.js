const {expect} = require('chai');
const {Migration, afterRun, Constants, TOKEN_CONTRACTS_PATH} = require(process.cwd() + '/scripts/utils');
const BigNumber = require('bignumber.js');
BigNumber.config({EXPONENTIAL_AT: 257});
const { Command } = require('commander');
const program = new Command();
const logger = require('mocha-logger');

const migration = new Migration();

program
    .allowUnknownOption()
    .option('-a, --amount <amount>', 'Amount of first token for exchange')
    .option('-r, --route <route>', 'Array of tokens')
    .option('-wp, --wrong_pair <wrong_pair>', 'Expected last success step token')
    .option('-cn, --contract_name <contract_name>', 'DexPair contract name');

program.parse(process.argv);

const options = program.opts();

options.amount = options.amount ? +options.amount : 100;
options.route = options.route ? JSON.parse(options.route) : ['foo', 'tst', 'bar'];
options.wrong_pair = options.wrong_pair ? JSON.parse(options.wrong_pair) : [];
options.contract_name = options.contract_name || 'DexPair';

console.log(options);

let DexRoot
let DexVault;
let Account3;
let pairsContracts = {};
let tokenRoots = {};
let accountWallets = {};
let dexWallets = {};

let keyPairs;

async function dexBalances() {
    const balances = {};

    for (const r of options.route) {
        balances[r] = await dexWallets[r].call({method: 'balance', params: {}}).then(n => {
            return new BigNumber(n).shiftedBy(-Constants.tokens[r].decimals).toString();
        });
    }

    return balances;
}

async function account3balances() {
    const balances = {};

    for (const r of options.route) {
        await accountWallets[r].call({method: 'balance', params: {}}).then(n => {
            balances[r] = new BigNumber(n).shiftedBy(-Constants.tokens[r].decimals).toString();
        }).catch(e => {/*ignored*/});
    }

    balances['ton'] = await locklift.utils.convertCrystal((await locklift.ton.getBalance(Account3.address)), 'ton').toNumber();
    return balances;
}

async function dexPairInfo(left, right) {
    const tokenLeft = Constants.tokens[left];
    const tokenRight = Constants.tokens[right];
    if (options.wrong_pair[0] === left && options.wrong_pair[1] === right) {
        return {
            left_symbol: tokenLeft.symbol,
            right_symbol: tokenRight.symbol,
            left_balance: '0',
            right_balance: '0',
        };
    }
    const Pair = await locklift.factory.getContract(options.contract_name);
    if (migration.exists(`DexPair${tokenLeft.symbol}${tokenRight.symbol}`)) {
        migration.load(Pair, `DexPair${tokenLeft.symbol}${tokenRight.symbol}`);
    } else {
        migration.load(Pair, `DexPair${tokenRight.symbol}${tokenLeft.symbol}`);
    }
    const pairRoots = await Pair.call({method: 'getTokenRoots', params: {}});
    const balances = await Pair.call({method: 'getBalances', params: {}});
    let left_balance, right_balance;
    if (pairRoots.left === tokenRoots[left].address) {
        left_balance = new BigNumber(balances.left_balance).shiftedBy(-tokenLeft.decimals).toString();
        right_balance = new BigNumber(balances.right_balance).shiftedBy(-tokenRight.decimals).toString();
    } else {
        left_balance = new BigNumber(balances.right_balance).shiftedBy(-tokenLeft.decimals).toString();
        right_balance = new BigNumber(balances.left_balance).shiftedBy(-tokenRight.decimals).toString();
    }

    return {
        left_symbol: tokenLeft.symbol,
        right_symbol: tokenRight.symbol,
        left_balance,
        right_balance
    };
}

function logBalances(header, dex, account, pairs) {
    let dexStr = `DEX balance ${header}: ` + options.route.map(r => `${dex[r]} ${Constants.tokens[r].symbol}`).join(', ');
    let accountStr = `Account#3 balance ${header}: ` + options.route.map(r =>
        `${account[r] || 0} ${Constants.tokens[r].symbol}` + (account[r] === undefined ? ' (not deployed)' : '')
    ).join(', ');

    accountStr += ', ' + account.ton + ' TON';

    logger.log(dexStr);
    logger.log(accountStr);
    Object.values(pairs).forEach(p => {
        logger.log(`DexPair#${p.left_symbol}-${p.right_symbol}: ${p.left_balance} ${p.left_symbol}, ${p.right_balance} ${p.right_symbol}.`);
    });
}

async function logGas() {
    await migration.balancesCheckpoint();
    const diff = await migration.balancesLastDiff();
    if (diff) {
        logger.log(`### GAS STATS ###`);
        for (let alias in diff) {
            logger.log(`${alias}: ${diff[alias].gt(0) ? '+' : ''}${diff[alias].toFixed(9)} TON`);
        }
    }
}

describe('Check direct DexPairFooBar operations', async function () {
    this.timeout(Constants.TESTS_TIMEOUT);
    before('Load contracts', async function () {
        keyPairs = await locklift.keys.getKeyPairs();

        DexRoot = await locklift.factory.getContract('DexRoot');
        DexVault = await locklift.factory.getContract('DexVault');
        Account3 = await locklift.factory.getAccount('Wallet');
        Account3.afterRun = afterRun;

        migration.load(DexRoot, 'DexRoot');
        migration.load(DexVault, 'DexVault');
        migration.load(Account3, 'Account3');

        logger.log('DexRoot: ' + DexRoot.address);
        logger.log('DexVault: ' + DexVault.address);
        logger.log('Account#3: ' + Account3.address);

        for (const tokenId of options.route) {
            const root = await locklift.factory.getContract('TokenRootUpgradeable', TOKEN_CONTRACTS_PATH);
            migration.load(root, Constants.tokens[tokenId].symbol + 'Root');
            tokenRoots[tokenId] = root;
            logger.log(`${Constants.tokens[tokenId].symbol}TokenRoot: ${root.address}`);

            const dexWallet = await locklift.factory.getContract('TokenWalletUpgradeable', TOKEN_CONTRACTS_PATH);
            const accountWallet = await locklift.factory.getContract('TokenWalletUpgradeable', TOKEN_CONTRACTS_PATH);

            if (migration.exists(Constants.tokens[tokenId].symbol + 'Wallet3')) {
                migration.load(accountWallet, Constants.tokens[tokenId].symbol + 'Wallet3');
                logger.log(`${Constants.tokens[tokenId].symbol}Wallet#3: ${accountWallet.address}`);
            } else {
                const expectedAccountWallet = await root.call({
                    method: 'walletOf',
                    params: {
                        walletOwner: Account3.address
                    }
                });
                accountWallet.setAddress(expectedAccountWallet);
                logger.log(`${Constants.tokens[tokenId].symbol}Wallet#3: ${expectedAccountWallet} (not deployed)`);
            }

            migration.load(dexWallet, Constants.tokens[tokenId].symbol + 'VaultWallet');
            dexWallets[tokenId] = dexWallet;
            accountWallets[tokenId] = accountWallet;
            logger.log(`${Constants.tokens[tokenId].symbol}VaultWallet: ${dexWallet.address}`);
        }
        for (let i = 1; i < options.route.length; i++) {
            const tokenLeft = Constants.tokens[options.route[i - 1]];
            const tokenRight = Constants.tokens[options.route[i]];
            const pair = await locklift.factory.getContract(options.contract_name);
            if (migration.exists(`DexPair${tokenLeft.symbol}${tokenRight.symbol}`)) {
                migration.load(pair, `DexPair${tokenLeft.symbol}${tokenRight.symbol}`);
                logger.log(`DexPair${tokenLeft.symbol}${tokenRight.symbol}: ${pair.address}`);
            } else if (migration.exists(`DexPair${tokenRight.symbol}${tokenLeft.symbol}`)) {
                migration.load(pair, `DexPair${tokenRight.symbol}${tokenLeft.symbol}`);
                logger.log(`DexPair${tokenRight.symbol}${tokenLeft.symbol}: ${pair.address}`);
            } else {
                logger.log(`DexPair${tokenLeft.symbol}${tokenRight.symbol} NOT EXISTS`);
            }
            pairsContracts[options.route[i - 1] + '-' + options.route[i]] = pair;
        }

        await migration.balancesCheckpoint();
    });

    describe('Direct cross-pair exchange', async function () {
        it('Account#3 cross-pair exchange', async function () {
            logger.log('#################################################');
            const dexStart = await dexBalances();
            const accountStart = await account3balances();
            const pairsStart = [];
            for (let i = 1; i < options.route.length; i++) {
                const pairId = options.route[i - 1] + '-' + options.route[i];
                pairsStart[pairId] = await dexPairInfo(options.route[i - 1], options.route[i]);
            }
            logBalances('start', dexStart, accountStart, pairsStart);

            const expectedPairBalances = {};
            const steps = [];
            let currentAmount = new BigNumber(options.amount).shiftedBy(Constants.tokens[options.route[0]].decimals).toString();

            // Calculate expected result
            logger.log(`### EXPECTED ###`);
            let error = false;
            for (let i = 1; i < options.route.length; i++) {
                const tokenLeft = Constants.tokens[options.route[i - 1]];
                const tokenRight = Constants.tokens[options.route[i]];
                if (options.route[i - 1] === options.wrong_pair[0] && options.route[i] === options.wrong_pair[1]) {
                    error = true;
                }

                if (error) {
                    steps.push({
                        root: tokenRoots[options.route[i]].address,
                        amount: '0'
                    });
                } else {
                    const pairId = options.route[i - 1] + '-' + options.route[i];
                    const expected = await pairsContracts[pairId].call({
                        method: 'expectedExchange', params: {
                            amount: currentAmount,
                            spent_token_root: tokenRoots[options.route[i - 1]].address
                        }
                    });
                    let logStr = `${new BigNumber(currentAmount).shiftedBy(-tokenLeft.decimals)} ${tokenLeft.symbol}`;
                    logStr += ' -> ';
                    logStr += `${new BigNumber(expected.expected_amount).shiftedBy(-tokenRight.decimals)} ${tokenRight.symbol}`;
                    logStr += `, fee = ${new BigNumber(expected.expected_fee).shiftedBy(-tokenLeft.decimals)} ${tokenLeft.symbol}`;
                    logger.log(logStr);

                    steps.push({
                        root: tokenRoots[options.route[i]].address,
                        amount: new BigNumber(expected.expected_amount).dp(0, BigNumber.ROUND_DOWN).toString()
                    });

                    expectedPairBalances[pairId] = {
                        left_balance: new BigNumber(currentAmount).shiftedBy(-tokenLeft.decimals).plus(pairsStart[pairId].left_balance).toString(),
                        right_balance: new BigNumber(pairsStart[pairId].right_balance)
                            .minus(new BigNumber(expected.expected_amount).shiftedBy(-tokenRight.decimals)).toString()
                    };

                    currentAmount = expected.expected_amount.toString();
                }
            }
            logger.log('');

            const firstPair =  pairsContracts[options.route[0] + '-' + options.route[1]];

            const params = {
                id: 0,
                deploy_wallet_grams: locklift.utils.convertCrystal('0.05', 'nano'),
                expected_amount: steps[0].amount,
                steps: steps.slice(1)
            };

            logger.log(`Call buildCrossPairExchangePayload(${JSON.stringify(params, null, 4)})`);

            const payload = await firstPair.call({
                method: 'buildCrossPairExchangePayload', params
            });
            logger.log(`Result payload = ${payload}`);

            await Account3.runTarget({
                contract: accountWallets[options.route[0]],
                method: 'transfer',
                params: {
                    amount: new BigNumber(options.amount).shiftedBy(Constants.tokens[options.route[0]].decimals).toString(),
                    recipient: firstPair.address,
                    deployWalletValue: 0,
                    remainingGasTo: Account3.address,
                    notify: true,
                    payload: payload
                },
                value: locklift.utils.convertCrystal(options.route.length + 3, 'nano'),
                keyPair: keyPairs[2]
            });

            const dexEnd = await dexBalances();
            const accountEnd = await account3balances();
            const pairsEnd = [];
            for (let i = 1; i < options.route.length; i++) {
                const pairId = options.route[i - 1] + '-' + options.route[i];
                pairsEnd[pairId] = await dexPairInfo(options.route[i - 1], options.route[i]);
            }
            logBalances('end', dexEnd, accountEnd, pairsEnd);
            await logGas();

            const lastTokenN = options.wrong_pair && options.wrong_pair.length > 0 ? options.wrong_pair[0] : options.route[options.route.length - 1];

            console.log('lastTokenN', lastTokenN);

            const expectedAccountFirst = new BigNumber(accountStart[options.route[0]] || 0).minus(options.amount).toString();
            const expectedAccountLast = new BigNumber(currentAmount)
                .shiftedBy(-Constants.tokens[lastTokenN].decimals)
                .plus(accountStart[lastTokenN] || 0).toString();

            expect(expectedAccountFirst).to.equal(accountEnd[options.route[0]],
                `Account#3 wrong ${Constants.tokens[options.route[0]].symbol} balance`);
            expect(expectedAccountLast).to.equal(accountEnd[lastTokenN],
                `Account#3 wrong ${Constants.tokens[lastTokenN].symbol} balance`);

            const expectedDexFirst = new BigNumber(dexStart[options.route[0]] || 0).plus(options.amount).toString();
            const expectedDexLast = new BigNumber(dexStart[lastTokenN])
                    .minus(
                        new BigNumber(currentAmount)
                            .shiftedBy(-Constants.tokens[lastTokenN].decimals)
                    ).toString();

            expect(expectedDexFirst).to.equal(dexEnd[options.route[0]],
                `DexVault wrong ${Constants.tokens[options.route[0]].symbol} balance`);
            expect(expectedDexLast).to.equal(dexEnd[lastTokenN],
                `DexVault wrong ${Constants.tokens[lastTokenN].symbol} balance`);

            for(let pairId in pairsEnd) {
                if (expectedPairBalances[pairId]) {
                    expect(new BigNumber(pairsEnd[pairId].left_balance).toString()).to.equal(expectedPairBalances[pairId].left_balance,
                        `DexPair${pairsEnd[pairId].left_symbol}${pairsEnd[pairId].right_symbol} wrong ${pairsEnd[pairId].left_symbol} balance`);
                    expect(new BigNumber(pairsEnd[pairId].right_balance).toString()).to.equal(expectedPairBalances[pairId].right_balance,
                        `DexPair${pairsEnd[pairId].left_symbol}${pairsEnd[pairId].right_symbol} wrong ${pairsEnd[pairId].right_symbol} balance`);
                }
            }


        });
    });
});
