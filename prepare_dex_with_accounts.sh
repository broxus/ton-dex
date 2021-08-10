locklift build --config locklift.config.js

locklift run --config locklift.config.js --network local --script scripts/0-reset-migration.js
locklift run --config locklift.config.js --network local --script scripts/0-deploy-account.js --key_number='0' --balance='15'
locklift run --config locklift.config.js --network local --script scripts/0-deploy-account.js --key_number='1' --balance='5'
locklift run --config locklift.config.js --network local --script scripts/0-deploy-account.js --key_number='2' --balance='5'
locklift run --config locklift.config.js --network local --script scripts/0-deploy-account.js --key_number='3' --balance='5'
locklift run --config locklift.config.js --network local --script scripts/0-deploy-account.js --key_number='4' --balance='5'
locklift run --config locklift.config.js --network local --script scripts/0-deploy-TokenFactory.js
locklift run --config locklift.config.js --network local --script scripts/1-deploy-vault-and-root.js --pair_contract_name='DexPairV2'
locklift run --config locklift.config.js --network local --script scripts/4-deploy-test-dex-account.js --owner_n='1' --contract_name='DexAccount'
locklift run --config locklift.config.js --network local --script scripts/4-deploy-test-dex-account.js --owner_n='2' --contract_name='DexAccount'
locklift run --config locklift.config.js --network local --script scripts/4-deploy-test-dex-account.js --owner_n='3' --contract_name='DexAccount'
locklift run --config locklift.config.js --network local --script scripts/4-deploy-test-dex-account.js --owner_n='4' --contract_name='DexAccount'
locklift run --config locklift.config.js --network local --script scripts/4-deploy-test-dex-account.js --owner_n='5' --contract_name='DexAccount'
#locklift test --config locklift.config.js --network local --tests test/31-install-account-code.js --contract_name='DexAccountV2'
