locklift build --config locklift.config.js

#prepare pair
locklift run --config locklift.config.js --network dev --script scripts/0-reset-migration.js
locklift run --config locklift.config.js --network dev --script scripts/0-deploy-account.js --key_number='0' --balance='51'
locklift run --config locklift.config.js --network dev --script scripts/0-deploy-account.js --key_number='1' --balance='52'
locklift run --config locklift.config.js --network dev --script scripts/0-deploy-account.js --key_number='2' --balance='53'
locklift run --config locklift.config.js --network dev --script scripts/0-deploy-TokenFactory.js
locklift run --config locklift.config.js --network dev --script scripts/1-deploy-vault-and-root.js --pair_contract_name='DexPairV3' --account_contract_name='DexAccountV2'
locklift run --config locklift.config.js --network dev --script scripts/2-deploy-test-tokens.js --tokens='["foo","bar","qwe"]'
locklift run --config locklift.config.js --network dev --script scripts/3-mint-test-tokens.js --mints='[{"account":2,"amount":1000000,"token":"foo"},{"account":2,"amount":1000000,"token":"bar"},{"account":2,"amount":1000000,"token":"qwe"},{"account":3,"amount":1000000,"token":"foo"}]'
locklift run --config locklift.config.js --network dev --script scripts/4-deploy-test-dex-account.js --owner_n='2' --contract_name='DexAccountV2'
locklift run --config locklift.config.js --network dev --script scripts/5-deploy-test-pair.js --pairs='[["foo", "bar"],["bar", "qwe"], ["foo", "qwe"]]' --contract_name='DexPairV3'
locklift test --config locklift.config.js --network dev --tests test/00-token-factory-test.js
locklift test --config locklift.config.js --network dev --tests test/01-base-root-and-vault-test.js --pair_contract_name='DexPairV3' --account_contract_name='DexAccountV2'
locklift test --config locklift.config.js --network dev --tests test/08-deposit-test.js
locklift test --config locklift.config.js --network dev --tests test/09-add-pair-test.js --left='foo' --right='bar' --account=2 --contract_name='DexPairV3'
locklift test --config locklift.config.js --network dev --tests test/09-add-pair-test.js --left='bar' --right='qwe' --account=2 --contract_name='DexPairV3' --ignore_already_added='true'
locklift test --config locklift.config.js --network dev --tests test/09-add-pair-test.js --left='foo' --right='qwe' --account=2 --contract_name='DexPairV3' --ignore_already_added='true'
locklift test --config locklift.config.js --network dev --tests test/10-deposit-to-dex-account.js --deposits='[{ "tokenId": "foo", "amount": 1000000 }, { "tokenId": "bar", "amount": 1000000 }, { "tokenId": "qwe", "amount": 1000000 }]'

#initial liquidity deposit
locklift test --config locklift.config.js --network dev --tests test/12-pair-deposit-liquidity.js --left_token_id 'foo' --right_token_id 'bar' --left_amount '293927.063424035' --right_amount '64851.610304603779903176' --auto_change 'false' --contract_name='DexPairV3'
locklift test --config locklift.config.js --network dev --tests test/12-pair-deposit-liquidity.js --left_token_id 'bar' --right_token_id 'qwe' --left_amount '10000' --right_amount '100000' --auto_change 'false' --contract_name='DexPairV3'
locklift test --config locklift.config.js --network dev --tests test/12-pair-deposit-liquidity.js --left_token_id 'foo' --right_token_id 'qwe' --left_amount '10000' --right_amount '100000' --auto_change 'false' --contract_name='DexPairV3'
locklift test --config locklift.config.js --network dev --tests test/12-pair-deposit-liquidity.js --left_token_id 'foo' --right_token_id 'bar' --left_amount '3800' --right_amount '838.4260921287559342' --auto_change 'true' --contract_name='DexPairV3'
locklift test --config locklift.config.js --network dev --tests test/12-pair-deposit-liquidity.js --left_token_id 'foo' --right_token_id 'bar' --left_amount '0' --right_amount '0.00000000000001' --auto_change 'true' --contract_name='DexPairV3'

#base tests
locklift test --config locklift.config.js --network dev --tests test/15-dex-account-pair-operations.js --pair_contract_name='DexPairV3' --account_contract_name='DexAccountV2'
locklift test --config locklift.config.js --network dev --tests test/20-pair-direct-operations.js --contract_name='DexPairV3'
locklift test --config locklift.config.js --network dev --tests test/25-dex-accounts-interaction.js --pair_contract_name='DexPairV3' --account_contract_name='DexAccountV2'

# test cross-pair exchange
locklift test --config locklift.config.js --network dev --tests test/40-cross-pair-exchange.js --amount=777 --route='["foo","bar","qwe"]' --contract_name='DexPairV3'
locklift test --config locklift.config.js --network dev --tests test/40-cross-pair-exchange.js --amount=1 --route='["bar","foo","qwe"]' --contract_name='DexPairV3'
locklift test --config locklift.config.js --network dev --tests test/40-cross-pair-exchange.js --amount=33 --route='["bar","foo","qwe","bar"]' --contract_name='DexPairV3'

#test upgrade from version 3
locklift test --config locklift.config.js --network dev --tests test/30-install-pair-code-v2.js --contract_name='DexPairV3'
locklift test --config locklift.config.js --network dev --tests test/35-upgrade-pair.js --left='foo' --right='bar' --old_contract_name='DexPairV3' --new_contract_name='DexPairV3'
