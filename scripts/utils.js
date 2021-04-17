const fs = require('fs');

const TOKEN_CONTRACTS_PATH = 'node_modules/ton-eth-bridge-token-contracts/free-ton/build'
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
  await new Promise(resolve => setTimeout(resolve, 10000));
};

class Migration {
  constructor(log_path = 'migration-log.json') {
    this.log_path = log_path;
    this.migration_log = {};
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
}

const Constants = {
  FOO_DECIMALS: 3,
  BAR_DECIMALS: 9,
  LP_DECIMALS: 9,

}
Constants.FOO_DECIMALS_MODIFIER = new BigNumber(10).pow(Constants.FOO_DECIMALS).toNumber();
Constants.BAR_DECIMALS_MODIFIER = new BigNumber(10).pow(Constants.BAR_DECIMALS).toNumber();
Constants.LP_DECIMALS_MODIFIER = new BigNumber(10).pow(Constants.LP_DECIMALS).toNumber();
Constants.TON_DECIMALS_MODIFIER = new BigNumber(10).pow(9).toNumber();

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
