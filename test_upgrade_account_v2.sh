locklift build --config locklift.config.js

locklift run --config locklift.config.js --network local --script scripts/0-reset-migration.js
locklift run --config locklift.config.js --network local --script scripts/0-deploy-account.js --key_number='0' --balance='20'
locklift run --config locklift.config.js --network local --script scripts/0-deploy-account.js --key_number='1' --balance='50'
locklift run --config locklift.config.js --network local --script scripts/0-deploy-TokenFactory.js
locklift run --config locklift.config.js --network local --script scripts/1-deploy-vault-and-root.js
locklift run --config locklift.config.js --network local --script scripts/4-deploy-test-dex-account.js --owner_n='1' --contract_name='DexAccount'
locklift run --config locklift.config.js --network local --script scripts/4-deploy-test-dex-account.js --owner_n='2' --contract_name='DexAccount'
locklift test --config locklift.config.js --network local --tests test/31-install-account-code.js --contract_name='DexAccountV2'
locklift test --config locklift.config.js --network local --tests test/36-upgrade-account.js --owner_n='1' --old_contract_name='DexAccount' --new_contract_name='DexAccountV2'
locklift test --config locklift.config.js --network local --tests test/37-upgrade-account-force.js --owner_n='2' --old_contract_name='DexAccount' --new_contract_name='DexAccountV2'
locklift test --config locklift.config.js --network local --tests test/31-install-account-code.js --contract_name='TestNewDexAccount'
locklift test --config locklift.config.js --network local --tests test/36-upgrade-account.js --owner_n='1' --old_contract_name='DexAccountV2' --new_contract_name='TestNewDexAccount'
locklift test --config locklift.config.js --network local --tests test/37-upgrade-account-force.js --owner_n='2' --old_contract_name='DexAccountV2' --new_contract_name='TestNewDexAccount'
