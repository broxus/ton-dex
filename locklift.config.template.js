module.exports = {
    compiler: {
        // Path to https://github.com/tonlabs/TON-Solidity-Compiler/tree/064c5a4c6e021d294dcb465dad408a06d0b75168
        path: '/usr/bin/solc-ton-tonlabs-064c5a4',
    },
    linker: {
        // Path to https://github.com/tonlabs/TVM-linker/tree/cd1b33dd972d073a19a47054184ef76bfe408c2f
        path: '/usr/bin/tvm_linker-cd1b33d',
    },
    networks: {
        // You can use TON labs graphql endpoints or local node
        local: {
            ton_client: {
                // See the TON client specification for all available options
                network: {
                    server_address: 'http://localhost/',
                },
            },
            // This giver is default local-node giver
            giver: {
                address: '0:841288ed3b55d9cdafa806807f02a0ae0c169aa5edfe88a789a6482429756a94',
                abi: {"ABI version": 1,
                    "functions": [{"name": "constructor", "inputs": [], "outputs": []}, {
                        "name": "sendGrams",
                        "inputs": [{"name": "dest", "type": "address"}, {"name": "amount", "type": "uint64"}],
                        "outputs": []
                    }],
                    "events": [],
                    "data": []
                },
                key: '',
            },
            // Use tonos-cli to generate your phrase
            // !!! Never commit it in your repos !!!
            keys: {
                phrase: '...',
                amount: 20,
            }
        },
    },
};
