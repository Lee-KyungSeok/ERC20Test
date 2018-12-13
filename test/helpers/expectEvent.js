const BigNumber = web3.BigNumber;
const should = require('chai')
    .use(require('chai-bignumber')(BigNumber))
    .should();

const inLogs = (logs, eventName, eventArgs = {}) => {
    const event = logs.find((e) => {
        if (e.event === eventName) {
            for (const [key,value] of Object.entries(eventArgs)) {
                contains(e.args, key, value);
            }
            return true;
        }
    });
    should.exist(event);
    return event;
};

const inTransaction = async (tx, eventName, eventArgs = {}) => {
    const { logs } = await tx;
    return inLogs(logs, eventName, eventArgs);
};

const contains = (args, key, value) => {
    if (isBigNumber(args[key])) {
        args[key].should.be.bignumber.equal(value);
    } else {
        args[key].should.be.equal(value);
    }
};

const isBigNumber = (object) => {
    return object.isBigNumber ||
        object instanceof BigNumber ||
        (object.constructor && object.constructor.name === 'BigNumber');
};

module.exports = {
    inLogs,
    inTransaction
}