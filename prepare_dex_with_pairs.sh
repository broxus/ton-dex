locklift build --config locklift.config.js

locklift run --config locklift.config.js --network local --script scripts/0-reset-migration.js
locklift run --config locklift.config.js --network local --script scripts/0-deploy-account.js --key_number='0' --balance='50'
locklift run --config locklift.config.js --network local --script scripts/0-deploy-account.js --key_number='1' --balance='50'
locklift run --config locklift.config.js --network local --script scripts/0-deploy-TokenFactory.js
locklift run --config locklift.config.js --network local --script scripts/1-deploy-vault-and-root.js --account_contract_name='DexAccount' --pair_contract_name='DexPair'
locklift run --config locklift.config.js --network local --script scripts/2-deploy-test-tokens.js --tokens='["foo","bar","qwe","tst"]'
locklift run --config locklift.config.js --network local --script scripts/5-deploy-test-pair.js --pairs='[["foo", "bar"]]' --contract_name='DexPair'
locklift run --config locklift.config.js --network local --script scripts/5-deploy-test-pair.js --pairs='[["foo", "qwe"]]' --contract_name='DexPair'
locklift run --config locklift.config.js --network local --script scripts/5-deploy-test-pair.js --pairs='[["qwe", "bar"]]' --contract_name='DexPair'
locklift run --config locklift.config.js --network local --script scripts/5-deploy-test-pair.js --pairs='[["foo", "tst"]]' --contract_name='DexPair'
locklift run --config locklift.config.js --network local --script scripts/5-deploy-test-pair.js --pairs='[["tst", "bar"]]' --contract_name='DexPair'
locklift run --config locklift.config.js --network local --script scripts/5-deploy-test-pair.js --pairs='[["qwe", "tst"]]' --contract_name='DexPair'
