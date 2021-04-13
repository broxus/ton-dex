const {expect} = require('chai');
const {Migration} = require('../scripts/utils');
const BigNumber = require('bignumber.js');
BigNumber.config({EXPONENTIAL_AT: 257});
const logger = require('mocha-logger');

const migration = new Migration();

const TOKEN_CONTRACTS_PATH = 'node_modules/ton-eth-bridge-token-contracts/free-ton/build';

let DexRoot;
let DexPair;
let FooRoot;
let BarRoot;
let LpRoot;
let Account2;
let DexAccount2;

const FOO_DECIMALS = 3;
const BAR_DECIMALS = 18;
const LP_DECIMALS = 9;

const FOO_DECIMALS_MODIFIER = new BigNumber(10).pow(FOO_DECIMALS).toNumber();
const BAR_DECIMALS_MODIFIER = new BigNumber(10).pow(BAR_DECIMALS).toNumber();
const LP_DECIMALS_MODIFIER = new BigNumber(10).pow(LP_DECIMALS).toNumber();
const TON_DECIMALS_MODIFIER = new BigNumber(10).pow(9).toNumber();

const EMPTY_TVM_CELL = 'te6ccgEBAQEAAgAAAA==';

let IS_FOO_LEFT;

let keyPairs;

async function dexAccountBalances(account) {
    const foo = new BigNumber((await account.call({method: 'getWalletData', params: {
        _answer_id: 0,
        token_root: FooRoot.address
    }})).balance).div(FOO_DECIMALS_MODIFIER).toString();
    const bar = new BigNumber((await account.call({method: 'getWalletData', params: {
        _answer_id: 0,
        token_root: BarRoot.address
    }})).balance).div(BAR_DECIMALS_MODIFIER).toString();
    const lp = new BigNumber((await account.call({method: 'getWalletData', params: {
        _answer_id: 0,
        token_root: LpRoot.address
    }})).balance).div(LP_DECIMALS_MODIFIER).toString();

    return {foo, bar, lp};
}

describe('Deposit liquidity', async function () {
    before('Load contracts', async function () {
        keyPairs = await locklift.keys.getKeyPairs();

        DexRoot = await locklift.factory.getContract('DexRoot');
        DexPair = await locklift.factory.getContract('DexPair');
        FooRoot = await locklift.factory.getContract('RootTokenContract', TOKEN_CONTRACTS_PATH);
        BarRoot = await locklift.factory.getContract('RootTokenContract', TOKEN_CONTRACTS_PATH);
        LpRoot = await locklift.factory.getContract('RootTokenContract', TOKEN_CONTRACTS_PATH);
        Account2 = await locklift.factory.getAccount();
        DexAccount2 = await locklift.factory.getContract('DexAccount');

        migration.load(DexRoot, 'DexRoot');
        migration.load(DexPair, 'DexPair');
        migration.load(FooRoot, 'FooRoot');
        migration.load(BarRoot, 'BarRoot');
        migration.load(LpRoot, 'LpRoot');
        migration.load(Account2, 'Account2');
        migration.load(DexAccount2, 'DexAccount2');

        const pairRoots = DexPair.call({method: 'getTokenRoots', params: {_answer_id: 0}});
        IS_FOO_LEFT = pairRoots.left === FooRoot.address;

        logger.log('DexRoot: ' + DexRoot.address);
        logger.log('DexPair: ' + DexPair.address);
        logger.log('FooRoot: ' + BarRoot.address);
        logger.log('BarRoot: ' + BarRoot.address);
        logger.log('LpRoot: ' + LpRoot.address);
        logger.log('Account#2: ' + Account2.address);
        logger.log('DexAccount#2: ' + DexAccount2.address);
    });

    describe('Deposit with auto_change=true', async function () {

        it('', async function () {
                //TODO: 
        });

    });

});
