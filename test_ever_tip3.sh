npx locklift build --config locklift.config.js

npx locklift run --config locklift.config.js --disable-build --network dev --script scripts/0-reset-migration.js
npx locklift run --config locklift.config.js --disable-build --network dev --script scripts/0-deploy-account.js --key_number='0' --balance='50'
npx locklift run --config locklift.config.js --disable-build --network dev --script scripts/0-deploy-account.js --key_number='1' --balance='1000'
npx locklift run --config locklift.config.js --disable-build --network dev --script scripts/0-deploy-account.js --key_number='2' --balance='1000'
npx locklift run --config locklift.config.js --disable-build --network dev --script scripts/0-deploy-TokenFactory.js
npx locklift run --config locklift.config.js --disable-build --network dev --script scripts/1-deploy-vault-and-root.js --pair_contract_name='DexPair' --account_contract_name='DexAccount'
npx locklift run --config locklift.config.js --disable-build --network dev --script scripts/6-wton-setup.js --wrap_amount=100
npx locklift run --config locklift.config.js --disable-build --network dev --script scripts/7-deploy-test-swap-ever-wever-tip3-contracts.js
npx locklift run --config locklift.config.js --disable-build --network dev --script scripts/2-deploy-test-tokens.js --tokens='["tst"]'
npx locklift run --config locklift.config.js --disable-build --network dev --script scripts/3-mint-test-tokens.js --mints='[{"account":2,"amount":100000,"token":"tst"}]'
npx locklift run --config locklift.config.js --disable-build --network dev --script scripts/4-deploy-test-dex-account.js --owner_n='2' --contact_name='DexAccount'
npx locklift run --config locklift.config.js --disable-build --network dev --script scripts/5-deploy-test-pair.js --pairs='[["tst","wever"]]' --contract_name='DexPair'
npx locklift test --config locklift.config.js --disable-build --network dev --tests test/09-add-pair-test.js --left='tst' --right='wever' --account=2 --contract_name='DexPair' --ignore_already_added='true'
npx locklift test --config locklift.config.js --disable-build --network dev --tests test/10-deposit-to-dex-account.js --deposits='[{"tokenId": "tst", "amount": 900},{"tokenId": "wever", "amount": 90}]'
npx locklift test --config locklift.config.js --disable-build --network dev --tests test/12-pair-deposit-liquidity.js --left_token_id='tst' --right_token_id='wever' --left_amount='900' --right_amount='90' --auto_change='false' --contract_name='DexPair'
npx locklift test --config locklift.config.js --disable-build --network dev --tests test/45-test-swap-ever-wever-to-tip3-contracts.js
