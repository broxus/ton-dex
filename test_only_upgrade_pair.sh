locklift build --config locklift.config.js

locklift run --config locklift.config.js --network local --script scripts/0-reset-migration.js
locklift run --config locklift.config.js --network local --script scripts/0-deploy-account.js --key_number='0' --balance='20'
locklift run --config locklift.config.js --network local --script scripts/0-deploy-account.js --key_number='1' --balance='20'
locklift run --config locklift.config.js --network local --script scripts/0-deploy-TokenFactory.js
locklift run --config locklift.config.js --network local --script scripts/1-deploy-vault-and-root.js
locklift run --config locklift.config.js --network local --script scripts/2-deploy-test-tokens.js --tokens='["foo","bar","tst"]'
locklift run --config locklift.config.js --network local --script scripts/5-deploy-test-pair.js --pairs='[["foo", "bar"]]' --contract_name='DexPair'
locklift test --config locklift.config.js --network local --tests test/30-install-pair-code-v2.js --contract_name='DexPairV2'
locklift run --config locklift.config.js --network local --script scripts/5-deploy-test-pair.js --pairs='[["foo", "tst"]]' --contract_name='DexPairV2'
locklift test --config locklift.config.js --network local --tests test/35-upgrade-pair.js --left='foo' --right='bar' --old_contract_name='DexPair' --new_contract_name='DexPairV2'
locklift test --config locklift.config.js --network local --tests test/30-install-pair-code-v2.js --contract_name='TestNewDexPair'
locklift test --config locklift.config.js --network local --tests test/35-upgrade-pair.js --left='foo' --right='bar' --old_contract_name='DexPairV2' --new_contract_name='TestNewDexPair'
