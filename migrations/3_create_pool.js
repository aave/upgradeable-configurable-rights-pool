const CRPFactory = artifacts.require('CRPFactory');
const ConfigurableRightsPool = artifacts.require('ConfigurableRightsPool');
const TToken = artifacts.require('TToken');
const { toWei }  = require('web3').utils

const addresses = require('../helpers/addresses');
const permissions = require('../helpers/permissions');

module.exports = async function (deployer, network) {
  if (network !== 'development' && network !== 'coverage') {
    const {
      SYMBOL,
      NAME,
      A_TOKEN_ADDRESS,
      B_TOKEN_ADDRESS,
      A_TOKEN_AMOUNT,
      B_TOKEN_AMOUNT,
      A_TOKEN_WEIGHT,
      B_TOKEN_WEIGHT,
      SWAP_FEE,
      PROXY_ADMIN
    }  = process.env;

    const networkAddresses = addresses[network];
    const crpImpl = await ConfigurableRightsPool.deployed();
    const crpFactory = await CRPFactory.deployed();

    console.log("ConfigurableRightsPool Implementation address:", crpImpl.address);
    console.log("CRPFactory address:", crpFactory.address);

    const poolParams = {
      poolTokenSymbol: SYMBOL,
      poolTokenName: NAME,
      constituentTokens: [A_TOKEN_ADDRESS, B_TOKEN_ADDRESS],
      tokenBalances: [A_TOKEN_AMOUNT, B_TOKEN_AMOUNT],
      tokenWeights: [A_TOKEN_WEIGHT, B_TOKEN_WEIGHT],
      swapFee: SWAP_FEE,
    }

    // call to estimate address
    const crpPoolAddress  = await crpFactory.newCrp.call(
      networkAddresses.corePoolFactory,
      poolParams,
      permissions,
      crpImpl.address,
      PROXY_ADMIN,
    );

    // Send transaction
    await crpFactory.newCrp(
      networkAddresses.corePoolFactory,
      poolParams,
      permissions,
      crpImpl.address,
      PROXY_ADMIN,
    );

    console.log('New proxy smart pool created at:', crpPoolAddress);

    const aToken = await TToken.at(A_TOKEN_ADDRESS);
    const bToken = await TToken.at(B_TOKEN_ADDRESS);

    await aToken.approve(crpPoolAddress, A_TOKEN_AMOUNT);
    await bToken.approve(crpPoolAddress, B_TOKEN_AMOUNT);

    const crpPool = await ConfigurableRightsPool.at(crpPoolAddress);

    await crpPool.createPool(toWei('100'));

    const bPoolAddress = await crpPool.bPool();

    console.log("BPool created at:", bPoolAddress);
  }
};
