const RightsManager = artifacts.require('RightsManager');
const SmartPoolManager = artifacts.require('SmartPoolManager');
const CRPFactory = artifacts.require('CRPFactory');
const BFactory = artifacts.require('BFactory');
const BalancerSafeMath = artifacts.require('BalancerSafeMath');
const BalancerSafeMathMock = artifacts.require('BalancerSafeMathMock');

module.exports = async function (deployer, network, accounts) {
    if (network === 'development' || network === 'coverage') {
        await deployer.deploy(BFactory);
        await deployer.deploy(BalancerSafeMathMock);
    }

    await deployer.deploy(BalancerSafeMath);
    await deployer.deploy(RightsManager);
    await deployer.deploy(SmartPoolManager);

    deployer.link(BalancerSafeMath, CRPFactory);
    deployer.link(RightsManager, CRPFactory);
    deployer.link(SmartPoolManager, CRPFactory);
    
    await deployer.deploy(CRPFactory);
};
