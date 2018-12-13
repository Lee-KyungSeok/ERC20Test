const shouldFail = require('./helpers/shouldFail');
const { ZERO_ADDRESS } = require("./helpers/constants");
const expectEvent = require('./helpers/expectEvent');

const RoughToken = artifacts.require('RoughToken');

const BigNumber = web3.BigNumber;

require('chai')
    .use(require('chai-bignumber')(BigNumber))
    .should();

contract('RoughToken', () => {

    let token;

    beforeEach(async () => {
        this.token = await RoughToken.new("RoughToken", "RGT", 18);
    });

    describe('ERC20Detailed', () => {
        it('token Name 은 RoughToken 이다. ', async () => {
            const name = await this.token.name();
            assert.equal(name, "RoughToken");
        });

        it('token symbol 은 RGT 이다.', async () => {
            const symbol = await this.token.symbol();
            assert.equal(symbol, "RGT");
        });

        it('token 은 소숫점 18 자리까지 사 가능하다.', async () => {
            const decimal = await this.token.decimals();
            assert.equal(decimal, 18);
        })
    });

    describe('total supply', () => {
       it('total supply 는 10000000 * (10 ** uint256(_decimals)) 이 된다.', async () => {
           const totalSupply = await this.token.totalSupply();
           const decimal = await this.token.decimals();
           const expectAmount = 10000000 * (Math.pow(10, decimal));
           totalSupply.should.be.bignumber.equal(expectAmount);
       })
    });

    describe('balance', () => {
        it('초기 sender 의 balance는 total supply 만큼 있다.', async () => {
            const totalSupply = await this.token.totalSupply();
            const senderAmount = await this.token.balanceOf(web3.eth.accounts[0]);
            totalSupply.should.be.bignumber.equal(senderAmount);
        });

        it('다른 address 의 balance 는 0 이다.', async () => {
            const otherAmount = await this.token.balanceOf(web3.eth.accounts[1]);
            otherAmount.should.be.bignumber.equal(0);
        });
    });

    describe('transfer', () => {
        it('balacne 를 초과해서 전송 시 revert 한다.', async () => {
            await shouldFail.reverting(
                this.token.transfer(web3.eth.accounts[0], 100, {from: web3.eth.accounts[2]})
            );
        });

        it('zero address 인 경우 revert 한다.', async () => {
            await shouldFail.reverting(
                this.token.transfer(ZERO_ADDRESS, 100)
            );
        });

        it('100 RTT 전송시 각각의 balance 가 조절된다.', async () => {
            const beforeSenderBalance = await this.token.balanceOf(web3.eth.accounts[0]);
            const beforeReceiverBalance = await this.token.balanceOf(web3.eth.accounts[1]);

            await this.token.transfer(web3.eth.accounts[1], 100, {from: web3.eth.accounts[0]});

            const senderBalance = await this.token.balanceOf(web3.eth.accounts[0]);
            const receiverBalance = await this.token.balanceOf(web3.eth.accounts[1]);

            senderBalance.should.be.bignumber.equal(beforeSenderBalance.sub(100));
            receiverBalance.should.be.bignumber.equal(beforeReceiverBalance.add(100));

        });

        it('transfer 함수 호출 시 Transfer event 가 발생한다.', async () => {
            const { logs } = await this.token.transfer(web3.eth.accounts[1], 100);

            expectEvent.inLogs(logs, 'Transfer', {
                from: web3.eth.accounts[0],
                to: web3.eth.accounts[1],
                value: 100
            });
        });
    });

    describe('approve', () => {
        const owner = web3.eth.accounts[0];
        const spender = web3.eth.accounts[1]
        const amount = 100;

        it('zero address 에 approve 할 경우 revert 한다.', async () => {
            await shouldFail.reverting(this.token.approve(ZERO_ADDRESS, amount));
        });

        it('approve 한 금액만큼 allowed 에 입력된다.', async () => {
           await this.token.approve(spender, amount);
           const allowedOwnerToSpender = await this.token.allowance(owner, spender);
           assert.equal(allowedOwnerToSpender, amount);

        });


        it('Approval event 를 발생한다.', async () => {
            const { logs } = await this.token.approve(spender, amount);
            expectEvent.inLogs(logs, 'Approval', {
                owner,
                spender,
                value: amount
            });
        })
    });

    describe('transfor from', async () => {
        const owner = web3.eth.accounts[0];
        const spender = web3.eth.accounts[1];
        const maybeReceiver = web3.eth.accounts[2];
        const amount = 100;

        beforeEach(async () => {
            await this.token.approve(spender, amount, {from: owner});
        });

        it('allowed 보다 많게 요청하면 revert 한다.', async () => {
            try {
                await this.token.transferFrom(owner, spender, amount + 100, {from: spender});
                should.fail(`Expected '${message}' failure not received`);
            } catch (e) {
                e.message.should.include("revert", "Wrong failure type");
            }
        });

        it('전송을 한 만큼 allowed 에서 감소시킨다.', async () => {
            const beforeAllowed = await this.token.allowance(owner, spender);
            await this.token.transferFrom(owner, maybeReceiver, 20, {from: spender});
            const afterAllowed = await this.token.allowance(owner, spender);

            afterAllowed.should.be.bignumber.equal(beforeAllowed.sub(20));
        });

        it('owner 와 receiver 의 balance 는 토큰을 전송받은 만큼 변화한다..', async () => {

            const sendValue = 20;

            const beforeSenderBalance = await this.token.balanceOf(owner);
            const beforeReceiverBalance = await this.token.balanceOf(maybeReceiver);

            await this.token.transferFrom(owner, maybeReceiver, sendValue, {from: spender});

            const senderBalance = await this.token.balanceOf(owner);
            const receiverBalance = await this.token.balanceOf(maybeReceiver);

            senderBalance.should.be.bignumber.equal(beforeSenderBalance.sub(sendValue));
            receiverBalance.should.be.bignumber.equal(beforeReceiverBalance.add(sendValue));
        });

        it('Transfer 이벤트를 발생시키며, 결과는 true 를 리턴한다.', async () => {
            const res = await this.token.transferFrom(owner, maybeReceiver, 20, {from: spender});
            const {logs} = res;
            const {args, event} = logs[0];

            assert(event === 'Transfer');
            assert(args.from, owner);
            assert(args.to, maybeReceiver);
            assert(args.value, 20);
            assert(res, true);

        })
    })
});