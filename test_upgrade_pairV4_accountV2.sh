locklift build --config locklift.config.js

#prepare pair
locklift run --config locklift.config.js --network local --script scripts/0-reset-migration.js --disable-build
locklift run --config locklift.config.js --network local --script scripts/0-deploy-account.js --key_number='0' --balance='125' --disable-build
locklift run --config locklift.config.js --network local --script scripts/0-deploy-account.js --key_number='1' --balance='125' --disable-build
locklift run --config locklift.config.js --network local --script scripts/0-deploy-account.js --key_number='2' --balance='115' --disable-build
locklift run --config locklift.config.js --network local --script scripts/0-deploy-TokenFactory.js --disable-build
locklift run --config locklift.config.js --network local --script scripts/1-deploy-vault-and-root.js --pair_contract_name='DexPair' --account_contract_name='DexAccount' --disable-build
locklift run --config locklift.config.js --network local --script scripts/2-deploy-test-tokens.js --tokens='["foo","bar","qwe"]' --disable-build
locklift run --config locklift.config.js --network local --script scripts/3-mint-test-tokens.js --mints='[{"account":2,"amount":1000000,"token":"foo"},{"account":2,"amount":1000000,"token":"bar"},{"account":2,"amount":1000000,"token":"qwe"},{"account":3,"amount":1000000,"token":"foo"}]' --disable-build
locklift run --config locklift.config.js --network local --script scripts/4-deploy-test-dex-account.js --owner_n='2' --contract_name='DexAccount' --disable-build
locklift run --config locklift.config.js --network local --script scripts/5-deploy-test-pair.js --pairs='[["foo", "bar"]]' --contract_name='DexPair' --disable-build
locklift test --config locklift.config.js --network local --tests test/00-token-factory-test.js --disable-build
locklift test --config locklift.config.js --network local --tests test/01-base-root-and-vault-test.js --pair_contract_name='DexPair' --account_contract_name='DexAccount' --disable-build
locklift test --config locklift.config.js --network local --tests test/09-add-pair-test.js --left='foo' --right='bar' --account=2 --contract_name='DexPair' --disable-build
locklift test --config locklift.config.js --network local --tests test/10-deposit-to-dex-account.js --deposits='[{ "tokenId": "foo", "amount": 1000000 }, { "tokenId": "bar", "amount": 1000000 }]' --disable-build

#initial liquidity deposit
locklift test --config locklift.config.js --network local --tests test/12-pair-deposit-liquidity.js --left_token_id 'foo' --right_token_id 'bar' --left_amount '293927.063424035' --right_amount '64851.610304603779903176' --auto_change 'false' --contract_name='DexPair' --disable-build

#test upgrade to version 4
locklift test --config locklift.config.js --network local --tests test/30-install-pair-code-v2.js --contract_name='DexPair'
locklift test --config locklift.config.js --network local --tests test/35-upgrade-pair.js --left='foo' --right='bar' --old_contract_name='DexPair' --new_contract_name='DexPair'

#check problem solved
locklift test --config locklift.config.js --network local --tests test/12-pair-deposit-liquidity.js --left_token_id 'foo' --right_token_id 'bar' --left_amount '3800' --right_amount '838.4260921287559342' --auto_change 'true' --contract_name='DexPair'

# test deploy v4
locklift run --config locklift.config.js --network local --script scripts/5-deploy-test-pair.js --pairs='[["bar", "qwe"]]' --contract_name='DexPair'
locklift test --config locklift.config.js --network local --tests test/09-add-pair-test.js --left='bar' --right='qwe' --account=2 --contract_name='DexPair' --ignore_already_added='true'
locklift test --config locklift.config.js --network local --tests test/10-deposit-to-dex-account.js --deposits='[{ "tokenId": "qwe", "amount": 1000000 }]'
locklift test --config locklift.config.js --network local --tests test/12-pair-deposit-liquidity.js --left_token_id 'bar' --right_token_id 'qwe' --left_amount '10000' --right_amount '100000' --auto_change 'false' --contract_name='DexPair'

#old tests
locklift test --config locklift.config.js --network local --tests test/15-dex-account-pair-operations.js --pair_contract_name='DexPair' --account_contract_name='DexAccount'
locklift test --config locklift.config.js --network local --tests test/20-pair-direct-operations.js --contract_name='DexPair'
locklift test --config locklift.config.js --network local --tests test/25-dex-accounts-interaction.js --pair_contract_name='DexPair' --account_contract_name='DexAccount'

# test cross-pair exchange
locklift test --config locklift.config.js --network local --tests test/40-cross-pair-exchange.js --amount=1000 --route='["foo","bar","qwe"]' --contract_name='DexPair'

#test upgrade from version 4
locklift test --config locklift.config.js --network local --tests test/30-install-pair-code-v2.js --contract_name='DexPair'
locklift test --config locklift.config.js --network local --tests test/35-upgrade-pair.js --left='foo' --right='bar' --old_contract_name='DexPair' --new_contract_name='DexPair'
