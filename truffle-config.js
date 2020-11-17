require('dotenv').config()
const HDWalletProvider = require('@truffle/hdwallet-provider');

let INFURA_PROJECT_ID;
let DEPLOYMENT_ACCOUNT_PK;
let GAS_PRICE;

if (process.env.NODE_ENV !== 'test') {
    [INFURA_PROJECT_ID, DEPLOYMENT_ACCOUNT_PK, GAS_PRICE] = getConfigs();
}

module.exports = {
    networks: {
        development: {
            host: 'localhost', // Localhost (default: none)
            port: 8545, // Standard Ethereum port (default: none)
            network_id: '*', // Any network (default: none)
            gas: 10000000,
        },
        coverage: {
            host: 'localhost',
            network_id: '*',
            port: 8555,
            gas: 0xfffffffffff,
            gasPrice: 0x01,
        },
        kovan: {
            provider: () =>
              new HDWalletProvider(
                [DEPLOYMENT_ACCOUNT_PK],
                `https://kovan.infura.io/v3/${INFURA_PROJECT_ID}`
              ),
            network_id: 42,
            gas: 6000000,
            gasPrice: GAS_PRICE,
            skipDryRun: true,
        },
        mainnet: {
            provider: () =>
              new HDWalletProvider(
                [DEPLOYMENT_ACCOUNT_PK],
                `https://mainnet.infura.io/v3/${INFURA_PROJECT_ID}`
              ),
            network_id: 1,
            gas: 6000000,
            gasPrice: GAS_PRICE,
            skipDryRun: true,
            timeoutBlocks: 200,
        },
    },
    // Configure your compilers
    compilers: {
        solc: {
            version: '0.6.12',
            settings: { // See the solidity docs for advice about optimization and evmVersion
                optimizer: {
                    enabled: true,
                    runs: 200,
                },
                evmVersion: 'istanbul',
            },
        },
    },
};

function getConfigs() {
    const configs = process.env;

    const INFURA_PROJECT_ID = configs.INFURA_PROJECT_ID;
    const DEPLOYMENT_ACCOUNT_PK = (configs.DEPLOYMENT_ACCOUNT_PK || '').replace(
      /^0x/,
      ''
    );
    const GAS_PRICE = configs.GAS_PRICE;

    if (!INFURA_PROJECT_ID || !DEPLOYMENT_ACCOUNT_PK || !GAS_PRICE) {
        throw 'Wrong configs';
    }

    return [INFURA_PROJECT_ID, DEPLOYMENT_ACCOUNT_PK, GAS_PRICE];
}
