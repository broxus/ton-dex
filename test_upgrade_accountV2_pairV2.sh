locklift build --config locklift.config.js

locklift run --config locklift.config.js --network prod --script scripts/0-reset-migration.js
locklift run --config locklift.config.js --network prod --script scripts/0-deploy-account.js --key_number='0' --balance='15'
locklift run --config locklift.config.js --network prod --script scripts/0-deploy-account.js --key_number='1' --balance='20'
locklift run --config locklift.config.js --network prod --script scripts/0-deploy-account.js --key_number='2' --balance='5'
locklift run --config locklift.config.js --network prod --script scripts/0-deploy-TokenFactory.js
locklift run --config locklift.config.js --network prod --script scripts/1-deploy-vault-and-root.js --pair_contract_name='DexPairV2'
locklift run --config locklift.config.js --network prod --script scripts/4-deploy-test-dex-account.js --owner_n='1' --contract_name='DexAccountV2'
locklift run --config locklift.config.js --network prod --script scripts/4-deploy-test-dex-account.js --owner_n='2' --contract_name='DexAccountV2'

locklift run --config locklift.config.js --network prod --script scripts/2-deploy-test-tokens.js --tokens='["foo","bar"]'
locklift run --config locklift.config.js --network prod --script scripts/3-mint-test-tokens.js --mints='[{"account":2,"amount":200000,"token":"foo"},{"account":2,"amount":200000,"token":"bar"},{"account":1,"amount":1100000,"token":"foo"}]'
locklift run --config locklift.config.js --network prod --script scripts/5-deploy-test-pair.js --pairs='[["foo", "bar"]]' --contract_name='DexPairV2'
locklift test --config locklift.config.js --network prod --tests test/09-add-pair-test.js --left='foo' --right='bar' --account=1
locklift test --config locklift.config.js --network prod --tests test/09-add-pair-test.js --left='foo' --right='bar' --account=2
locklift test --config locklift.config.js --network prod --tests test/10-deposit-to-dex-account.js --owner_n='1' --deposits='[{ "tokenId": "foo", "amount": 123456 }]'
locklift test --config locklift.config.js --network prod --tests test/10-deposit-to-dex-account.js --owner_n='2' --deposits='[{ "tokenId": "foo", "amount": 100000 }]'

locklift test --config locklift.config.js --network prod --tests test/31-install-account-code.js --contract_name='DexAccountV2'
locklift test --config locklift.config.js --network prod --tests test/36-upgrade-account.js --owner_n='1' --old_contract_name='DexAccount' --new_contract_name='DexAccountV2'
locklift test --config locklift.config.js --network prod --tests test/37-upgrade-account-force.js --owner_n='2' --old_contract_name='DexAccount' --new_contract_name='DexAccountV2'

locklift run --config locklift.config.js --network prod --script scripts/4-deploy-test-dex-account.js --owner_n='3' --contract_name='DexAccountV2'

locklift test --config locklift.config.js --network prod --tests test/10-deposit-to-dex-account.js --owner_n='2' --deposits='[{ "tokenId": "bar", "amount": 100000 }]'
locklift test --config locklift.config.js --network prod --tests test/15-dex-account-pair-operations.js --pair_contract_name='DexPairV2' --account_contract_name='DexAccountV2'

locklift test --config locklift.config.js --network prod --tests test/31-install-account-code.js --contract_name='TestNewDexAccount'
locklift test --config locklift.config.js --network prod --tests test/36-upgrade-account.js --owner_n='1' --old_contract_name='DexAccountV2' --new_contract_name='TestNewDexAccount'
locklift test --config locklift.config.js --network prod --tests test/37-upgrade-account-force.js --owner_n='2' --old_contract_name='DexAccountV2' --new_contract_name='TestNewDexAccount'
