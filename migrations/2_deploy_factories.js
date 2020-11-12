const RightsManager = artifacts.require('RightsManager');
const SmartPoolManager = artifacts.require('SmartPoolManager');
const CRPFactory = artifacts.require('CRPFactory');
const ConfigurableRightsPool = artifacts.require('ConfigurableRightsPool');
const BFactory = artifacts.require('BFactory');
const BalancerSafeMath = artifacts.require('BalancerSafeMath');
const BalancerSafeMathMock = artifacts.require('BalancerSafeMathMock');

const addresses = require('../helpers/addresses');

module.exports = async function (deployer, network, accounts) {
    if (network === 'development' || network === 'coverage') {
        await deployer.deploy(BFactory);
        await deployer.deploy(BalancerSafeMathMock);

        await deployer.deploy(BalancerSafeMath);
        await deployer.deploy(RightsManager);
        await deployer.deploy(SmartPoolManager);

        deployer.link(BalancerSafeMath, ConfigurableRightsPool);
        deployer.link(RightsManager, ConfigurableRightsPool);
        deployer.link(SmartPoolManager, ConfigurableRightsPool);
    } else {
        const networkAddresses = addresses[network];
        ConfigurableRightsPool.link('BalancerSafeMath', networkAddresses.balancerSafeMath);
        ConfigurableRightsPool.link('RightsManager', networkAddresses.rightsManager);
        ConfigurableRightsPool.link('SmartPoolManager', networkAddresses.smartPoolManager);
    }

    // Deploy pool implementation contract
    await deployer.deploy(ConfigurableRightsPool);

    // Deploy pool factory
    await deployer.deploy(CRPFactory);
};
