/* eslint-env es6 */
const BalancerSafeMath = artifacts.require('BalancerSafeMath');
const RightsManager = artifacts.require('RightsManager');
const SmartPoolManager = artifacts.require('SmartPoolManager');
const BFactory = artifacts.require('BFactory');
const BPool = artifacts.require('BPool');
const ConfigurableRightsPool = artifacts.require('ConfigurableRightsPool');
const InitializableAdminUpgradeabilityProxy = artifacts.require('InitializableAdminUpgradeabilityProxy');
const CRPFactory = artifacts.require('CRPFactory');
const TToken = artifacts.require('TToken');
const CRPMock = artifacts.require('CRPMock');
const { calcOutGivenIn, calcRelativeDiff } = require('../lib/calc_comparisons');

/*
Tests pool works correctly with upgreadable smart pool
*/
contract('upgradeableSmartPool', async (accounts) => {
  const admin = accounts[0];
  const user1 = accounts[1];
  const user2 = accounts[2];
  const proxyAdmin = accounts[3];

  const { toWei, fromWei } = web3.utils;
  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
  const MAX = web3.utils.toTwosComplement(-1);
  const errorDelta = 10 ** -8;

  // These are the intial settings for newCrp:
  const swapFee = toWei('0.003');
  const startWeights = [toWei('12'), toWei('1.5'), toWei('1.5')];
  const startBalances = [toWei('80000'), toWei('40'), toWei('10000')];
  const SYMBOL = 'BSP';
  const NAME = 'Balancer Pool Token';

  const permissions = {
    canPauseSwapping: false,
    canChangeSwapFee: true,
    canChangeWeights: true,
    canAddRemoveTokens: true,
    canWhitelistLPs: false,
    canChangeCap: false,
  };

  let crpImpl;
  let crpFactory;
  let bFactory;
  let bPoolAddr;
  let bPool;
  let crpPool;
  let CRPPOOL;
  let CRPPOOL_ADDRESS;
  let WETH;
  let DAI;
  let XYZ;
  let weth;
  let dai;
  let xyz;

  before(async () => {
    bFactory = await BFactory.deployed();
    crpFactory = await CRPFactory.deployed();
    crpImpl = await ConfigurableRightsPool.deployed();
    xyz = await TToken.new('XYZ', 'XYZ', 18);
    weth = await TToken.new('Wrapped Ether', 'WETH', 18);
    dai = await TToken.new('Dai Stablecoin', 'DAI', 18);

    WETH = weth.address;
    DAI = dai.address;
    XYZ = xyz.address;

    // admin/user balances
    await weth.mint(admin, toWei('300'));
    await dai.mint(admin, toWei('45000'));
    await xyz.mint(admin, toWei('300000'));

    await weth.mint(user1, toWei('25'));
    await dai.mint(user1, toWei('10000'));
    await xyz.mint(user1, toWei('20'));

    await weth.mint(user2, toWei('25'));
    await dai.mint(user2, toWei('10000'));
    await xyz.mint(user2, toWei('20'));

    const poolParams = {
      poolTokenSymbol: SYMBOL,
      poolTokenName: NAME,
      constituentTokens: [XYZ, WETH, DAI],
      tokenBalances: startBalances,
      tokenWeights: startWeights,
      swapFee: swapFee,
    }

    CRPPOOL = await crpFactory.newCrp.call(
      bFactory.address,
      poolParams,
      permissions,
      crpImpl.address,
      proxyAdmin,
    );

    await crpFactory.newCrp(
      bFactory.address,
      poolParams,
      permissions,
      crpImpl.address,
      proxyAdmin,
    );

    crpPool = await ConfigurableRightsPool.at(CRPPOOL);

    CRPPOOL_ADDRESS = crpPool.address;

    await weth.approve(CRPPOOL_ADDRESS, MAX);
    await dai.approve(CRPPOOL_ADDRESS, MAX);
    await xyz.approve(CRPPOOL_ADDRESS, MAX);
  });

  it('crpPools should create pool correctly', async () => {
    await crpPool.createPool(toWei('100'));
    bPoolAddr = await crpPool.bPool();
    assert.notEqual(bPoolAddr, ZERO_ADDRESS);
    bPool = await BPool.at(bPoolAddr);

    const bPoolXYZBalance = await xyz.balanceOf.call(bPoolAddr);
    const bPoolWethBalance = await weth.balanceOf.call(bPoolAddr);
    const bPoolDaiBalance = await dai.balanceOf.call(bPoolAddr);

    assert.equal(bPoolXYZBalance, toWei('80000'));
    assert.equal(bPoolWethBalance, toWei('40'));
    assert.equal(bPoolDaiBalance, toWei('10000'));

    const xyzWeight = await bPool.getDenormalizedWeight.call(xyz.address);
    const wethWeight = await bPool.getDenormalizedWeight.call(weth.address);
    const daiWeight = await bPool.getDenormalizedWeight.call(dai.address);

    assert.equal(xyzWeight, toWei('12'));
    assert.equal(wethWeight, toWei('1.5'));
    assert.equal(daiWeight, toWei('1.5'));

    const adminBPTBalance = await crpPool.balanceOf.call(admin);
    assert.equal(adminBPTBalance, toWei('100'));
  });

  it('User can perform swaps', async () => {
    let tokenIn = WETH;
    let tokenOut = DAI;
    let tokenAmountOut;

    // 1st Swap - WETH for DAI
    await weth.approve(bPool.address, MAX, { from: user1 });

    let tokenInBalance = await weth.balanceOf.call(bPool.address); // 40
    let tokenInWeight = await bPool.getDenormalizedWeight(WETH); // 1.5
    let tokenOutBalance = await dai.balanceOf.call(bPool.address); // 10000
    let tokenOutWeight = await bPool.getDenormalizedWeight(DAI); // 1.5

    let expectedTotalOut = calcOutGivenIn(
      fromWei(tokenInBalance),
      fromWei(tokenInWeight),
      fromWei(tokenOutBalance),
      fromWei(tokenOutWeight),
      '0.5',
      fromWei(swapFee),
    );

    // Actually returns an array of tokenAmountOut, spotPriceAfter
    tokenAmountOut = await bPool.swapExactAmountIn.call(
      tokenIn,
      toWei('0.5'), // tokenAmountIn
      tokenOut,
      toWei('0'), // minAmountOut
      MAX,
      { from: user1 },
    );
    let relDif = calcRelativeDiff(expectedTotalOut, fromWei(tokenAmountOut[0]));
    assert.isAtMost(relDif.toNumber(), errorDelta);
  });

  it('User should be able to join/exit pool', async () => {
    await weth.approve(CRPPOOL_ADDRESS, MAX, { from: user2 });
    await dai.approve(CRPPOOL_ADDRESS, MAX, { from: user2 });
    await xyz.approve(CRPPOOL_ADDRESS, MAX, { from: user2 });

    const poolAmountOut = '1';
    await crpPool.joinPool(toWei(poolAmountOut), [MAX, MAX, MAX]);

    const poolAmountIn = '1';
    await crpPool.exitPool(toWei(poolAmountIn), [toWei('0'), toWei('0'), toWei('0')]);
  });

  it('Proxy admin can upgrade impl', async () => {
    const balancerSafeMath = await BalancerSafeMath.deployed();
    const rightsManager = await RightsManager.deployed();
    const smartPoolManager = await SmartPoolManager.deployed();

    CRPMock.link('BalancerSafeMath', balancerSafeMath.address);
    CRPMock.link('RightsManager', rightsManager.address);
    CRPMock.link('SmartPoolManager', smartPoolManager.address);

    const newImpl = await CRPMock.new();

    const crpProxy = await InitializableAdminUpgradeabilityProxy.at(CRPPOOL)

    await crpProxy.upgradeTo(newImpl.address, { from: proxyAdmin })

    // just update abi reference
    crpPool = await CRPMock.at(crpPool.address);
  })

  it('Should be able to use the new implementation', async () => {
    const value = await crpPool.value();
    assert.equal(value, toWei('0'));

    const newValue = toWei('1')
    await crpPool.setValue(newValue);

    const updatedValue = await crpPool.value();
    assert.equal(updatedValue, newValue);
  });

  it('User should be able to join/exit pool after proxy upgrade', async () => {
    await weth.approve(CRPPOOL_ADDRESS, MAX, { from: user2 });
    await dai.approve(CRPPOOL_ADDRESS, MAX, { from: user2 });
    await xyz.approve(CRPPOOL_ADDRESS, MAX, { from: user2 });

    const poolAmountOut = '1';
    await crpPool.joinPool(toWei(poolAmountOut), [MAX, MAX, MAX]);

    const poolAmountIn = '1';
    await crpPool.exitPool(toWei(poolAmountIn), [toWei('0'), toWei('0'), toWei('0')]);
  });

  it('User can perform swaps after proxy upgrade', async () => {
    let tokenIn = WETH;
    let tokenOut = DAI;
    let tokenAmountOut;

    // 1st Swap - WETH for DAI
    await weth.approve(bPool.address, MAX, { from: user1 });

    let tokenInBalance = await weth.balanceOf.call(bPool.address); // 40
    let tokenInWeight = await bPool.getDenormalizedWeight(WETH); // 1.5
    let tokenOutBalance = await dai.balanceOf.call(bPool.address); // 10000
    let tokenOutWeight = await bPool.getDenormalizedWeight(DAI); // 1.5

    let expectedTotalOut = calcOutGivenIn(
      fromWei(tokenInBalance),
      fromWei(tokenInWeight),
      fromWei(tokenOutBalance),
      fromWei(tokenOutWeight),
      '0.5',
      fromWei(swapFee),
    );

    // Actually returns an array of tokenAmountOut, spotPriceAfter
    tokenAmountOut = await bPool.swapExactAmountIn.call(
      tokenIn,
      toWei('0.5'), // tokenAmountIn
      tokenOut,
      toWei('0'), // minAmountOut
      MAX,
      { from: user1 },
    );
    let relDif = calcRelativeDiff(expectedTotalOut, fromWei(tokenAmountOut[0]));
    assert.isAtMost(relDif.toNumber(), errorDelta);
  });
});
