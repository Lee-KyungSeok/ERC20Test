const RoughToken = artifacts.require('RoughToken.sol');

module.exports = async function(deployer, network, accounts) {
    await deployer.deploy(RoughToken, "RoughToken", "RTT", "18");
}

// RoughToken.deployed().then(instance => rough = instance) 와 같이 truffle console 에서 붙을 수 있다.