const fs = require('fs');

const tonTokenContractsPath = 'node_modules/ton-eth-bridge-token-contracts/free-ton/build'

const getRandomNonce = () => Math.random() * 64000 | 0;

const stringToBytesArray = (dataString) => {
  return Buffer.from(dataString).toString('hex')
};

const displayAccount = async (contract) => {
  return (
    `Account.${contract.name}${contract.index !== undefined ? '#'+contract.index : ''}`+
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

  _saveMigrationLog() {
    fs.writeFileSync(this.log_path, JSON.stringify(this.migration_log));
  }

  load(contract, alias) {
    if (this.migration_log[alias] !== undefined) {
      contract.address = this.migration_log[alias].address;
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


module.exports = {
  Migration,
  getRandomNonce,
  stringToBytesArray,
  sleep,
  getBalance,
  displayAccount,
  tonTokenContractsPath
}
