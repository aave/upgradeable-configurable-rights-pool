const Migrations = artifacts.require("Migrations");

module.exports = function(deployer, network) {
  if (network === 'development' || network === 'coverage') {
    deployer.deploy(Migrations);
  }
};
