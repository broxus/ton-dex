const fs = require('fs');

const TOKEN_CONTRACTS_PATH = 'node_modules/ton-eth-bridge-token-contracts/build'
const WEVER_CONTRACTS_PATH = 'node_modules/ton-wton/everscale/build'
const EMPTY_TVM_CELL = 'te6ccgEBAQEAAgAAAA==';
const BigNumber = require('bignumber.js');
BigNumber.config({EXPONENTIAL_AT: 257});

const getRandomNonce = () => Math.random() * 64000 | 0;

const stringToBytesArray = (dataString) => {
  return Buffer.from(dataString).toString('hex')
};

const displayAccount = async (contract) => {
  return (
    `Account.${contract.name}${contract.index !== undefined ? '#' + contract.index : ''}` +
    `(address="${contract.address}" balance=${await getBalance(contract)})`
  )
};

const getBalance = async (contract) => {
  return locklift.utils.convertCrystal((await locklift.ton.getBalance(contract.address)), 'ton').toNumber();
}

async function sleep(ms) {
  ms = ms === undefined ? 1000 : ms;
  return new Promise(resolve => setTimeout(resolve, ms));
}

const afterRun = async (tx) => {
  await new Promise(resolve => setTimeout(resolve, 30000));
};

const Constants = {
  tokens: {
    foo: {
      name: 'Foo',
      symbol: 'Foo',
      decimals: 9,
      upgradeable: true
    },
    bar: {
      name: 'Bar',
      symbol: 'Bar',
      decimals: 18,
      upgradeable: false
    },
    tst: {
      name: 'Test',
      symbol: 'Tst',
      decimals: 3,
      upgradeable: true
    },
    qwe: {
      name: 'Qwerty',
      symbol: 'Qwe',
      decimals: 6,
      upgradeable: false
    },
    wever: {
      name: 'Wrapped EVER',
      symbol: 'WEVER',
      decimals: 9,
      upgradeable: true
    }
  },
  LP_DECIMALS: 9,

  TESTS_TIMEOUT: 1200000
}

class Migration {
  constructor(log_path = 'migration-log.json') {
    this.log_path = log_path;
    this.migration_log = {};
    this.balance_history = [];
    this._loadMigrationLog();
  }

  _loadMigrationLog() {
    if (fs.existsSync(this.log_path)) {
      const data = fs.readFileSync(this.log_path, 'utf8');
      if (data) this.migration_log = JSON.parse(data);
    }
  }

  reset() {
    this.migration_log = {};
    this.balance_history = [];
    this._saveMigrationLog();
  }

  _saveMigrationLog() {
    fs.writeFileSync(this.log_path, JSON.stringify(this.migration_log));
  }

  exists(alias) {
    return this.migration_log[alias] !== undefined;
  }

  load(contract, alias) {
    if (this.migration_log[alias] !== undefined) {
      contract.setAddress(this.migration_log[alias].address);
    } else {
      throw new Error(`Contract ${alias} not found in the migration`);
    }
    return contract;
  }

  store(contract, alias) {
    this.migration_log = {
      ...this.migration_log,
      [alias]: {
        address: contract.address,
        name: contract.name
      }
    }
    this._saveMigrationLog();
  }

  async balancesCheckpoint() {
    const b = {};
    for (let alias in this.migration_log) {
      await locklift.ton.getBalance(this.migration_log[alias].address)
          .then(e => b[alias] = e.toString())
          .catch(e => { /* ignored */ });
    }
    this.balance_history.push(b);
  }

  async balancesLastDiff() {
    const d = {};
    for (let alias in this.migration_log) {
      const start = this.balance_history[this.balance_history.length - 2][alias];
      const end = this.balance_history[this.balance_history.length - 1][alias];
      if (end !== start) {
        const change = new BigNumber(end).minus(start || 0).shiftedBy(-9);
        d[alias] = change;
      }
    }
    return d;
  }
}

module.exports = {
  Migration,
  Constants,
  getRandomNonce,
  stringToBytesArray,
  sleep,
  getBalance,
  displayAccount,
  afterRun,
  TOKEN_CONTRACTS_PATH,
  EMPTY_TVM_CELL
}
