const BitImageToken = artifacts.require('./BitImageToken.sol');
const BitImageTokenSale = artifacts.require('./BitImageTokenSale.sol');

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

const ONE_ETH = toWei(1);
const MIN_ETH = toWei(0.1);
const MAX_ETH = toWei(500);

const weeksToSeconds = (weeks) => weeks * 7 * 24 * 60 * 60;

async function sendTransaction(_crowdsale, _value, _from) {
    let weiMaxInvestment = (await _crowdsale.weiMaxInvestment()).toNumber();
    let n = Math.floor(_value / MAX_ETH);
    for (i = 0; i < n; i++) {
        await _crowdsale.sendTransaction({value: MAX_ETH, from: _from});
    }
    let y_ = _value - n * MAX_ETH;
    await _crowdsale.sendTransaction({value: y_, from: _from});
}

contract('BitImageTokenSale [initializing state variables]', () => {
    let crowdsale;

    beforeEach(async () => {
        crowdsale = await BitImageTokenSale.new();
    });

    it('should have initialized wallets', async () => {
        let walletEtherPresale = await crowdsale.walletEtherPresale();
        assert.notEqual(walletEtherPresale, 0x0);
        let walletEhterCrowdsale = await crowdsale.walletEhterCrowdsale();
        assert.notEqual(walletEhterCrowdsale, 0x0);
        let walletTokenTeam = await crowdsale.walletTokenTeam();
        assert.notEqual(walletTokenTeam, 0x0);
        for (let i = 0; i < 4; i++) {
            let walletTokenAdvisors = await crowdsale.walletTokenAdvisors(i);
            assert.notEqual(walletTokenAdvisors, 0x0);
        }
        let walletTokenBounty = await crowdsale.walletTokenBounty();
        assert.notEqual(walletTokenBounty, 0x0);
        let walletTokenReservation = await crowdsale.walletTokenReservation();
        assert.notEqual(walletTokenReservation, 0x0);
    });

    it('should have presale period equals 3 weeks', async () => {
        let periodPresale = await crowdsale.periodPresale();
        assert.equal(periodPresale, weeksToSeconds(3));
    });

    it('should have crowdsale period equals 6 weeks', async () => {
        let periodCrowdsale = await crowdsale.periodCrowdsale();
        assert.equal(periodCrowdsale, weeksToSeconds(6));
    });

    it('should have week period equals 1 week', async () => {
        let periodWeek = await crowdsale.periodWeek();
        assert.equal(periodWeek, weeksToSeconds(1));
    });

    it('should have minimal investment equals 0.1 ETH', async () => {
        let weiMinInvestment = (await crowdsale.weiMinInvestment()).toNumber();
        assert.equal(weiMinInvestment, MIN_ETH);
    });

    it('should have rate 1 ETH = 115400 BIM', async () => {
        let rate = (await crowdsale.rate()).toNumber();
        assert.equal(rate, 115400);
    });

    it('should have softCap equals 2300 ETH', async () => {
        let softCap = (await crowdsale.softCap()).toNumber();
        assert.equal(softCap, toWei(2300));
    });

    it('should have goal equals 6700 ETH', async () => {
        let goal = (await crowdsale.goal()).toNumber();
        assert.equal(goal, toWei(6700));
    });

    it('should have goal increment equals goal', async () => {
        let goalIncrement = (await crowdsale.goalIncrement()).toNumber();
        let goal = (await crowdsale.goal()).toNumber();
        assert.equal(goalIncrement, goal);
    });

    it('should have hardCap equals 47000 ETH', async () => {
        let hardCap = (await crowdsale.hardCap()).toNumber();
        assert.equal(hardCap, toWei(47000));
    });

    it('should have initial bonus equals 30%', async () => {
        let bonus = (await crowdsale.bonus()).toNumber();
        assert.equal(bonus, 30);
    });

    it('should have bonus dicrement equals 5%', async () => {
        let bonusDicrement = (await crowdsale.bonusDicrement()).toNumber();
        assert.equal(bonusDicrement, 5);
    });

    it('should have state \'NEW\'', async () => {
        let state = (await crowdsale.state()).toNumber();
        assert.equal(state, 0);
    });

    it('should be paused', async () => {
        let paused = await crowdsale.paused();
        assert.isTrue(paused);
    });
});

contract('BitImageTokenSale [setToken() function]', () => {
    let crowdsale;
    let token;

    beforeEach(async () => {
        crowdsale = await BitImageTokenSale.new();
        token = await BitImageToken.new();
        await token.setSaleAgent(crowdsale.address);
    });

    it('should allow to set token by owner', async () => {
        await crowdsale.setToken(token.address);
        let tokenAddress = await crowdsale.token();
        assert.equal(tokenAddress, token.address);
    });

    it('should not allow to set token by regular user', async () => {
        await asserter.expectError(crowdsale.setToken(token.address, {from: USER}));
    });

    it('should not allow to set token in unpaused state', async () => {
        await crowdsale.unpause();
        await asserter.expectError(crowdsale.setToken(token.address));
    });

    it('should not allow to set token when when token address is 0x0', async () => {
        await asserter.expectError(crowdsale.setToken(0x0));
    });

    it('should allow only one token assignment', async () => {
        await crowdsale.setToken(token.address);
        await asserter.expectError(crowdsale.setToken(SALE_AGENT));
    });
});

contract('BitImageTokenSale [start() function]', () => {
    let crowdsale;
    let token;

    beforeEach(async () => {
        crowdsale = await BitImageTokenSale.new();
        token = await BitImageToken.new();
    });

    it('should allow to start presale by owner', async () => {
        await crowdsale.setToken(token.address);
        let startTime = timer.now() + timer.duration.days(1);
        await crowdsale.start(startTime);
        let actualStartTime = await crowdsale.startTime();
        assert.equal(actualStartTime, startTime, 'wrong start time');
        let paused = await crowdsale.paused();
        assert.isFalse(paused, 'wrong state');
        let state = await crowdsale.state();
        assert.equal(state, 1, 'wrong state');
        let period = (await crowdsale.period()).toNumber();
        let periodPresale = (await crowdsale.periodPresale()).toNumber();
        assert.equal(period, periodPresale, 'wrong period');
    });

    it('should allow to start crowdsale by owner', async () => {
        await crowdsale.setToken(token.address);
        await token.setSaleAgent(crowdsale.address);
        let startTime = timer.now() + timer.duration.seconds(1);
        await crowdsale.start(startTime);
        await timer.increaseTime(timer.duration.seconds(10));
        let period = (await crowdsale.period()).toNumber();
        let endTime = startTime + period;
        let weiAmount = (await crowdsale.softCap()).toNumber();
        await sendTransaction(crowdsale, weiAmount, USER);
        assert.equal(ethBalance(crowdsale.address), weiAmount, 'wrong contract balance');
        await timer.increaseTime((endTime - startTime) + timer.duration.seconds(1));
        await crowdsale.pause();
        startTime = timer.now() + timer.duration.seconds(1);
        await crowdsale.start(startTime);
        let paused = await crowdsale.paused();
        assert.isFalse(paused, 'wrong state');
        let state = await crowdsale.state();
        assert.equal(state, 2, 'wrong state');
        period = (await crowdsale.period()).toNumber();
        let periodCrowdsale = (await crowdsale.periodCrowdsale()).toNumber();
        assert.equal(period, periodCrowdsale, 'wrong period');
    });

    it('should not allow to start campaign by regular user', async () => {
        await crowdsale.setToken(token.address);
        let startTime = timer.now() + timer.duration.days(1);
        await asserter.expectError(crowdsale.start(startTime, {from: USER}));
    });

    it('should not allow to start campaign in unpaused state', async () => {
        await crowdsale.setToken(token.address);
        let startTime = timer.now() + timer.duration.days(1);
        await crowdsale.start(startTime);
        await asserter.expectError(crowdsale.start(startTime + timer.duration.days(1)));
    });

    it('should not allow to start campaign in the past', async () => {
        await crowdsale.setToken(token.address);
        let startTime = timer.now();
        await timer.increaseTime(timer.duration.seconds(1));
        await asserter.expectError(crowdsale.start(startTime));
    });

    it('should not allow to start campaign when token is not initialized', async () => {
        let startTime = timer.now() + timer.duration.days(1);
        await asserter.expectError(crowdsale.start(startTime));
    });

    it('should not allow to start campaign twice when state is \'CROWDSALE\'', async () => {
        await crowdsale.setToken(token.address);
        await token.setSaleAgent(crowdsale.address);
        let startTime = timer.now() + timer.duration.seconds(1);
        await crowdsale.start(startTime);
        await timer.increaseTime(timer.duration.seconds(10));
        let period = (await crowdsale.period()).toNumber();
        let endTime = startTime + period;
        let weiAmount = (await crowdsale.softCap()).toNumber();
        await sendTransaction(crowdsale, weiAmount, USER);
        assert.equal(ethBalance(crowdsale.address), weiAmount, 'wrong contract balance');
        await timer.increaseTime((endTime - startTime) + timer.duration.seconds(1));
        await crowdsale.pause();
        startTime = timer.now() + timer.duration.seconds(1);
        await crowdsale.start(startTime);
        let paused = await crowdsale.paused();
        startTime = timer.now() + timer.duration.days(1);
        await asserter.expectError(crowdsale.start(startTime));
    });

    it('should not allow to start crowdsale when softCap is not reached', async () => {
        await crowdsale.setToken(token.address);
        await token.setSaleAgent(crowdsale.address);
        let startTime = timer.now() + timer.duration.seconds(1);
        await crowdsale.start(startTime);
        await timer.increaseTime(timer.duration.seconds(10));
        let period = (await crowdsale.period()).toNumber();
        let endTime = startTime + period;
        let weiAmount = (await crowdsale.softCap()).toNumber() - MIN_ETH;
        await sendTransaction(crowdsale, weiAmount, USER);
        await timer.increaseTime((endTime - startTime) + timer.duration.seconds(1));
        await crowdsale.pause();
        startTime = timer.now() + timer.duration.seconds(1);
        await asserter.expectError(crowdsale.start(startTime));
    });
});

contract('BitImageTokenSale [fallback fucntion]', () => {
    let crowdsale;
    let token;
    let startTime;

    beforeEach(async () => {
        crowdsale = await BitImageTokenSale.new();
        token = await BitImageToken.new();
        await token.setSaleAgent(crowdsale.address);
        await crowdsale.setToken(token.address);
        startTime = timer.now() + timer.duration.seconds(1);
    });

    it('should not allow to buy tokens in paused state', async () => {
        await crowdsale.start(startTime);
        await crowdsale.pause();
        await timer.increaseTime(timer.duration.seconds(1));
        await asserter.expectError(crowdsale.sendTransaction({value: ONE_ETH, from: USER}));
    });

    it('should not allow to buy tokens because too early', async () => {
        await crowdsale.start(timer.now() + timer.duration.minutes(1));
        await asserter.expectError(crowdsale.sendTransaction({value: ONE_ETH, from: USER}));
    });

    it('should not allow to buy tokens when state is neither \'PRESALE\' nor \'CROWDSALE\'', async () => {
        await crowdsale.unpause();
        await asserter.expectError(crowdsale.sendTransaction({value: ONE_ETH, from: USER}));
    });

    it('should not allow to buy tokens when crowdsale is ended', async () => {
        await crowdsale.start(startTime);
        await timer.increaseTime(timer.duration.seconds(10));
        let period = (await crowdsale.period()).toNumber();
        let endTime = startTime + period;
        let weiAmount = (await crowdsale.softCap()).toNumber();
        await sendTransaction(crowdsale, weiAmount, USER);
        assert.equal(ethBalance(crowdsale.address), weiAmount, 'wrong contract balance');
        await timer.increaseTime((endTime - startTime) + timer.duration.seconds(1));
        await crowdsale.pause();
        startTime = timer.now() + timer.duration.seconds(1);
        await crowdsale.start(startTime);
        assert.equal((await crowdsale.bonus()).toNumber(), 25, 'wrong bonus');
        period = (await crowdsale.period()).toNumber();
        endTime = startTime + period;
        await timer.increaseTime((endTime - startTime) + timer.duration.seconds(15));
        await asserter.expectError(crowdsale.sendTransaction({value: ONE_ETH, from: USER}));
    });

    it('should not allow to buy more tokens than contract holds for sale', async () => {
        await crowdsale.start(startTime);
        await timer.increaseTime(timer.duration.seconds(10));
        let hardCap = (await crowdsale.hardCap()).toNumber();
        await asserter.expectError(sendTransaction(crowdsale, 2 * hardCap, USER))
    });

    it('should not allow to buy tokens when ether amount is less than minimum investment', async () => {
        await crowdsale.start(startTime);
        await timer.increaseTime(timer.duration.seconds(10));
        await asserter.expectError(crowdsale.sendTransaction({value: MIN_ETH - toWei(0.01), from: USER}));
    });

    it('should not allow to buy tokens when ether amount is more than maximum investment', async () => {
        await crowdsale.start(startTime);
        await timer.increaseTime(timer.duration.seconds(10));
        await asserter.expectError(crowdsale.sendTransaction({value: MAX_ETH + toWei(0.01), from: USER}));
    });

    it('should not change period, bonus, and goal when ether amount is less than goal', async () => {
        await crowdsale.start(startTime);
        await timer.increaseTime(timer.duration.seconds(10));
        let period = (await crowdsale.period()).toNumber();
        let bonus = (await crowdsale.bonus()).toNumber();
        let goal = (await crowdsale.goal()).toNumber();
        let weiAmount = goal - MIN_ETH;
        await sendTransaction(crowdsale, weiAmount, USER);
        assert.equal(ethBalance(crowdsale.address), weiAmount, 'wrong contract balance');
        assert.equal(await crowdsale.startTime(), startTime, 'wrong start time');
        assert.equal((await crowdsale.period()).toNumber(), period, 'wrong period');
        assert.equal((await crowdsale.bonus()).toNumber(), bonus, 'wrong bonus');
        assert.equal((await crowdsale.goal()).toNumber(), goal, 'wrong goal');
    });

    it('should change period to 1 week, decrease bonus, and increase goal when ether amount equals goal and state is \'PRESALE\'', async () => {
        await crowdsale.start(startTime);
        await timer.increaseTime(timer.duration.seconds(10));
        let weiAmount = (await crowdsale.goal()).toNumber();
        await sendTransaction(crowdsale, weiAmount, USER);
        assert.equal(ethBalance(crowdsale.address), weiAmount, 'wrong contract balance');
        assert.isTrue((await crowdsale.startTime()).toNumber() > startTime, 'wrong startTime');
        assert.equal((await crowdsale.period()).toNumber(), 604800, 'wrong period');
        assert.equal((await crowdsale.bonus()).toNumber(), 25, 'wrong bonus');
        assert.equal((await crowdsale.goal()).toNumber(), weiAmount * 2, 'wrong goal');
    });

    it('should decrease bonus after beginning of \'CROWDSALE\'', async () => {
        await crowdsale.start(startTime);
        await timer.increaseTime(timer.duration.seconds(10));
        let period = (await crowdsale.period()).toNumber();
        let endTime = startTime + period;
        let weiAmount = (await crowdsale.softCap()).toNumber();
        await sendTransaction(crowdsale, weiAmount, USER);
        assert.equal(ethBalance(crowdsale.address), weiAmount, 'wrong contract balance');
        await timer.increaseTime((endTime - startTime) + timer.duration.seconds(1));
        await crowdsale.pause();
        startTime = timer.now() + timer.duration.seconds(1);
        await crowdsale.start(startTime);
        assert.equal((await crowdsale.bonus()).toNumber(), 25, 'wrong bonus');
    });

    it('should decrease bonus, increase goal when ether amount equals goal and state is \'CROWDSALE\'', async () => {
        await crowdsale.start(startTime);
        await timer.increaseTime(timer.duration.seconds(10));
        let period = (await crowdsale.period()).toNumber();
        let endTime = startTime + period;
        let weiAmount = (await crowdsale.softCap()).toNumber();
        await sendTransaction(crowdsale, weiAmount, USER);
        assert.equal(ethBalance(crowdsale.address), weiAmount, 'wrong contract balance');
        await timer.increaseTime((endTime - startTime) + timer.duration.seconds(1));
        await crowdsale.pause();
        startTime = timer.now() + timer.duration.seconds(1);
        await crowdsale.start(startTime);
        await timer.increaseTime(timer.duration.seconds(10));
        period = (await crowdsale.period()).toNumber();
        weiAmount = (await crowdsale.goal()).toNumber() - (await crowdsale.weiTotalReceived()).toNumber() + MIN_ETH;
        let goal = (await crowdsale.goal()).toNumber();
        await sendTransaction(crowdsale, weiAmount, USER);
        assert.equal((await crowdsale.startTime()).toNumber(), startTime, 'wrong start time');
        assert.equal((await crowdsale.period()).toNumber(), period, 'wrong period');
        assert.equal((await crowdsale.bonus()).toNumber(), 20, 'wrong bonus');
        assert.isTrue((await crowdsale.goal()).toNumber() >= 2 * goal, 'wrong goal');
    });

    it('should decrease bonus after each week', async () => {
        await crowdsale.start(startTime);
        await timer.increaseTime(timer.duration.seconds(10));
        let period = (await crowdsale.period()).toNumber();
        let endTime = startTime + period;
        let weiAmount = (await crowdsale.softCap()).toNumber();
        await sendTransaction(crowdsale, weiAmount, USER);
        assert.equal(ethBalance(crowdsale.address), weiAmount, 'wrong contract balance');
        await timer.increaseTime((endTime - startTime) + timer.duration.seconds(1));
        await crowdsale.pause();
        startTime = timer.now() + timer.duration.seconds(1);
        await crowdsale.start(startTime);
        assert.equal((await crowdsale.bonus()).toNumber(), 25, 'wrong bonus');
        await timer.increaseTime(timer.duration.weeks(1) + timer.duration.seconds(10));
        await crowdsale.sendTransaction({value: MIN_ETH, from: USER});
        bonus = (await crowdsale.bonus()).toNumber();
        assert.equal(bonus, 20);
        await timer.increaseTime(timer.duration.weeks(1) + timer.duration.seconds(10));
        await crowdsale.sendTransaction({value: MIN_ETH, from: USER});
        bonus = (await crowdsale.bonus()).toNumber();
        assert.equal(bonus, 15);
        await timer.increaseTime(timer.duration.weeks(1) + timer.duration.seconds(10));
        await crowdsale.sendTransaction({value: MIN_ETH, from: USER});
        bonus = (await crowdsale.bonus()).toNumber();
        assert.equal(bonus, 10);
        await timer.increaseTime(timer.duration.weeks(1) + timer.duration.seconds(10));
        await crowdsale.sendTransaction({value: MIN_ETH, from: USER});
        bonus = (await crowdsale.bonus()).toNumber();
        assert.equal(bonus, 5);
        await timer.increaseTime(timer.duration.weeks(1) + timer.duration.seconds(10));
        await crowdsale.sendTransaction({value: MIN_ETH, from: USER});
        bonus = (await crowdsale.bonus()).toNumber();
        assert.equal(bonus, 0);
    });

    it('should decrease bonus when goal is reached, and not allow to change bonus when next week is reached', async () => {
        await crowdsale.start(startTime);
        await timer.increaseTime(timer.duration.seconds(10));
        let period = (await crowdsale.period()).toNumber();
        let endTime = startTime + period;
        let weiAmount = (await crowdsale.softCap()).toNumber();
        await sendTransaction(crowdsale, weiAmount, USER);
        assert.equal(ethBalance(crowdsale.address), weiAmount, 'wrong contract balance');
        await timer.increaseTime((endTime - startTime) + timer.duration.seconds(1));
        await crowdsale.pause();
        startTime = timer.now() + timer.duration.seconds(1);
        await crowdsale.start(startTime);
        assert.equal((await crowdsale.bonus()).toNumber(), 25, 'wrong bonus');
        await timer.increaseTime(timer.duration.seconds(10));
        weiAmount = (await crowdsale.goal()).toNumber() - (await crowdsale.weiTotalReceived()).toNumber() + MIN_ETH;
        await sendTransaction(crowdsale, weiAmount, USER);
        assert.equal((await crowdsale.bonus()).toNumber(), 20, 'wrong bonus');
        weiAmount = (await crowdsale.goal()).toNumber() - (await crowdsale.weiTotalReceived()).toNumber() + MIN_ETH;
        await sendTransaction(crowdsale, weiAmount, USER);
        assert.equal((await crowdsale.bonus()).toNumber(), 15, 'wrong bonus');
        await timer.increaseTime(timer.duration.weeks(2));
        await crowdsale.sendTransaction({value: MIN_ETH, from: USER});
        assert.equal((await crowdsale.bonus()).toNumber(), 15, 'wrong bonus');
    });

    it('should decrease bonus according to week counter', async () => {
        await crowdsale.start(startTime);
        await timer.increaseTime(timer.duration.seconds(10));
        let period = (await crowdsale.period()).toNumber();
        let endTime = startTime + period;
        let weiAmount = (await crowdsale.softCap()).toNumber();
        await sendTransaction(crowdsale, weiAmount, USER);
        assert.equal(ethBalance(crowdsale.address), weiAmount, 'wrong contract balance');
        await timer.increaseTime((endTime - startTime) + timer.duration.seconds(1));
        await crowdsale.pause();
        startTime = timer.now() + timer.duration.seconds(1);
        await crowdsale.start(startTime);
        assert.equal((await crowdsale.bonus()).toNumber(), 25, 'wrong bonus');
        await timer.increaseTime(timer.duration.weeks(2) + timer.duration.seconds(10));
        await crowdsale.sendTransaction({value: MIN_ETH, from: USER});
        assert.equal((await crowdsale.bonus()).toNumber(), 15, 'wrong bonus');
    });
});

contract('BitImageTokenSale [refund() function]', () => {
    let crowdsale;
    let token;
    let startTime;
    let endTime;

    beforeEach(async () => {
        crowdsale = await BitImageTokenSale.new();
        token = await BitImageToken.new();
        await token.setSaleAgent(crowdsale.address);
        await crowdsale.setToken(token.address);
        startTime = timer.now() + timer.duration.seconds(1);
        await crowdsale.start(startTime);
        await timer.increaseTime(timer.duration.seconds(10));
        let period = (await crowdsale.period()).toNumber();
        endTime = startTime + period;
    });

    it('should not allow to get refund in paused state', async () => {
        let weiAmount = (await crowdsale.softCap()).toNumber() - MIN_ETH;
        await sendTransaction(crowdsale, weiAmount, USER3);
        await timer.increaseTime((endTime - startTime) + timer.duration.seconds(1));
        await crowdsale.pause();
        await asserter.expectError(crowdsale.refund({from: USER3}));
    });

    it('should not allow to get refund when presale has not ended', async () => {
        let weiAmount = (await crowdsale.softCap()).toNumber() - MIN_ETH;
        await sendTransaction(crowdsale, weiAmount, USER3);
        await asserter.expectError(crowdsale.refund({from: USER3}));
    });

    it('should not allow to get refund when presale has ended and softCap is reached', async () => {
        let weiAmount = (await crowdsale.softCap()).toNumber();
        await sendTransaction(crowdsale, weiAmount, USER3);
        await timer.increaseTime((endTime - startTime) + timer.duration.seconds(1));
        await asserter.expectError(crowdsale.refund({from: USER3}));
    });

    it('should not allow to get refund when contract balance equals 0', async () => {
        await timer.increaseTime((endTime - startTime) + timer.duration.seconds(1));
        await asserter.expectError(crowdsale.refund({from: USER3}));
    });

    it('should not allow to get refund for non contributor', async () => {
        let weiAmount = (await crowdsale.softCap()).toNumber() - MIN_ETH;
        await sendTransaction(crowdsale, weiAmount, USER3);
        await timer.increaseTime((endTime - startTime) + timer.duration.seconds(1));
        await asserter.expectError(crowdsale.refund({from: USER2}));
    });

    it('should not allow to get refund twice', async () => {
        await crowdsale.sendTransaction({value: ONE_ETH, from: USER2});
        await crowdsale.sendTransaction({value: ONE_ETH, from: USER3});
        await timer.increaseTime((endTime - startTime) + timer.duration.seconds(1));
        await crowdsale.refund({from: USER3});
        await asserter.expectError(crowdsale.refund({from: USER3}));
    });

    it('should get refund when presale has ended and softCap is not reached', async () => {
        await crowdsale.sendTransaction({value: ONE_ETH, from: USER3});
        await crowdsale.sendTransaction({value: MIN_ETH, from: USER2});
        await timer.increaseTime((endTime - startTime) + timer.duration.seconds(1));
        let user3BalanceBefore = ethBalance(USER3);
        await crowdsale.refund({from: USER3});
        let user3BalanceAfter = ethBalance(USER3);
        assert.isTrue(user3BalanceAfter > user3BalanceBefore, 'wrong user\'s balance');
        let user2BalanceBefore = ethBalance(USER2);
        await crowdsale.refund({from: USER2});
        let user2BalanceAfter = ethBalance(USER2);
        assert.isTrue(user2BalanceAfter > user2BalanceBefore, 'wrong user\'s balance');
        let weiTotalRefunded = await crowdsale.weiTotalRefunded();
        assert.equal(weiTotalRefunded.toNumber(), ONE_ETH + MIN_ETH, 'wrong total refunded amount');
    });

    it('should get refund and burn user\'s tokens', async () => {
        await crowdsale.sendTransaction({value: ONE_ETH, from: USER3});
        await timer.increaseTime((endTime - startTime) + timer.duration.seconds(1));
        await crowdsale.refund({from: USER3});
        let userBalance = (await token.balanceOf(USER3)).toNumber();
        assert.equal(userBalance, 0);
    });
});

contract('BitImageTokenSale [finalize() function]', () => {
    let crowdsale;
    let token;
    let startTime;
    let endTime;

    beforeEach(async () => {
        crowdsale = await BitImageTokenSale.new();
        token = await BitImageToken.new();
        await token.setSaleAgent(crowdsale.address);
        await crowdsale.setToken(token.address);
        startTime = timer.now() + timer.duration.seconds(1);
        await crowdsale.start(startTime);
        await timer.increaseTime(timer.duration.seconds(10));
        let period = (await crowdsale.period()).toNumber();
        endTime = startTime + period;
    });

    it('should not allow to finalize the sale by regular user', async () => {
        let weiAmount = (await crowdsale.softCap()).toNumber();
        await sendTransaction(crowdsale, weiAmount, USER);
        assert.equal(ethBalance(crowdsale.address), weiAmount, 'wrong contract balance');
        await timer.increaseTime((endTime - startTime) + timer.duration.seconds(1));
        await asserter.expectError(crowdsale.finalize({from: USER}));
    });

    it('should not allow to finalize the sale when softCap is not reached', async () => {
        let weiAmount = (await crowdsale.softCap()).toNumber() - MIN_ETH;
        await sendTransaction(crowdsale, weiAmount, USER2);
        await timer.increaseTime((endTime - startTime) + timer.duration.seconds(1));
        await asserter.expectError(crowdsale.finalize());
    });

    it('should not allow to finalize the sale when it has not ended and hardCap is not reached', async () => {
        let weiAmount = (await crowdsale.softCap()).toNumber();
        await sendTransaction(crowdsale, weiAmount, USER2);
        await asserter.expectError(crowdsale.finalize());
    });

    it('should not allow to finalize the sale when state is neither \'PRESALE\' nor \'CROWDSALE\'', async () => {
        let weiAmount = (await crowdsale.softCap()).toNumber();
        await sendTransaction(crowdsale, weiAmount, USER2);
        await timer.increaseTime((endTime - startTime) + timer.duration.seconds(1));
        await crowdsale.finalize();
        startTime = timer.now() + timer.duration.seconds(1);
        await crowdsale.start(startTime);
        await timer.increaseTime(timer.duration.seconds(10));
        await crowdsale.sendTransaction({value: ONE_ETH, from: USER3});
        period = (await crowdsale.period()).toNumber();
        endTime = startTime + period;
        await timer.increaseTime((endTime - startTime) + timer.duration.seconds(1));
        await crowdsale.finalize();
        await asserter.expectError(crowdsale.finalize());
    });

    it('should finalize the presale', async () => {
        let weiAmount = (await crowdsale.softCap()).toNumber();
        await sendTransaction(crowdsale, weiAmount, USER2);
        assert.equal(ethBalance(crowdsale.address), weiAmount, 'wrong contract balance');
        await timer.increaseTime((endTime - startTime) + timer.duration.seconds(1));
        await crowdsale.finalize();
        assert.equal(ethBalance(crowdsale.address), 0 , 'wrong contract balance');
        let paused = await crowdsale.paused();
        assert.isTrue(paused, 'wrong state');
    });

    it('should finalize the crowdsale', async () => {
        let weiAmount = (await crowdsale.softCap()).toNumber();
        await sendTransaction(crowdsale, weiAmount, USER2);
        await timer.increaseTime((endTime - startTime) + timer.duration.seconds(1));
        await crowdsale.finalize();
        startTime = timer.now() + timer.duration.seconds(1);
        await crowdsale.start(startTime);
        await timer.increaseTime(timer.duration.seconds(10));
        await crowdsale.sendTransaction({value: ONE_ETH, from: USER3});
        period = (await crowdsale.period()).toNumber();
        endTime = startTime + period;
        await timer.increaseTime((endTime - startTime) + timer.duration.seconds(1));
        await crowdsale.finalize();
        let released = await token.released();
        assert.isTrue(released);
        let state = await crowdsale.state();
        assert.equal(state, 3, 'wrong state');
    });
});
