const JewelryToken = artifacts.require('JewelryToken.sol');

module.exports = async function(deployer, network, accounts) {
    await deployer.deploy(JewelryToken);
};