require('babel-register')

const path = require("path");
const HDWalletProvider = require("truffle-hdwallet-provider");
const mnemonic = process.env.MY_MNEMONIC;
module.exports = {
    contracts_build_directory: path.join(__dirname, "build"),
    networks: {
        development: {
            host: "localhost",
            // port: 8545,
            port: 7845,
            network_id: "*", // Match any network id
            gas: 6000000
        },
        ropsten: {
            provider: function () {
                return new HDWalletProvider(mnemonic, `https://ropsten.infura.io/${process.env.INFURA_KEY}`);
            },
            network_id: 3,
            gas: 5000000,
            gasPrice: 5000000000
        },
        privateChain: {
            provider: function () {
                return new HDWalletProvider(mnemonic, "http://127.0.0.1:9545");
            },
            network_id: '127',
        },
        privateTestNet: {
            provider: function () {
                return new HDWalletProvider(mnemonic, "http://127.0.0.1:9545");
            },
            network_id: '101',
            gasPrice: 100000000000
        }
    },
    solc: {
        optimizer: {
            enabled: true,
            runs: 200
        }
    }
};