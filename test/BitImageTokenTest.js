const BitImageToken = artifacts.require('./BitImageToken.sol');

const {
    ethBalance,
    toWei,
    asserter,
    timer
} = require('./Utils.js');

const OWNER = web3.eth.accounts[0];
const SALE_AGENT = web3.eth.accounts[1];
const USER = web3.eth.accounts[2];
const USER2 = web3.eth.accounts[3];
const USER3 = web3.eth.accounts[4];

const TOTAL_SUPPLY = toWei(10000000000);
const ONE_BIM = toWei(1);

contract('BitImageToken [initializing state variables]', () => {
    let token;

    beforeEach(async () => {
        token = await BitImageToken.new();
    });

    it('should have \'BitImage Token\' name', async () => {
        let name = await token.name();
        assert.equal(name, 'BitImage Token');
    });

    it('should have \'BIM\' symbol', async () => {
        let symbol = await token.symbol();
        assert.equal(symbol, 'BIM');
    });

    it('should have 18 decimal places', async () => {
        let decimals = (await token.decimals()).toNumber();
        assert.equal(decimals, 18);
    });

    it('should have owner', async () => {
        let owner = await token.owner();
        assert.equal(owner, OWNER);
    });

    it('should put 10,000,000,000 BIM to total supply', async () => {
        let totalSupply = (await token.totalSupply()).toNumber();
        assert.equal(totalSupply, TOTAL_SUPPLY);
    });

    it('should put 10,000,000,000 BIM to owner\'s balance', async () => {
        let ownerBalance = (await token.balanceOf(OWNER)).toNumber();
        assert.equal(ownerBalance, TOTAL_SUPPLY);
    });

    it('sholud be not be released', async () => {
        let released = await token.released();
        assert.isFalse(released);
    });
});

contract('BitImageToken [setSaleAgent() function]', () => {
    let token;

    beforeEach(async () => {
        token = await BitImageToken.new();
    });

    it('should not allow to set sale agent by regular user', async () => {
        await asserter.expectError(token.setSaleAgent(SALE_AGENT, {from: USER}));
    });

    it('should not allow to set sale agent with 0x0 address', async () => {
        await asserter.expectError(token.setSaleAgent(0x0));
    });

    it('should allow to set sale agent by owner', async () => {
        await token.setSaleAgent(SALE_AGENT);
        let saleAgent = await token.saleAgent();
        assert.equal(saleAgent, SALE_AGENT);
    });

    it('should allow to spend all tokens by sale agent', async () => {
        await token.setSaleAgent(SALE_AGENT);
        let allowedValue = (await token.allowance(OWNER, SALE_AGENT)).toNumber();
        assert.equal(allowedValue, TOTAL_SUPPLY);
    });
});

contract('BitImageToken [release() function]', () => {
    let token;

    beforeEach(async () => {
        token = await BitImageToken.new();
    });

    it('should not allow to release tokens by owner', async () => {
        await asserter.expectError(token.release({from: OWNER}));
    });

    it('should not allow to release tokens by regular user', async () => {
        await asserter.expectError(token.release({from: USER}));
    });

    it('should allow to release tokens by sale agent', async () => {
        await token.setSaleAgent(SALE_AGENT);
        await token.release({from: SALE_AGENT});
        let released = await token.released();
        assert.isTrue(released);
    });
});

contract('BitImageToken [lock() function]', () => {
    let token;

    beforeEach(async () => {
        token = await BitImageToken.new();
    });

    it('should not allow set release time by owner', async () => {
        let oneDayLock = timer.now() + timer.duration.days(1);
        await asserter.expectError(token.lock(OWNER, oneDayLock, {from: OWNER}));
    });

    it('should not allow to set release time by regular user', async () => {
        let oneDayLock = timer.now() + timer.duration.days(1);
        await asserter.expectError(token.lock(OWNER, oneDayLock, {from: USER}));
    });

    it('should allow to set release time by sale agent', async () => {
        await token.setSaleAgent(SALE_AGENT);
        let oneDayLock = timer.now() + timer.duration.days(1);
        await token.lock(OWNER, oneDayLock, {from: SALE_AGENT});
        let releaseTime = await token.timelock(OWNER);
        assert.equal(releaseTime, oneDayLock);
    });

    it('should not allow to set release time for token holder with 0x0 address', async () => {
        await token.setSaleAgent(SALE_AGENT);
        let oneDayLock = timer.now() + timer.duration.days(1);
        await asserter.expectError(token.lock(0x0, oneDayLock, {from: SALE_AGENT}));
    });

    it('should not allow to set release time less than or equal to current time', async () => {
        await token.setSaleAgent(SALE_AGENT);
        await asserter.expectError(token.lock(OWNER, timer.now(), {from: SALE_AGENT}));
    });
});

contract('BitImageToken [transfer() function]', () => {
    let token;

    beforeEach(async () => {
        token = await BitImageToken.new();
    });

    it('should not allow to transfer tokens before release', async () => {
        await asserter.expectError(token.transfer(USER, ONE_BIM));
    });

    it('should not allow to transfer tokens by sale agent', async () => {
        await token.setSaleAgent(SALE_AGENT);
        await asserter.expectError(token.transfer(USER, ONE_BIM, {from: SALE_AGENT}));
    });

    it('should allow to transfer tokens after release', async () => {
        await token.setSaleAgent(SALE_AGENT);
        await token.release({from: SALE_AGENT});
        await token.transfer(USER, ONE_BIM);
        let userBalance = (await token.balanceOf(USER)).toNumber();
        let ownerBalance = (await token.balanceOf(OWNER)).toNumber();
        assert.equal(userBalance, ONE_BIM);
        assert.equal(ownerBalance, TOTAL_SUPPLY - ONE_BIM);
    });

    it('should not allow to transfer locked tokens after release and when lock time is not up', async () => {
        await token.setSaleAgent(SALE_AGENT);
        await token.release({from: SALE_AGENT});
        let oneDayLock = timer.now() + timer.duration.days(1);
        await token.lock(OWNER, oneDayLock, {from: SALE_AGENT});
        await asserter.expectError(token.transfer(USER, ONE_BIM));
    });

    it('should not allow to transfer locked tokens before release and when lock time is up', async () => {
        await token.setSaleAgent(SALE_AGENT);
        let oneDayLock = timer.now() + timer.duration.days(1);
        await token.lock(OWNER, oneDayLock, {from: SALE_AGENT});
        await timer.increaseTime(oneDayLock + timer.duration.seconds(1));
        await asserter.expectError(token.transfer(USER, ONE_BIM));
    });

    it('should transfer locked tokens after release and when lock time is up', async () => {
        await token.setSaleAgent(SALE_AGENT);
        await token.release({from: SALE_AGENT});
        let oneDayLock = timer.now() + timer.duration.days(1);
        await token.lock(OWNER, oneDayLock, {from: SALE_AGENT});
        await timer.increaseTime(oneDayLock + timer.duration.seconds(1));
        await token.transfer(USER, ONE_BIM);
        let userBalance = (await token.balanceOf(USER)).toNumber();
        let ownerBalance = (await token.balanceOf(OWNER)).toNumber();
        assert.equal(userBalance, ONE_BIM);
        assert.equal(ownerBalance, TOTAL_SUPPLY - ONE_BIM);
    });
});

contract('BitImageToken [transferFrom() function]', () => {
    let token;

    beforeEach(async () => {
        token = await BitImageToken.new();
    });

    it('should not allow to transfer tokens before release', async () => {
        await asserter.expectError(token.transferFrom(OWNER, USER, ONE_BIM, {from: OWNER}));
    });

    it('should allow to transfer tokens by sale agent', async () => {
        await token.setSaleAgent(SALE_AGENT);
        await token.release({from: SALE_AGENT});
        await token.transferFrom(OWNER, USER, ONE_BIM, {from: SALE_AGENT});
        let userBalance = (await token.balanceOf(USER)).toNumber();
        let ownerBalance = (await token.balanceOf(OWNER)).toNumber();
        assert.equal(userBalance, ONE_BIM);
        assert.equal(ownerBalance, TOTAL_SUPPLY - ONE_BIM);
    });

    it('should allow to transfer tokens by regular user after release', async () => {
        await token.setSaleAgent(SALE_AGENT);
        await token.release({from: SALE_AGENT});
        await token.transfer(USER, ONE_BIM);
        let userBalance = (await token.balanceOf(USER)).toNumber();
        await token.approve(USER2, userBalance, {from: USER});
        await token.transferFrom(USER, USER3, userBalance, {from: USER2});
        let userBalance3 = (await token.balanceOf(USER3)).toNumber();
        assert.equal(userBalance3, ONE_BIM);
    });

    it('should not allow to transfer locked tokens after release and when lock time is not up', async () => {
        await token.setSaleAgent(SALE_AGENT);
        await token.release({from: SALE_AGENT});
        await token.transfer(USER, ONE_BIM);
        let userBalance = (await token.balanceOf(USER)).toNumber();
        await token.approve(USER2, userBalance, {from: USER});
        let oneDayLock = timer.now() + timer.duration.days(1);
        await token.lock(USER2, oneDayLock, {from: SALE_AGENT});
        await asserter.expectError(token.transferFrom(USER, USER3, userBalance, {from: USER2}));
    });

    it('should transfer locked tokens after release and when lock time is up', async () => {
        await token.setSaleAgent(SALE_AGENT);
        await token.release({from: SALE_AGENT});
        await token.transfer(USER, ONE_BIM);
        let userBalance = (await token.balanceOf(USER)).toNumber();
        await token.approve(USER2, userBalance, {from: USER});
        let oneDayLock = timer.now() + timer.duration.days(1);
        await token.lock(USER2, oneDayLock, {from: SALE_AGENT});
        await timer.increaseTime(oneDayLock + timer.duration.seconds(1));
        await token.transferFrom(USER, USER3, userBalance, {from: USER2});
        let userBalance3 = (await token.balanceOf(USER3)).toNumber();
        assert.equal(userBalance3, ONE_BIM);
    });
});

contract('BitImageToken [approve() function]', () => {
    let token;

    beforeEach(async () => {
        token = await BitImageToken.new();
    });

    it('should not allow to approve before release', async () => {
        await asserter.expectError(token.approve(USER, ONE_BIM));
    });

    it('should allow to approve after release', async () => {
        await token.setSaleAgent(SALE_AGENT);
        await token.release({from: SALE_AGENT});
        await token.approve(USER, ONE_BIM);
        let allowedValue = await token.allowance(OWNER, USER);
        assert.equal(allowedValue, ONE_BIM);
    });

    it('should not allow to approve to spend locked tokens after release and when lock time is not up', async () => {
        await token.setSaleAgent(SALE_AGENT);
        await token.release({from: SALE_AGENT});
        let oneDayLock = timer.now() + timer.duration.days(1);
        await token.lock(OWNER, oneDayLock, {from: SALE_AGENT});
        await asserter.expectError(token.approve(USER, ONE_BIM));
    });

    it('should not allow to approve to spend locked tokens before release and when lock time is up', async () => {
        await token.setSaleAgent(SALE_AGENT);
        let oneDayLock = timer.now() + timer.duration.days(1);
        await token.lock(OWNER, oneDayLock, {from: SALE_AGENT});
        await timer.increaseTime(oneDayLock + timer.duration.seconds(1));
        await asserter.expectError(token.approve(USER, ONE_BIM));
    });

    it('should allow to approve to spend locked tokens after release and when lock time is up', async () => {
        await token.setSaleAgent(SALE_AGENT);
        await token.release({from: SALE_AGENT});
        let oneDayLock = timer.now() + timer.duration.days(1);
        await token.lock(OWNER, oneDayLock, {from: SALE_AGENT});
        await timer.increaseTime(oneDayLock + timer.duration.seconds(1));
        await token.approve(USER, ONE_BIM);
        let allowedValue = await token.allowance(OWNER, USER);
        assert.equal(allowedValue, ONE_BIM);
    });
});

contract('BitImageToken [increaseApproval() function]', () => {
    let token;

    beforeEach(async () => {
        token = await BitImageToken.new();
    });

    it('should not allow to increase allowed amount of tokens before release', async () => {
        await asserter.expectError(token.increaseApproval(USER, ONE_BIM));
    });

    it('should allow to increase allowed amount of tokens after release', async () => {
        await token.setSaleAgent(SALE_AGENT);
        await token.release({from: SALE_AGENT});
        await token.increaseApproval(USER, ONE_BIM);
        let allowedValue = (await token.allowance(OWNER, USER)).toNumber();
        assert.equal(allowedValue, ONE_BIM);
    });

    it('should not allow to increase allowed amount of locked tokens after release and when lock time is not up', async () => {
        await token.setSaleAgent(SALE_AGENT);
        await token.release({from: SALE_AGENT});
        let oneDayLock = timer.now() + timer.duration.days(1);
        await token.lock(OWNER, oneDayLock, {from: SALE_AGENT});
        await asserter.expectError(token.increaseApproval(USER, ONE_BIM));
    });

    it('should not allow to increase allowed amount of locked tokens before release and when lock time is up', async () => {
        await token.setSaleAgent(SALE_AGENT);
        let oneDayLock = timer.now() + timer.duration.days(1);
        await token.lock(OWNER, oneDayLock, {from: SALE_AGENT});
        await timer.increaseTime(oneDayLock + timer.duration.seconds(1));
        await asserter.expectError(token.increaseApproval(USER, ONE_BIM));
    });

    it('should allow to increase allowed amount of locked tokens after release and when lock time is up', async () => {
        await token.setSaleAgent(SALE_AGENT);
        await token.release({from: SALE_AGENT});
        let oneDayLock = timer.now() + timer.duration.days(1);
        await token.lock(OWNER, oneDayLock, {from: SALE_AGENT});
        await timer.increaseTime(oneDayLock + timer.duration.seconds(1));
        await token.increaseApproval(USER, ONE_BIM);
        let allowedValue = (await token.allowance(OWNER, USER)).toNumber();
        assert.equal(allowedValue, ONE_BIM);
    });
});

contract('BitImageToken [decreaseApproval() function]', () => {
    let token;

    beforeEach(async () => {
        token = await BitImageToken.new();
    });

    it('should not allow to decrease allowed amount of tokens before release', async () => {
        await asserter.expectError(token.decreaseApproval(USER, ONE_BIM));
    });

    it('should allow to decrease allowed amount of tokens after release', async () => {
        await token.setSaleAgent(SALE_AGENT);
        await token.release({from: SALE_AGENT});
        await token.increaseApproval(USER, ONE_BIM);
        let allowedValue = (await token.allowance(OWNER, USER)).toNumber();
        assert.equal(allowedValue, ONE_BIM);
        await token.decreaseApproval(USER, ONE_BIM);
        allowedValue = (await token.allowance(OWNER, USER)).toNumber();
        assert.equal(allowedValue, 0);
    });

    it('should not allow to decrease allowed amount of locked tokens after release and when lock time is not up', async () => {
        await token.setSaleAgent(SALE_AGENT);
        await token.release({from: SALE_AGENT});
        let oneDayLock = timer.now() + timer.duration.days(1);
        await token.lock(OWNER, oneDayLock, {from: SALE_AGENT});
        await asserter.expectError(token.decreaseApproval(USER, ONE_BIM));
    });

    it('should not allow to decrease allowed amount of locked tokens before release and when lock time is up', async () => {
        await token.setSaleAgent(SALE_AGENT);
        let oneDayLock = timer.now() + timer.duration.days(1);
        await token.lock(OWNER, oneDayLock, {from: SALE_AGENT});
        await timer.increaseTime(oneDayLock + timer.duration.seconds(1));
        await asserter.expectError(token.decreaseApproval(USER, ONE_BIM));
    });

    it('should allow to decrease allowed amount of locked tokens after release and when lock time is up', async () => {
        await token.setSaleAgent(SALE_AGENT);
        await token.release({from: SALE_AGENT});
        let oneDayLock = timer.now() + timer.duration.days(1);
        await token.lock(OWNER, oneDayLock, {from: SALE_AGENT});
        await timer.increaseTime(oneDayLock + timer.duration.seconds(1));
        await token.increaseApproval(USER, ONE_BIM);
        let allowedValue = (await token.allowance(OWNER, USER)).toNumber();
        assert.equal(allowedValue, ONE_BIM);
        await token.decreaseApproval(USER, ONE_BIM);
        allowedValue = (await token.allowance(OWNER, USER)).toNumber();
        assert.equal(allowedValue, 0);
    });
});

contract('BitImageToken [burn() function]', () => {
    let token;

    beforeEach(async () => {
        token = await BitImageToken.new();
    });

    it('should not allow to burn tokens by owner', async () => {
        let totalSupply = (await token.totalSupply()).toNumber();
        await asserter.expectError(token.burn(totalSupply));
    });

    it('should not allow to burn tokens by regular user', async () => {
        let totalSupply = (await token.totalSupply()).toNumber();
        await asserter.expectError(token.burn(totalSupply, {from: USER}));
    });
});

contract('BitImageToken [burnFrom() function]', () => {
    let token;

    beforeEach(async () => {
        token = await BitImageToken.new();
    });

    it('should not allow to burn tokens by owner', async () => {
        let totalSupply = (await token.totalSupply()).toNumber();
        await asserter.expectError(token.burnFrom(OWNER, totalSupply));
    });

    it('should not allow to burn tokens by regular user', async () => {
        let totalSupply = (await token.totalSupply()).toNumber();
        await asserter.expectError(token.burnFrom(OWNER, totalSupply, {from: USER}));
    });

    it('should allow to burn tokens by sale agent', async () => {
        await token.setSaleAgent(SALE_AGENT);
        let totalSupply = (await token.totalSupply()).toNumber();
        await token.burnFrom(OWNER, totalSupply, {from: SALE_AGENT});
        let ownerBalance = (await token.balanceOf(OWNER)).toNumber();
        assert.equal(ownerBalance, 0);
    });

    it('should not allow to burn tokens when amount of token to be burned is less than zero', async () => {
        await token.setSaleAgent(SALE_AGENT);
        await asserter.expectError(token.burnFrom(OWNER, -ONE_BIM, {from: SALE_AGENT}));
    });

    it('should not allow to burn more tokens than user has', async () => {
        await token.setSaleAgent(SALE_AGENT);
        let totalSupply = (await token.totalSupply()).toNumber();
        await asserter.expectError(token.burnFrom(OWNER, totalSupply + ONE_BIM, {from: SALE_AGENT}));
    });
});
