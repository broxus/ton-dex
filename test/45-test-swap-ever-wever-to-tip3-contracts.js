const { Migration, afterRun, Constants, TOKEN_CONTRACTS_PATH, EMPTY_TVM_CELL } = require(process.cwd() + '/scripts/utils');
const BigNumber = require('bignumber.js');
const { expect } = require('chai');
BigNumber.config({ EXPONENTIAL_AT: 257 });
const logger = require('mocha-logger');

const migration = new Migration();

let account2;
let account3;
let keyPairs;
let everToTip3;
let tip3ToEver;
let everWeverToTip3;
let dexPair;
let wEverRoot;
let tstRoot;
let wEverVault;
let tstWallet3;
let tstVaultWallet;
let wEverVaultWallet;
let IS_WEVER_LEFT;
let wEverWallet2
let wEverWallet3;

describe('Tests Swap Evers', async function () {
    this.timeout(Constants.TESTS_TIMEOUT);

    before('Load contracts', async function () {
        everToTip3 = migration.load(await locklift.factory.getContract('EverToTip3'), 'EverToTip3');
        tip3ToEver = migration.load(await locklift.factory.getContract('Tip3ToEver'), 'Tip3ToEver');
        everWeverToTip3 = migration.load(await locklift.factory.getContract('EverWeverToTip3'), 'EverWeverToTip3');

        keyPairs = await locklift.keys.getKeyPairs();
        dexPair = migration.load(await locklift.factory.getContract('DexPair'), 'DexPairTstWEVER');
        wEverRoot = migration.load(await locklift.factory.getContract('TokenRootUpgradeable', TOKEN_CONTRACTS_PATH), 'WEVERRoot');
        tstRoot = migration.load(await locklift.factory.getContract('TokenRootUpgradeable', TOKEN_CONTRACTS_PATH), 'TstRoot');
        wEverVault = migration.load(await locklift.factory.getContract('TestWeverVault'), 'WEVERVault');
        tstWallet3 = await locklift.factory.getContract('TokenWalletUpgradeable', TOKEN_CONTRACTS_PATH);
        wEverWallet3 = await locklift.factory.getContract('TokenWalletUpgradeable', TOKEN_CONTRACTS_PATH);
        wEverWallet2 = migration.load(await locklift.factory.getContract('TokenWalletUpgradeable', TOKEN_CONTRACTS_PATH), 'WEVERWallet2');
        tstVaultWallet = migration.load(await locklift.factory.getContract('TokenWalletUpgradeable', TOKEN_CONTRACTS_PATH), 'TstVaultWallet');
        wEverVaultWallet = migration.load(await locklift.factory.getContract('TokenWalletUpgradeable', TOKEN_CONTRACTS_PATH), 'WEVERVaultWallet');

        const pairRoots = await dexPair.call({ method: 'getTokenRoots', params: {} });
        IS_WEVER_LEFT = pairRoots.left === wEverRoot.address;

        account2 = migration.load(await locklift.factory.getAccount('Wallet'), 'Account2');
        account3 = migration.load(await locklift.factory.getAccount('Wallet'), 'Account3');
        account3.afterRun = afterRun;

        const tokenWalletAddress = await tstRoot.call({
            method: 'walletOf', params: {
                walletOwner: account3.address
            }
        });

        tstWallet3.setAddress(tokenWalletAddress);
        migration.store(tstWallet3, 'TstWallet3');

        tokenWalletAddressWever = await wEverRoot.call({
            method: 'walletOf', params: {
                walletOwner: account3.address
            }
        });

        wEverWallet3.setAddress(tokenWalletAddressWever);
        migration.store(wEverWallet3, 'WEVERWallet3');

        logger.log(`account3(wEverVault.address).wrap(
            tokens = ${new BigNumber(20).shiftedBy(9).toString()},
            owner_address: ${everToTip3.address},
            gas_back_address: ${account3.address},
            payload: EMPTY_TVM_CELL}
        )`);
        const txWrap = await account3.runTarget({
            contract: wEverVault,
            method: 'wrap',
            params: {
                tokens: new BigNumber(20).shiftedBy(9).toString(),
                owner_address: account3.address,
                gas_back_address: account3.address,
                payload: EMPTY_TVM_CELL
            },
            value: locklift.utils.convertCrystal(20 + 2, 'nano'),
            keyPair: keyPairs[2]
        });
        logger.log(`txId: ${txWrap.transaction.id}`);
        logger.log(``);

        logger.log(`EverToTip3: ${everToTip3.address}`);
        logger.log(`Tip3ToEver: ${tip3ToEver.address}`);
        logger.log(`EverWEverToTip3: ${everWeverToTip3.address}`);
        logger.log(`DexPair: ${dexPair.address}`);
        logger.log(`WeverRoot: ${wEverRoot.address}`);
        logger.log(`TstRoot: ${tstRoot.address}`);
        logger.log(`WEverVault: ${wEverVault.address}`);
        logger.log(`TstVaultWallet: ${tstVaultWallet.address}`);
        logger.log(`WeverVaultWallet: ${wEverVaultWallet.address}`);
        logger.log(`Account2: ${account2.address}`);
        logger.log(`Account3: ${account3.address}`);
        logger.log(`TstWallet3: ${tstWallet3.address}`);
        logger.log(`wEverWallet3: ${wEverWallet3.address}`);
    });

    describe('Swap Ever to Tip3', async function () {
        it(`Swap Ever to Tip3 via  () - Success`, async function () {
            await migration.balancesCheckpoint();
            logger.log(`#############################`);
            logger.log(``);

            const EVERS_TO_EXCHANGE = 20;
            const expected = await dexPair.call({
                method: 'expectedExchange', params: {
                    amount: new BigNumber(EVERS_TO_EXCHANGE).shiftedBy(9).toString(),
                    spent_token_root: wEverRoot.address
                }
            });

            logger.log(`Spent amount: ${EVERS_TO_EXCHANGE} WEVER`);
            logger.log(`Expected fee: ${new BigNumber(expected.expected_fee).shiftedBy(-9).toString()} WEVER`);
            logger.log(`Expected receive amount: ${new BigNumber(expected.expected_amount).shiftedBy(-Constants.tokens.tst.decimals).toString()} TST`);

            const params = {
                id: 66,
                amount: new BigNumber(EVERS_TO_EXCHANGE).shiftedBy(9).toString(),
                pair: dexPair.address,
                expectedAmount: expected.expected_amount,
                deployWalletValue: locklift.utils.convertCrystal('0.1', 'nano')
            }

            logger.log(`EverToTip3.buildExchangePayload(${JSON.stringify(params)})`);
            const payload = await everToTip3.call({
                method: 'buildExchangePayload',
                params: params
            });
            logger.log(`Result payload = ${payload}`);

            const dexStart = await dexBalances();
            const accountStart = await account3balances();
            const pairStart = await dexPairInfo();
            logBalances('start', dexStart, accountStart, pairStart);

            logger.log(`wEverVault(wEverVault.address).wrap(
                tokens = ${new BigNumber(EVERS_TO_EXCHANGE).shiftedBy(9).toString()},
                owner_address: ${everToTip3.address},
                gas_back_address: ${account3.address},
                payload: {${JSON.stringify(params)}}
            )`);
            const tx = await account3.runTarget({
                contract: wEverVault,
                method: 'wrap',
                params: {
                    tokens: new BigNumber(EVERS_TO_EXCHANGE).shiftedBy(9).toString(),
                    owner_address: everToTip3.address,
                    gas_back_address: account3.address,
                    payload: payload
                },
                value: locklift.utils.convertCrystal((EVERS_TO_EXCHANGE) + 5, 'nano'),
                keyPair: keyPairs[2]
            });
            logger.log(`txId: ${tx.transaction.id}`);

            const dexEnd = await dexBalances();
            const accountEnd = await account3balances();
            const pairEnd = await dexPairInfo();
            logBalances('end', dexEnd, accountEnd, pairEnd);
            await logGas();

            const expectedAccountTst = new BigNumber(accountStart.tst || 0).plus(new BigNumber(expected.expected_amount).shiftedBy(-Constants.tokens.tst.decimals)).toString();
            expect(expectedAccountTst).to.equal(accountEnd.tst.toString(), 'Wrong Account#3 TST balance');
        });

            it(`Swap Ever to Tip3 via swapEvers() - Success`, async function () {
                await migration.balancesCheckpoint();
                logger.log(`#############################`);
                logger.log(``);

                const EVERS_TO_EXCHANGE = 20;
                const expected = await dexPair.call({
                    method: 'expectedExchange', params: {
                        amount: new BigNumber(EVERS_TO_EXCHANGE).shiftedBy(9).toString(),
                        spent_token_root: wEverRoot.address
                    }
                });

                logger.log(`Spent amount: ${EVERS_TO_EXCHANGE} WEVER`);
                logger.log(`Expected fee: ${new BigNumber(expected.expected_fee).shiftedBy(-9).toString()} WEVER`);
                logger.log(`Expected receive amount: ${new BigNumber(expected.expected_amount).shiftedBy(-Constants.tokens.tst.decimals).toString()} TST`);

                const params = {
                    id: 66,
                    amount: new BigNumber(EVERS_TO_EXCHANGE).shiftedBy(9).toString(),
                    pair: dexPair.address,
                    expectedAmount: expected.expected_amount,
                    deployWalletValue: locklift.utils.convertCrystal('0.1', 'nano')
                }

                logger.log(`EverToTip3.buildExchangePayload(${JSON.stringify(params)})`);
                const payload = await everToTip3.call({
                    method: 'buildExchangePayload',
                    params: params
                });
                logger.log(`Result payload = ${payload}`);

                const dexStart = await dexBalances();
                const accountStart = await account3balances();
                const pairStart = await dexPairInfo();
                logBalances('start', dexStart, accountStart, pairStart);

                logger.log(`EverToTip3(${everToTip3.address}).swapEvers(
                    user: ${account3.address},
                    payload: {${JSON.stringify(params)}}
                )`);
                const tx = await account3.runTarget({
                    contract: everToTip3,
                    method: 'swapEvers',
                    params: {
                        user: account3.address,
                        payload: payload
                    },
                    value: locklift.utils.convertCrystal((EVERS_TO_EXCHANGE) + 5, 'nano'),
                    keyPair: keyPairs[2]
                });
                logger.log(`txId: ${tx.transaction.id}`);

                const dexEnd = await dexBalances();
                const accountEnd = await account3balances();
                const pairEnd = await dexPairInfo();
                logBalances('end', dexEnd, accountEnd, pairEnd);

                await logGas();

                const expectedAccountTst = new BigNumber(accountStart.tst || 0).plus(new BigNumber(expected.expected_amount).shiftedBy(-Constants.tokens.tst.decimals)).toString();
                expect(expectedAccountTst).to.equal(accountEnd.tst.toString(), 'Wrong Account#3 TST balance');
            });

            it(`Swap Ever to Tip3 via wrap() - Cancel`, async function () {
                await migration.balancesCheckpoint();
                logger.log(`#############################`);
                logger.log(``);

                const EVERS_TO_EXCHANGE = 20;
                const expected = await dexPair.call({
                    method: 'expectedExchange', params: {
                        amount: new BigNumber(EVERS_TO_EXCHANGE).shiftedBy(9).toString(),
                        spent_token_root: wEverRoot.address
                    }
                });

                logger.log(`Spent amount: ${EVERS_TO_EXCHANGE} WEVER`);
                logger.log(`Expected fee: ${new BigNumber(expected.expected_fee).shiftedBy(-9).toString()} WEVER`);
                logger.log(`Expected receive amount: ${new BigNumber(expected.expected_amount).shiftedBy(-Constants.tokens.tst.decimals).toString()} TST`);

                const params = {
                    id: 66,
                    amount: new BigNumber(EVERS_TO_EXCHANGE).shiftedBy(9).toString(),
                    pair: dexPair.address,
                    expectedAmount: new BigNumber(expected.expected_amount).times(2).toString(),
                    deployWalletValue: locklift.utils.convertCrystal('0.1', 'nano')
                }

                logger.log(`EverToTip3.buildExchangePayload(${JSON.stringify(params)})`);
                const payload = await everToTip3.call({
                    method: 'buildExchangePayload',
                    params: params
                });
                logger.log(`Result payload = ${payload}`);

                const dexStart = await dexBalances();
                const accountStart = await account3balances();
                const pairStart = await dexPairInfo();
                logBalances('start', dexStart, accountStart, pairStart);

                logger.log(`wEverVault(${wEverVault.address}).wrap(
                    tokens = ${new BigNumber(EVERS_TO_EXCHANGE).shiftedBy(9).toString()},
                    owner_address: ${everToTip3.address},
                    gas_back_address: ${account3.address},
                    payload: {${JSON.stringify(params)}}
                )`);
                const tx = await account3.runTarget({
                    contract: wEverVault,
                    method: 'wrap',
                    params: {
                        tokens: new BigNumber(EVERS_TO_EXCHANGE).shiftedBy(9).toString(),
                        owner_address: everToTip3.address,
                        gas_back_address: account3.address,
                        payload: payload
                    },
                    value: locklift.utils.convertCrystal((EVERS_TO_EXCHANGE) + 5, 'nano'),
                    keyPair: keyPairs[2]
                });
                logger.log(`txId: ${tx.transaction.id}`);

                const dexEnd = await dexBalances();
                const accountEnd = await account3balances();
                const pairEnd = await dexPairInfo();
                logBalances('end', dexEnd, accountEnd, pairEnd);

                await logGas();

                expect(accountStart.tst.toString()).to.equal(accountEnd.tst.toString(), 'Wrong Account#3 TST balance');
                expect(new BigNumber(accountStart.ever).minus(5).toNumber()).lt(new BigNumber(accountEnd.ever).toNumber(), 'Wrong Account#3 TST balance');
            });
    });

    describe('Swap Tip3 to Ever', async function () {
        it(`Swap Tip3 to Ever - Cancel`, async function () {
            await migration.balancesCheckpoint();
            logger.log(`#############################`);
            logger.log(``);

            const dexStart = await dexBalances();
            const accountStart = await account3balances();
            const pairStart = await dexPairInfo();
            logBalances('start', dexStart, accountStart, pairStart);
            const TOKENS_TO_EXCHANGE = accountStart.tst;
            const expected = await dexPair.call({
                method: 'expectedExchange', params: {
                    amount: new BigNumber(TOKENS_TO_EXCHANGE).shiftedBy(Constants.tokens.tst.decimals).toString(),
                    spent_token_root: tstRoot.address
                }
            });

            logger.log(`Spent amount: ${TOKENS_TO_EXCHANGE} TST`);
            logger.log(`Expected fee: ${new BigNumber(expected.expected_fee).shiftedBy(-Constants.tokens.tst.decimals).toString()} TST`);
            logger.log(`Expected receive amount: ${new BigNumber(expected.expected_amount).shiftedBy(-9).toString()} EVER`);

            const params = {
                id: 66,
                pair: dexPair.address,
                expectedAmount: new BigNumber(expected.expected_amount).times(2).toString(),
            }

            logger.log(`Tip3ToEver.buildExchangePayload(${JSON.stringify(params)})`);
            const payload = await tip3ToEver.call({
                method: 'buildExchangePayload',
                params: params
            });
            logger.log(`Result payload = ${payload}`);

            logger.log(`tstWallet3(${tstWallet3.address}).transfer(
                amount: ${new BigNumber(TOKENS_TO_EXCHANGE).shiftedBy(Constants.tokens.tst.decimals).toString()},
                recipient: ${tip3ToEver.address},
                deployWalletValue: ${locklift.utils.convertCrystal(0.1, 'nano')},
                remainingGasTo: ${account3.address},
                notify: ${true},
                payload: {${JSON.stringify(params)}}
            )`);
            const tx = await account3.runTarget({
                contract: tstWallet3,
                method: 'transfer',
                params: {
                    amount: new BigNumber(TOKENS_TO_EXCHANGE).shiftedBy(Constants.tokens.tst.decimals).toString(),
                    recipient: tip3ToEver.address,
                    deployWalletValue: locklift.utils.convertCrystal(0.1, 'nano'),
                    remainingGasTo: account3.address,
                    notify: true,
                    payload: payload
                },
                value: locklift.utils.convertCrystal(3.6, 'nano'),
                keyPair: keyPairs[2]
            });
            logger.log(`txId: ${tx.transaction.id}`);

            const dexEnd = await dexBalances();
            const accountEnd = await account3balances();
            const pairEnd = await dexPairInfo();
            logBalances('end', dexEnd, accountEnd, pairEnd);
            await logGas();

            expect(accountStart.tst.toString()).to.equal(accountEnd.tst.toString(), 'Wrong Account#3 TST balance');
        });

        it(`Swap Tip3 to Ever - Success`, async function () {
            await migration.balancesCheckpoint();
            logger.log(`#############################`);
            logger.log(``);

            const dexStart = await dexBalances();
            const accountStart = await account3balances();
            const pairStart = await dexPairInfo();
            logBalances('start', dexStart, accountStart, pairStart);
            const TOKENS_TO_EXCHANGE = accountStart.tst;
            const expected = await dexPair.call({
                method: 'expectedExchange', params: {
                    amount: new BigNumber(TOKENS_TO_EXCHANGE).shiftedBy(Constants.tokens.tst.decimals).toString(),
                    spent_token_root: tstRoot.address
                }
            });

            logger.log(`Spent amount: ${TOKENS_TO_EXCHANGE} TST`);
            logger.log(`Expected fee: ${new BigNumber(expected.expected_fee).shiftedBy(-Constants.tokens.tst.decimals).toString()} TST`);
            logger.log(`Expected receive amount: ${new BigNumber(expected.expected_amount).shiftedBy(-9).toString()} EVER`);

            const params = {
                id: 66,
                pair: dexPair.address,
                expectedAmount: expected.expected_amount,
            }

            logger.log(`Tip3ToEver.buildExchangePayload(${JSON.stringify(params)})`);
            const payload = await tip3ToEver.call({
                method: 'buildExchangePayload',
                params: params
            });
            logger.log(`Result payload = ${payload}`);

            logger.log(`tstWallet3(${tstWallet3.address}).transfer(
                amount: ${new BigNumber(TOKENS_TO_EXCHANGE).shiftedBy(Constants.tokens.tst.decimals).toString()},
                recipient: ${tip3ToEver.address},
                deployWalletValue: ${locklift.utils.convertCrystal(0.1, 'nano')},
                remainingGasTo: ${account3.address},
                notify: ${true},
                payload: {${JSON.stringify(params)}}
            )`);
            const tx = await account3.runTarget({
                contract: tstWallet3,
                method: 'transfer',
                params: {
                    amount: new BigNumber(TOKENS_TO_EXCHANGE).shiftedBy(Constants.tokens.tst.decimals).toString(),
                    recipient: tip3ToEver.address,
                    deployWalletValue: locklift.utils.convertCrystal(0.1, 'nano'),
                    remainingGasTo: account3.address,
                    notify: true,
                    payload: payload
                },
                value: locklift.utils.convertCrystal(3.6, 'nano'),
                keyPair: keyPairs[2]
            });
            logger.log(`txId: ${tx.transaction.id}`);

            const dexEnd = await dexBalances();
            const accountEnd = await account3balances();
            const pairEnd = await dexPairInfo();
            logBalances('end', dexEnd, accountEnd, pairEnd);
            await logGas();

            const expectedAccountTst = new BigNumber(accountStart.tst).minus(TOKENS_TO_EXCHANGE).toString();
            expect(expectedAccountTst).to.equal(accountEnd.tst.toString(), 'Wrong Account#3 TST balance');
            const expectedAccountEverMin = new BigNumber(accountStart.ever).plus(new BigNumber(expected.expected_amount).shiftedBy(-9)).minus(3.6).toNumber();
            expect(expectedAccountEverMin).to.lt(new BigNumber(accountEnd.ever).toNumber(), 'Wrong Account#3 EVER balance');
        });
    });

    describe('Swap Ever and Wever to Tip3', async function () {
        it(`Swap Ever and Wever to Tip3 - Cancel`, async function () {
            await migration.balancesCheckpoint();
            logger.log(`#############################`);
            logger.log(``);

            const EVERS_TO_EXCHANGE = 5;
            const WEVERS_TO_EXCHANGE = 5;

            const expected = await dexPair.call({
                method: 'expectedExchange', params: {
                    amount: new BigNumber(EVERS_TO_EXCHANGE + WEVERS_TO_EXCHANGE).shiftedBy(9).toString(),
                    spent_token_root: wEverRoot.address
                }
            });

            logger.log(`Spent amount: ${EVERS_TO_EXCHANGE} EVER`);
            logger.log(`Spent amount: ${WEVERS_TO_EXCHANGE} WEVER`);
            logger.log(`Expected fee: ${new BigNumber(expected.expected_fee).shiftedBy(-9).toString()} WEVER`);
            logger.log(`Expected receive amount: ${new BigNumber(expected.expected_amount).shiftedBy(-Constants.tokens.tst.decimals).toString()} TST`);

            const params = {
                id: 11,
                amount: new BigNumber(EVERS_TO_EXCHANGE + WEVERS_TO_EXCHANGE).shiftedBy(9).toString(),
                pair: dexPair.address,
                expectedAmount: new BigNumber(expected.expected_amount).times(2).toString(),
                deployWalletValue: locklift.utils.convertCrystal('0.1', 'nano')
            }

            logger.log(`everWeverToTip3.buildExchangePayload(${JSON.stringify(params)})`);
            const payload = await everWeverToTip3.call({
                method: 'buildExchangePayload',
                params: params
            });
            logger.log(`Result payload = ${payload}`);

            const dexStart = await dexBalances();
            const accountStart = await account3balances();
            const pairStart = await dexPairInfo();
            logBalances('start', dexStart, accountStart, pairStart);

            logger.log(`account3(${account3.address}).transfer(
                    amount: ${new BigNumber(WEVERS_TO_EXCHANGE).shiftedBy(9).toString()},
                    recipient: ${everWeverToTip3.address},
                    deployWalletValue: ${locklift.utils.convertCrystal(0.1, 'nano')},
                    remainingGasTo: ${account3.address},
                    notify: ${true},
                    payload: {${JSON.stringify(params)}}
                )`);

            const tx = await account3.runTarget({
                contract: wEverWallet3,
                method: 'transfer',
                params: {
                    amount: BigNumber(WEVERS_TO_EXCHANGE).shiftedBy(9).toString(),
                    recipient: everWeverToTip3.address,
                    deployWalletValue: locklift.utils.convertCrystal(0.1, 'nano'),
                    remainingGasTo: account3.address,
                    notify: true,
                    payload: payload
                },
                value: locklift.utils.convertCrystal(EVERS_TO_EXCHANGE + 5, 'nano'),
                keyPair: keyPairs[2]
            });
            logger.log(`txId: ${tx.transaction.id}`);

            const dexEnd = await dexBalances();
            const accountEnd = await account3balances();
            const pairEnd = await dexPairInfo();
            logBalances('end', dexEnd, accountEnd, pairEnd);

            await logGas();

            expect(accountStart.tst.toString()).to.equal(accountEnd.tst.toString(), 'Wrong Account#3 TST balance');
        });

        it(`Swap Ever and Wever to Tip3 - Success`, async function () {
            await migration.balancesCheckpoint();
            logger.log(`#############################`);
            logger.log(``);

            const EVERS_TO_EXCHANGE = 5;
            const WEVERS_TO_EXCHANGE = 5;

            const expected = await dexPair.call({
                method: 'expectedExchange', params: {
                    amount: new BigNumber(EVERS_TO_EXCHANGE + WEVERS_TO_EXCHANGE).shiftedBy(9).toString(),
                    spent_token_root: wEverRoot.address
                }
            });

            logger.log(`Spent amount: ${EVERS_TO_EXCHANGE} EVER`);
            logger.log(`Spent amount: ${WEVERS_TO_EXCHANGE} WEVER`);
            logger.log(`Expected fee: ${new BigNumber(expected.expected_fee).shiftedBy(-9).toString()} WEVER`);
            logger.log(`Expected receive amount: ${new BigNumber(expected.expected_amount).shiftedBy(-Constants.tokens.tst.decimals).toString()} TST`);

            const params = {
                id: 11,
                amount: new BigNumber(EVERS_TO_EXCHANGE + WEVERS_TO_EXCHANGE).shiftedBy(9).toString(),
                pair: dexPair.address,
                expectedAmount: expected.expected_amount,
                deployWalletValue: locklift.utils.convertCrystal('0.1', 'nano')
            }

            logger.log(`everWeverToTip3.buildExchangePayload(${JSON.stringify(params)})`);
            const payload = await everWeverToTip3.call({
                method: 'buildExchangePayload',
                params: params
            });
            logger.log(`Result payload = ${payload}`);

            const dexStart = await dexBalances();
            const accountStart = await account3balances();
            const pairStart = await dexPairInfo();
            logBalances('start', dexStart, accountStart, pairStart);

            logger.log(`account3(${account3.address}).transfer(
                    amount: ${new BigNumber(WEVERS_TO_EXCHANGE).shiftedBy(9).toString()},
                    recipient: ${everWeverToTip3.address},
                    deployWalletValue: ${locklift.utils.convertCrystal(0.1, 'nano')},
                    remainingGasTo: ${account3.address},
                    notify: ${true},
                    payload: {${JSON.stringify(params)}}
                )`);

            const tx = await account3.runTarget({
                contract: wEverWallet3,
                method: 'transfer',
                params: {
                    amount: BigNumber(WEVERS_TO_EXCHANGE).shiftedBy(9).toString(),
                    recipient: everWeverToTip3.address,
                    deployWalletValue: locklift.utils.convertCrystal(0.1, 'nano'),
                    remainingGasTo: account3.address,
                    notify: true,
                    payload: payload
                },
                value: locklift.utils.convertCrystal(EVERS_TO_EXCHANGE + 5, 'nano'),
                keyPair: keyPairs[2]
            });
            logger.log(`txId: ${tx.transaction.id}`);

            const dexEnd = await dexBalances();
            const accountEnd = await account3balances();
            const pairEnd = await dexPairInfo();
            logBalances('end', dexEnd, accountEnd, pairEnd);

            await logGas();

            const expectedAccountTst = new BigNumber(accountStart.tst || 0).plus(new BigNumber(expected.expected_amount).shiftedBy(-Constants.tokens.tst.decimals)).toString();
            expect(expectedAccountTst).to.equal(accountEnd.tst.toString(), 'Wrong Account#3 TST balance');
        });
    });
});

async function logGas() {
    await migration.balancesCheckpoint();
    const diff = await migration.balancesLastDiff();
    if (diff) {
        logger.log(`### GAS STATS ###`);
        for (let alias in diff) {
            logger.log(`${alias}: ${diff[alias].gt(0) ? '+' : ''}${diff[alias].toFixed(9)} EVER`);
        }
    }
}

async function dexBalances() {
    const tst = await tstVaultWallet.call({ method: 'balance', params: {} }).then(n => {
        return new BigNumber(n).shiftedBy(-Constants.tokens.tst.decimals).toString();
    });
    const wever = await wEverVaultWallet.call({ method: 'balance', params: {} }).then(n => {
        return new BigNumber(n).shiftedBy(-Constants.tokens.wever.decimals).toString();
    });
    return { tst, wever };
}

async function account3balances() {
    let tst;
    await tstWallet3.call({ method: 'balance', params: {} }).then(n => {
        tst = new BigNumber(n).shiftedBy(-Constants.tokens.tst.decimals).toString();
    }).catch(e => {/*ignored*/ });

    let wever;
    await wEverWallet3.call({ method: 'balance', params: {} }).then(n => {
        wever = new BigNumber(n).shiftedBy(-Constants.tokens.wever.decimals).toString();
    }).catch(e => {/*ignored*/ });

    const ever = await locklift.utils.convertCrystal((await locklift.ton.getBalance(account3.address)), 'ton').toNumber();

    return { tst, ever, wever };
}

function logBalances(header, dex, account, pair) {
    logger.log(`DEX balance ${header}: ${dex.tst} TST, ${dex.wever} WEVER`);
    logger.log(`Account#3 balance ${header}: ` +
        `${account.tst !== undefined ? account.tst + ' TST' : 'TST'}, ` +
        `${account.ever !== undefined ? account.ever + ' EVER' : 'Ever'}, ` +
        `${account.wever !== undefined ? account.wever + ' WEVER' : 'Wever'}`);
    logger.log(`Pair balance ${header}: ` +
        `${pair.tst !== undefined ? pair.tst + ' TST' : 'TST'}, ` +
        `${pair.wever !== undefined ? pair.wever + ' WEVER' : 'WEVER'}`);
}

async function dexPairInfo() {
    const balances = await dexPair.call({ method: 'getBalances', params: {} });
    let wever, tst;
    if (IS_WEVER_LEFT) {
        wever = new BigNumber(balances.left_balance).shiftedBy(-9).toString();
        tst = new BigNumber(balances.right_balance).shiftedBy(-Constants.tokens.tst.decimals).toString();
    } else {
        wever = new BigNumber(balances.right_balance).shiftedBy(-9).toString();
        tst = new BigNumber(balances.left_balance).shiftedBy(-Constants.tokens.tst.decimals).toString();
    }

    return {
        wever: wever,
        tst: tst
    };
}
