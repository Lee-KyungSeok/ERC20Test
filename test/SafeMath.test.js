const shouldFail = require('./helpers/shouldFail');
const { MAX_UINT256 } = require("./helpers/constants");

const BigNumber = web3.BigNumber;
const SafeMathMock = artifacts.require('SafeMathMock');

require('chai')
    .use(require('chai-bignumber')(BigNumber))
    .should();

contract('SafeMath', () => {
    beforeEach(async () => {
        this.safeMath = await SafeMathMock.new();
    });

    describe('add', () => {
        describe('성공시', () => {
            it('overflow 가 일어나지 않을 경우 덧셈 연산을 한다.', async () => {
                const a = new BigNumber(5678);
                const b = new BigNumber(8000);
                const sum = await this.safeMath.add(a,b);

                sum.should.be.bignumber.equal(a.plus(b));
            });
        });

        describe('실패시', () => {
            it('overflow 인 경우 revert 를 발생시킨다.', async () => {
                const a = MAX_UINT256;
                const b = new BigNumber(3000);

                await shouldFail.reverting(this.safeMath.add(a, b));
            });
        });
    });

    describe('sub', () => {
        describe('성공시', () => {
            it('underflow 가 일어나지 않을 경우 뻴셈 연산을 한다.', async () => {
                const a = new BigNumber(1000);
                const b = new BigNumber(300);
                const sub = await this.safeMath.sub(a, b);

                sub.should.be.bignumber.equal(a.minus(b));
            });
        });

        describe('실패시', () => {
            it('결과가 음수인 경우 revert 를 밣생시킨다.', async () => {
                const a = new BigNumber(1000);
                const b = new BigNumber(3000);

                await shouldFail.reverting(this.safeMath.sub(a,b))
            })
        });
    });

    describe('mul', () => {
        describe('성공시', () => {
            it('성공시 곱셈 연산을 한다.', async () => {
                const a = new BigNumber(1234);
                const b = new BigNumber(25);
                const mul = await this.safeMath.mul(a,b);

                mul.should.be.bignumber.equal(a.times(b));
            });

            it('0 이 포함되어 있어도 올바른 연산을 한다.', async () => {
                const a = MAX_UINT256
                const b = new BigNumber(0);
                const mul = await this.safeMath.mul(a,b);

                mul.should.be.bignumber.equal(0);
            });
        });

        describe('실패시', () => {
            it('overflow 발생 시 revert 를 발생시킨다.', async () => {
                const a = new BigNumber(1234);
                const b = MAX_UINT256;

                await shouldFail.reverting(this.safeMath.mul(a, b));
            })
        });
    });

    describe('div', () => {
        describe('성공시', () => {
            it('underflow 가 일어나지 않을 경우 나눗셈 연산을 한다.', async () => {
                const a = new BigNumber(1000);
                const b = new BigNumber(30);
                const div = await this.safeMath.div(a,b);

                div.should.be.bignumber.equal(Math.floor(a.div(b)));
            });
        });

        describe('실패시', () => {
            it('0 으로 나눌 경우 revert 를 발생시킨다.', async () => {
                const a = new BigNumber(1000);
                const b = new BigNumber(0);

                await shouldFail.reverting(this.safeMath.div(a,b));
            })
        });
    });

    describe('mod', () => {
        describe('modulos correctly', () => {
            it('when the dividend is smaller than the divisor', async () => {
                const a = new BigNumber(284);
                const b = new BigNumber(5678);
                const mod = await this.safeMath.mod(a,b);

                mod.should.be.bignumber.equal(a.mod(b));
            });

            it('when the dividend is equal to the divisor', async () => {
                const a = new BigNumber(5678);
                const b = new BigNumber(5678);

                (await this.safeMath.mod(a, b)).should.be.bignumber.equal(a.mod(b));
            });

            it('when the dividend is larger than the divisor', async () => {
                const a = new BigNumber(7000);
                const b = new BigNumber(5678);

                (await this.safeMath.mod(a, b)).should.be.bignumber.equal(a.mod(b));
            });

            it('when the dividend is a multiple of the divisor', async () => {
                const a = new BigNumber(17034); // 17034 == 5678 * 3
                const b = new BigNumber(5678);

                (await this.safeMath.mod(a, b)).should.be.bignumber.equal(a.mod(b));
            });
        });

        it('reverts with a 0 divisor', async () => {
            const a = new BigNumber(5678);
            const b = new BigNumber(0);

            await shouldFail.reverting(this.safeMath.mod(a, b));
        });
    });
});
