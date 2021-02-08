# Configurable Rights Pool

This is a smart pool factory that allows anyone to deploy smart pools with (in the reference implementation) six 
different rights that can be individually chosen:

1) canPauseSwapping: pool creator can pause swaps (base pools can turn swapping on, but not off)
2) canChangeSwapFee: pool creator can change trading fees (subject to min/max values)
3) canChangeWeights: pool creator can change weights, either individually, or following a plan for gradual updates
4) canAddRemoveTokens: pool creator can add/remove tokens (subject to the base pool limits)
5) canWhitelistLPs: pool creator can specify a list of addresses allowed to add/remove liquidity
6) canChangeCap: pool creator can change the BSP cap (max # of pool tokens)

### CRPFactory.sol

Creates new ConfigurableRightsPools & stores their addresses in a registry.

#### `newCrp`

Creates new Proxy for ConfigurableRightsPools with the caller as the contract controller.

##### Params
* `address factoryAddress` - BFactory address.
* `PoolParams poolParams` - Structure holding the main parameters that define this pool
* `RightsManager.Rights rights` - Structure defined in an external linked library, with boolean flags for each right
* `smartPoolImplementation` - Address of the implementation contract for the CRP
* `proxyAdmin` - Address to be assigned as admin of the proxy contract that uses the CRP implementation 

##### Pool Params structure
* `string poolTokenSymbol` - Symbol of the Balancer Pool Token representing this pool
* `string poolTokenName` - Name of the Balancer Pool Token representing this pool
* `address[] constituentTokens` - Array of 2-8 token addresses. The pool will hold these.
* `uint256[] tokenBalances` - Array of initial balances for the tokens specified above.
* `uint256[] tokenWeights` - Array of initial weights for the tokens specified above.
* `uint swapFee` - Initial swap fee for the pool (subject to min/max limits)

##### Example Code

Note that the weights are "denormalized" values, from 1 to 50 (really 49, as there must be at least two tokens, and the sum must be <= 50>). <br>As a rule of thumb, the denormalized weight of a token is half of its proportional weight (as a percentage). <br><br>So, a 98% / 2% pool's tokens would have denormalized weights of 49 and 1. With two tokens (A and B), the percentage value of A is denormA/(denormA + denormB). With 49/1, that's 49/(49+1) = 0.98, subject to the constraint: denormA + denormB <= 50.

```javascript
const permissions = {
    canPauseSwapping: true,
    canChangeSwapFee: true,
    canChangeWeights: true,
    canAddRemoveTokens: false,
    canWhitelistLPs: false,
    canChangeCap: false,
};

const poolParams = {
    poolTokenSymbol: 'BPT',
    poolTokenName: 'BTP Example Name',
    constituentTokens: [XYZ, WETH, DAI], // contract addresses
    tokenBalances: [toWei('80000'), toWei('40'), toWei('10000')],
    tokenWeights: [toWei('12'), toWei('1.5'), toWei('1.5')],
    swapFee: toWei('0.003'), // 0.3%
};

await crpFactory.newCrp(
    bfactory.address,
    poolParams,
    permissions
);
```
<hr>
<strong>Note the following considerations when creating a new Configurable Rights Smart Pool</strong>
<ul>
<li>You must apply to list your token on the Balancer Exchange (or it will be shown as a bare address, with a warning)</li>
<li>If your pool will be eligible for BAL rewards, you must apply to "redirect" the rewards to an account that can receive funds. (Without a redirect, the reward scripts would send the tokens to the CRP contract directly, where they cannot be recovered.)</li>
<li>On a related note, unlike with core Balancer Pools, you cannot send tokens directly to the smart pool contract - they will be unrecoverable!</li>
</ul>

See the [docs](https://docs.balancer.finance/protocol/bal-liquidity-mining/exchange-and-reward-listing) for more details on listing and redirects!

There is also a CRP creation [tutorial](https://docs.balancer.finance/guides/crp-tutorial). And the source code has a rich set of unit and scenario-based tests that demonstrate how to use all the features.
<hr>

### ConfigurableRightsPool.sol

> **Pause Swapping Right**

`setPublicSwap(bool publicSwap)`

Turn swapping on (if publicSwap is true), or off - if the pool has that right assigned.

> **Change Swap Fee Right**

`setSwapFee(uint swapFee)`

Set the pool's swap fee (within min/max limits set by the underlying pool)

> **Change weights Right**

`updateWeight(address token, uint newWeight)`

Updates weight for a given token, while keeping prices the same.
<br>This will change the token balances, and cause tokens to be transferred to or from the caller's wallet
<br>NB: This cannot be done while a gradual update is underway (see below)

`updateWeightsGradually(uint[] newWeights, uint startBlock, uint endBlock)`

Transform all weights gradually and linearly from their present values to those specified in newWeights.
<br>The weights are actually changed, between the specified start and end blocks, by pokeWeights.
<br>This is very flexible. For instance, to halt the update sequence, call this function again with current weights.

`pokeWeights()`

Can be called by anyone (e.g., every block), to move the weights along the scheduled trajectory.

> **Add/Remove tokens Right**

`commitAddToken(address token, uint balance, uint denormalizedWeight)`

Precommits a new token that can be applied addTokenTimeLockInBlocks blocks in the future.

`applyAddToken()`

Applies the token committed in the step above, and mints pool shares -
<br>(if at least addTokenTimeLockInBlocks blocks have passed since the commit).

`removeToken(address token)`

Removes an existing token and returns the balance to the controller. You cannot remove a token while a gradual update is in progress. Note that removing all tokens effectively destroys the pool; i.e., you cannot add tokens back in. A one-token pool, while unusable (you can't swap with only one token), can still be restored to functionality by adding another token.

> **Whitelist Liquidity Provider Right**

`whitelistLiquidityProvider(address provider)`

Add an address, after which this address can join a pool. (Initially, no one can add liquidity through joinPool, including the controller. The controller adds initial liquidity through createPool.)

`removeWhitelistedLiquidityProvider(address provider)`

Remove an address, after which this address can no longer join a pool. (Has no effect on existing LPs.)

> Creating a pool from the Factory

`createPool(uint initialSupply)`

Creates a pool with the given initial supply of Pool Tokens (with the asset allocation and weights specified by the factory)
<br>Use this constructor if you canChangeWeights is false, or you accept the default block time parameters for gradual weight change

`createPool(uint initialSupply, uint minimumWeightChangeBlockPeriod, uint addTokenTimeLockInBlocks)`

This overload allows you to specify the block timing parameters (within limits), at pool creation time. They are fixed thereafter.
<br>So you cannot call updateWeightsGradually with a duration <em>(endBlock - startBlock) < minimumWeightChangeBlockPeriod</em>.
<br><em>addTokenTimeLockInBlocks</em> is the total number of blocks that have to pass before a new commited token can be applied

> Adding/Removing Liquidity

`joinPool(uint poolAmountOut, uint[] maxAmountsIn)`

Deposit at most the token amounts specified in <em>maxAmountsIn</em>, and receive <em>poolAmountOut</em> pool tokens in return.

`exitPool(uint poolAmountIn, uint[] minAmountsOut)`

Redeem <em>poolAmountIn</em> pool tokens for at least the token amounts specified in <em>minAmountsOut</em>

There are additional variations for specifying exact amounts (Uniswap-style)

### PCToken.sol

Balancer Smart Pool token. A standard ERC-20 with some extra math functions. Note that the math is normalized such that "1" is 10^18. These tokens have 18 decimals, and a configurable token symbol. (The token name is composed at run time from
a fixed prefix and the symbol.)

### IBFactory.sol

Interface for the [Balancer Factory](https://github.com/balancer-labs/balancer-core/blob/master/contracts/BFactory.sol).

## NOTE

You cannot exit 100% using Pool Tokens (rebind will revert). It is possible to do using unbind with special permissions, but the trade-off is a potential loss of security. As described above, you can exit 1/3 at a time, or call removeToken if you have the right (keeping in mind that removing all tokens destroys the pool).

## Getting Started - Local Testing

`yarn`

`yarn testrpc`

`yarn test`

## Contracts Deployment
Install dependencies

`yarn`

Compile contracts

`yarn compile`

### Configuration
Create an `.env` file from the `.env.example` and fill the variables

The default configuration for the pool rights available [here](./helpers/permissions.js) is the following:
```
const permissions = {
  canPauseSwapping: true,
  canChangeSwapFee: true,
  canChangeWeights: true,
  canAddRemoveTokens: true,
  canWhitelistLPs: false,
  canChangeCap: false,
}
```

Notes:
- If `canWhitelistLPs` is `true` then the pool will be private and only whitelisted addresses can provide liquidity.
- If `canChangeCap` is `true` then the default cap will be the initial supply (`100`), and it should be manually updated by calling `setCap` to allow new liquidity to be provided.

### Run deployment scripts
Running the deployment script will:
- Deploy the ConfigurableRightsPool implementation contract
- Deploy the CRPFactory
- Call `CRPFactory.newCrp` to create and initialize a new proxy smart pool using the ConfigurableRightsPool implementation address.
- Give allowance to the crpPool on both involved tokens
- Call `crpPool.createPool` on the proxy smart pool to create the BPool with the initial supply of 100 tokens

#### Kovan deploy

`yarn run deploy:kovan`

#### Mainnet deploy

`yarn run deploy:mainnet`

## Verify contracts

The flattened versions of the contracts included in `flats` can be used to manually verify the contracts in the explorer with a single file.
Notice that for the ConfigurableRightsPool implementation contract the libraries addresses should be included in the verification.

To generate them again, run `yarn run flatten`

Then remove the duplicated lines of `SPDX-License-Identifier: GPL-3.0-or-later` and `pragma experimental ABIEncoderV2;` since that will produce and error in the explorer verification as it expect only one license and ABIEncoderV2 instruction per file.
