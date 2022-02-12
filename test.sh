#prepare pair
npx locklift run --config locklift.config.js --disable-build --network local --script scripts/0-reset-migration.js
npx locklift run --config locklift.config.js --disable-build --network local --script scripts/0-deploy-account.js --key_number='0' --balance='50'
npx locklift run --config locklift.config.js --disable-build --network local --script scripts/0-deploy-account.js --key_number='1' --balance='50'
npx locklift run --config locklift.config.js --disable-build --network local --script scripts/0-deploy-account.js --key_number='2' --balance='50'
npx locklift run --config locklift.config.js --disable-build --network local --script scripts/0-deploy-TokenFactory.js
npx locklift run --config locklift.config.js --disable-build --network local --script scripts/1-deploy-vault-and-root.js --pair_contract_name='DexPair'
npx locklift run --config locklift.config.js --disable-build --network local --script scripts/2-deploy-test-tokens.js --tokens='["foo","bar","qwe","tst"]'
npx locklift run --config locklift.config.js --disable-build --network local --script scripts/3-mint-test-tokens.js --mints='[{"account":2,"amount":1000000,"token":"foo"},{"account":2,"amount":1000000,"token":"bar"},{"account":2,"amount":1000000,"token":"qwe"},{"account":2,"amount":1000000,"token":"tst"},{"account":3,"amount":1000000,"token":"foo"},{"account":3,"amount":1000000,"token":"bar"},{"account":3,"amount":1000000,"token":"qwe"}]'
npx locklift run --config locklift.config.js --disable-build --network local --script scripts/4-deploy-test-dex-account.js
npx locklift run --config locklift.config.js --disable-build --network local --script scripts/5-deploy-test-pair.js --pairs='[["foo", "bar"],["foo", "tst"],["bar", "tst"],["bar", "qwe"],["foo", "qwe"]]' --contract_name='DexPair'
npx locklift test --config locklift.config.js --disable-build --network local --tests test/00-token-factory-test.js
npx locklift test --config locklift.config.js --disable-build --network local --tests test/01-base-root-and-vault-test.js --pair_contract_name='DexPair'
npx locklift test --config locklift.config.js --disable-build --network local --tests test/09-add-pair-test.js --left='foo' --right='bar' --account=2 --contract_name='DexPair' --ignore_already_added='true'
npx locklift test --config locklift.config.js --disable-build --network local --tests test/09-add-pair-test.js --left='bar' --right='qwe' --account=2 --contract_name='DexPair' --ignore_already_added='true'
npx locklift test --config locklift.config.js --disable-build --network local --tests test/09-add-pair-test.js --left='foo' --right='qwe' --account=2 --contract_name='DexPair' --ignore_already_added='true'
npx locklift test --config locklift.config.js --disable-build --network local --tests test/09-add-pair-test.js --left='foo' --right='tst' --account=2 --ignore_already_added='true' --contract_name='DexPair'
npx locklift test --config locklift.config.js --disable-build --network local --tests test/09-add-pair-test.js --left='bar' --right='tst' --account=2 --ignore_already_added='true' --contract_name='DexPair'
npx locklift test --config locklift.config.js --disable-build --network local --tests test/10-deposit-to-dex-account.js --deposits='[{ "tokenId": "foo", "amount": 1000000 }, { "tokenId": "bar", "amount": 1000000 }, { "tokenId": "qwe", "amount": 1000000 }, { "tokenId": "tst", "amount": 1000000 }]'

#initial liquidity deposit
npx locklift test --config locklift.config.js --disable-build --network local --tests test/12-pair-deposit-liquidity.js --left_token_id 'foo' --right_token_id 'bar' --left_amount '293927.063424035' --right_amount '64851.610304603779903176' --auto_change 'false' --contract_name='DexPair'
npx locklift test --config locklift.config.js --disable-build --network local --tests test/12-pair-deposit-liquidity.js --left_token_id 'foo' --right_token_id 'bar' --left_amount '3800' --right_amount '838.4260921287559342' --auto_change 'true' --contract_name='DexPair'

npx locklift test --config locklift.config.js --disable-build --network local --tests test/12-pair-deposit-liquidity.js --left_token_id 'bar' --right_token_id 'qwe' --left_amount '10000' --right_amount '10000' --auto_change 'false' --contract_name='DexPair'
npx locklift test --config locklift.config.js --disable-build --network local --tests test/12-pair-deposit-liquidity.js --left_token_id 'foo' --right_token_id 'qwe' --left_amount '10000' --right_amount '10000' --auto_change 'false' --contract_name='DexPair'
npx locklift test --config locklift.config.js --disable-build --network local --tests test/12-pair-deposit-liquidity.js --left_token_id 'foo' --right_token_id 'tst' --left_amount '10000' --right_amount '10000' --auto_change 'false' --contract_name='DexPair'
npx locklift test --config locklift.config.js --disable-build --network local --tests test/12-pair-deposit-liquidity.js --left_token_id 'bar' --right_token_id 'tst' --left_amount '10000' --right_amount '10000' --auto_change 'false' --contract_name='DexPair'

#old tests
npx locklift test --config locklift.config.js --disable-build --network local --tests test/15-dex-account-pair-operations.js --pair_contract_name='DexPair' --account_contract_name='DexAccount'
npx locklift test --config locklift.config.js --disable-build --network local --tests test/20-pair-direct-operations.js --contract_name='DexPair'
npx locklift test --config locklift.config.js --disable-build --network local --tests test/25-dex-accounts-interaction.js --pair_contract_name='DexPair' --account_contract_name='DexAccount'

# test cross-pair exchange
npx locklift test --config locklift.config.js --disable-build --network local --tests test/40-cross-pair-exchange.js --amount=1000 --route='["foo","bar","qwe"]' --contract_name='DexPair'
npx locklift test --config locklift.config.js --disable-build --network local --tests test/40-cross-pair-exchange.js --amount=1000 --route='["bar","foo","qwe"]' --contract_name='DexPair'
npx locklift test --config locklift.config.js --disable-build --network local --tests test/40-cross-pair-exchange.js --amount=1000 --route='["foo","qwe","bar","tst"]' --contract_name='DexPair'

npx locklift test --config locklift.config.js --disable-build --network local --tests test/30-install-pair-code-v2.js --contract_name='TestNewDexPair'
npx locklift test --config locklift.config.js --disable-build --network local --tests test/31-install-account-code.js --contract_name='TestNewDexAccount'

npx locklift test --config locklift.config.js --disable-build --network local --tests test/35-upgrade-pair.js --left='foo' --right='bar' --old_contract_name='DexPair' --new_contract_name='TestNewDexPair'
npx locklift test --config locklift.config.js --disable-build --network local --tests test/36-upgrade-account.js --owner_n='2' --old_contract_name='DexAccount' --new_contract_name='TestNewDexAccount'
