
const ethBalance = (address) => web3.eth.getBalance(address).toNumber();

const toWei = (number) => Number(web3.toWei(number, 'ether'));

const asserter = (() => {
    const fail = (msg) => (error) => assert(false, error ? `${msg}, but got error: ${error.message}` : msg);

    const expectError = async (promise) => {
        try {
            await promise;
            fail("expected to fail")();
        } catch (error) {
            assert(error.message.indexOf('invalid opcode') >= 0, `Expected throw, but got: ${error.message}`);
        }
    }

    return {
        fail,
        expectError
    };
})();


const timer = (() => {
    const duration = {
        seconds: function(val) { return val; },
        minutes: function(val) { return val * this.seconds(60); },
        hours: function(val) { return val * this.minutes(60); },
        days: function(val) { return val * this.hours(24); },
        weeks: function(val) { return val * this.days(7); },
        years: function(val) { return val * this.days(365); }
    };

    const now = () => web3.eth.getBlock('latest').timestamp;

    const increaseTime = (seconds) => {
        const id = Date.now();
        return new Promise((resolve, reject) => {
            web3.currentProvider.sendAsync({
                jsonrpc: '2.0',
                method: 'evm_increaseTime',
                params: [seconds],
                id: id
            }, err1 => {
                if (err1) return reject(err1);
                web3.currentProvider.sendAsync({
                    jsonrpc: '2.0',
                    method: 'evm_mine',
                    id: id + 1
                }, (err2, res) => {
                    return err2 ? reject(err2) : resolve(res);
                });
            });
        });
    }

    return {
        duration,
        now,
        increaseTime
    };
})();

module.exports = {
  ethBalance,
  toWei,
  asserter,
  timer
};
