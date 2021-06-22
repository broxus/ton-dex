#задать новый код пары
locklift test --config locklift.config.js --network local --tests test/30-install-pair-code-v2.js --contract_name 'DexPairV2'

#задеплоить новые токены
locklift run --config locklift.config.js --network local --script scripts/2-deploy-test-tokens.js --tokens='["tst","qwe"]'

#заминтить
locklift run --config locklift.config.js --network local --script scripts/3-mint-test-tokens.js --mints='[{"account":2,"amount":200000,"token":"tst"},{"account":2,"amount":200000,"token":"qwe"},{"account":3,"amount":100000,"token":"tst"}]'

#создать еще пары
locklift run --config locklift.config.js --network local --script scripts/5-deploy-test-pair.js --pairs='[["foo", "tst"],["bar", "tst"],["foo", "qwe"],["bar", "qwe"]]' --contract_name='DexPairV2'

#добавить пары в аккаунт
locklift test --config locklift.config.js --network local --tests test/09-add-pair-test.js --left='foo' --right='tst' --account=2 --ignore_already_added='true' --contract_name='DexPairV2'
locklift test --config locklift.config.js --network local --tests test/09-add-pair-test.js --left='bar' --right='tst' --account=2 --ignore_already_added='true' --contract_name='DexPairV2'
locklift test --config locklift.config.js --network local --tests test/09-add-pair-test.js --left='foo' --right='qwe' --account=2 --ignore_already_added='true' --contract_name='DexPairV2'
locklift test --config locklift.config.js --network local --tests test/09-add-pair-test.js --left='bar' --right='qwe' --account=2 --ignore_already_added='true' --contract_name='DexPairV2'

#сделать депозит
locklift test --config locklift.config.js --network local --tests test/10-deposit-to-dex-account.js --deposits='[{ "tokenId": "tst", "amount": 100000 }, { "tokenId": "qwe", "amount": 100000 }]'

#залить ликвидность
locklift test --config locklift.config.js --network local --tests test/12-pair-deposit-liquidity.js --left_token_id 'foo' --right_token_id 'tst' --left_amount 7000 --right_amount 14000 --auto_change 'false' --contract_name='DexPairV2'
locklift test --config locklift.config.js --network local --tests test/12-pair-deposit-liquidity.js --left_token_id 'bar' --right_token_id 'tst' --left_amount 9000 --right_amount 3000 --auto_change 'false' --contract_name='DexPairV2'
locklift test --config locklift.config.js --network local --tests test/12-pair-deposit-liquidity.js --left_token_id 'foo' --right_token_id 'qwe' --left_amount 6000 --right_amount 2000 --auto_change 'false' --contract_name='DexPairV2'
locklift test --config locklift.config.js --network local --tests test/12-pair-deposit-liquidity.js --left_token_id 'bar' --right_token_id 'qwe' --left_amount 8000 --right_amount 2000 --auto_change 'false' --contract_name='DexPairV2'

#попытаться сделать cross exchange с использованием v2
#позитивные тесты
#роут из 3х пар
locklift test --config locklift.config.js --network local --tests test/40-cross-pair-exchange.js --amount=100 --route='["foo","tst","bar","qwe"]'
#стартовая пара в обратном направлении
locklift test --config locklift.config.js --network local --tests test/40-cross-pair-exchange.js --amount=100 --route='["tst","foo","qwe"]'
#роут в обратном направлении
locklift test --config locklift.config.js --network local --tests test/40-cross-pair-exchange.js --amount=10 --route='["qwe","bar","tst","foo"]'

#обновляем foo-bar до версии v2
locklift test --config locklift.config.js --network local --tests test/35-upgrade-pair.js --left='foo' --right='bar' --old_contract_name='DexPair' --new_contract_name='DexPairV2'

#теперь обмен через foo-bar должен отработать
#в середине
locklift test --config locklift.config.js --network local --tests test/40-cross-pair-exchange.js --amount=100 --route='["tst","bar","foo","qwe"]'
#в середине в обратном порядке
locklift test --config locklift.config.js --network local --tests test/40-cross-pair-exchange.js --amount=100 --route='["tst","foo","bar","qwe"]'
#старт в направлении foo -> bar
locklift test --config locklift.config.js --network local --tests test/40-cross-pair-exchange.js --amount=50 --route='["foo","bar","qwe"]'
#старт в направлении bar -> foo
locklift test --config locklift.config.js --network local --tests test/40-cross-pair-exchange.js --amount=10 --route='["bar","foo","tst"]'

#также проверяем что вся функциональность прежняя пожжерживается
locklift test --config locklift.config.js --network local --tests test/15-dex-account-pair-operations.js --contract_name='DexPairV2'
locklift test --config locklift.config.js --network local --tests test/20-pair-direct-operations.js --contract_name='DexPairV2'

#проверяем что сохраняется возможность обновления до v3
locklift test --config locklift.config.js --network local --tests test/30-install-pair-code-v2.js --contract_name='TestNewDexPair'
locklift test --config locklift.config.js --network local --tests test/35-upgrade-pair.js --left='foo' --right='bar' --old_contract_name='DexPairV2' --new_contract_name='TestNewDexPair'
