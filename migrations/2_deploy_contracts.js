var BitImageToken = artifacts.require('./BitImageToken.sol');
var BitImageTokenSale = artifacts.require('./BitImageTokenSale.sol');

module.exports = (deployer) => {
    var token;
    deployer.deploy(BitImageToken).then(() => {
        return BitImageToken.deployed();
    }).then((instance) => {
        token = instance;
        return deployer.deploy(BitImageTokenSale);
    }).then(() => {
        return BitImageTokenSale.deployed();
    }).then((crowdsale) => {
        token.setSaleAgent(crowdsale.address);
        return crowdsale.setToken(token.address);
    });
};
