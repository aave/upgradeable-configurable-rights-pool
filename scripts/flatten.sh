#!/usr/bin/env bash

if [ -d flats ]; then
  rm -rf flats
fi

mkdir -p flats

./node_modules/.bin/truffle-flattener contracts/CRPFactory.sol > flats/CRPFactory.sol
./node_modules/.bin/truffle-flattener contracts/ConfigurableRightsPool.sol > flats/ConfigurableRightsPool.sol
./node_modules/.bin/truffle-flattener contracts/lib/InitializableAdminUpgradeabilityProxy.sol > flats/InitializableAdminUpgradeabilityProxy.sol
