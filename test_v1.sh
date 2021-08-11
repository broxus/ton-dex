locklift run --config locklift.config.js --network local --script scripts/0-reset-migration.js
locklift run --config locklift.config.js --network local --script scripts/0-deploy-account.js --key_number='0' --balance='20'
locklift run --config locklift.config.js --network local --script scripts/0-deploy-account.js --key_number='1' --balance='40'
locklift run --config locklift.config.js --network local --script scripts/0-deploy-account.js --key_number='2' --balance='20'
locklift run --config locklift.config.js --network local --script scripts/0-deploy-TokenFactory.js
locklift run --config locklift.config.js --network local --script scripts/1-deploy-vault-and-root.js
locklift run --config locklift.config.js --network local --script scripts/2-deploy-test-tokens.js --tokens='["foo","bar"]'
locklift run --config locklift.config.js --network local --script scripts/3-mint-test-tokens.js --mints='[{"account":2,"amount":200000,"token":"foo"},{"account":2,"amount":200000,"token":"bar"},{"account":3,"amount":1100000,"token":"foo"}]'
locklift run --config locklift.config.js --network local --script scripts/4-deploy-test-dex-account.js
locklift run --config locklift.config.js --network local --script scripts/5-deploy-test-pair.js --pairs='[["foo", "bar"]]' --contract_name='DexPair'
locklift test --config locklift.config.js --network local --tests test/00-token-factory-test.js
locklift test --config locklift.config.js --network local --tests test/01-base-root-and-vault-test.js
locklift test --config locklift.config.js --network local --tests test/08-deposit-test.js
locklift test --config locklift.config.js --network local --tests test/09-add-pair-test.js --left='foo' --right='bar' --account=2
locklift test --config locklift.config.js --network local --tests test/10-deposit-to-dex-account.js --deposits='[{ "tokenId": "foo", "amount": 100000 }, { "tokenId": "bar", "amount": 100000 }]'
locklift test --config locklift.config.js --network local --tests test/15-dex-account-pair-operations.js --pair_contract_name='DexPair' --account_contract_name='DexAccount'
locklift test --config locklift.config.js --network local --tests test/20-pair-direct-operations.js
locklift test --config locklift.config.js --network local --tests test/25-dex-accounts-interaction.js

