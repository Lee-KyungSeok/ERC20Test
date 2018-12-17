pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

library ExtendedMath {
    // 둘중 작은 것을 리턴
    function limitLessThan(uint256 a, uint256 b) internal pure returns (uint256 c) {
        if( a> b ) return b;

        return a;
    }
}

interface ApproveAndCallFallBack {

    function receiveApproval(address from, uint256 tokens, address token, bytes data) external;

}

interface I0xBTC {
    function mint(uint256 nonce, bytes32 challenge_digest) external returns (bool success);

    function getChallengeNumber() external view returns (bytes32);

    function getMiningDifficulty() external view returns (uint);

    function getMiningTarget() external view returns (uint);

    function getMiningReward() external view returns (uint);

    function getMintDigest(uint256 nonce, bytes32 challenge_digest, bytes32 challenge_number) external view returns (bytes32 digesttest);

    function checkMintSolution(uint256 nonce, bytes32 challenge_digest, bytes32 challenge_number, uint testTarget) external view returns (bool success);
}

// Mining Token (마이닝 하면 JewelryToken 을 줌)
contract JewelryToken is IERC20, I0xBTC, Ownable {
    using SafeMath for uint256;
    using ExtendedMath for uint256;

    string public _name;
    string public _symbol;
    uint8 public _decimals;
    uint256 public _totalSupply;

    mapping (address => uint256) public _balances;
    mapping (address => mapping (address => uint256)) public _allowed;

    // 난이도가 조절된 직후의 block number
    uint256 public latestDifficultyPeriodStarted;

    // number of 'block' mined
    uint256 public epochCount;
    // 난이도 주기 설정
    uint256 public _BLOCKS_PER_READJUSTMENT = 1024;

    // a little & big number (target)
    uint256 public _MINIMUM_TARGET = 2**16;
    uint256 public  _MAXIMUM_TARGET = 2**234;

    uint256 public miningTarget;

    // 새로운 reward 가 minting 되면 새로운 challenge number 생성 ( recent ethereum block hash)
    bytes32 public challengeNumber;

    // 반감기 시작? 및 최대 줄 수 있는 토큰량
    uint256 public rewardEra;
    uint256 public maxSupplyForEra;

    // 마지막 reward 관련
    address public lastRewardTo;
    uint256 public lastRewardAmount;
    uint256 public lastRewardEthBlockNumber;

    bool locked = false;

    mapping(bytes32 => bytes32) solutionForChallenge;

    uint256 public tokensMinted;

    event Mint(address indexed from, uint reward_amount, uint epochCount, bytes32 newChallengeNumber);

    constructor() public {
        _name = "JewelryToken";
        _symbol = "JLT";
        _decimals = 8;
        _totalSupply = 21000000 * 10**uint(_decimals);

        if(locked) revert();
        locked = true;

        tokensMinted = 0;

        rewardEra = 0;
        maxSupplyForEra = _totalSupply.div(2);
        miningTarget = _MAXIMUM_TARGET;
        latestDifficultyPeriodStarted = block.number;

        _startNewMiningEpoch();
    }

    function() public payable {
        revert();
    }

    // ----------------------------------------------------------------------------
    // 0xBTC 구현


    function mint(uint256 nonce, bytes32 challenge_digest) public returns (bool success) {

        // 중간자 공격 방어를 위해 { 최근 block hash, msg.sender, nonce } 가 포함되어야 한다.
        bytes32 digest = keccak256(abi.encodePacked(challengeNumber, msg.sender, nonce));

        // challenge digest 는 예상한 값과 동일해야 한다.
        require(digest == challenge_digest);

        // digest 는 target 보다 작아야 통과다
        require(uint256(digest) < miningTarget);

        // 각 challenge 마다 하나의 reward 만 준다.
        bytes32 solution = solutionForChallenge[challengeNumber];
        solutionForChallenge[challengeNumber] = digest;
        require(solution == 0x0); // 이중지불? 방지

        // reward 및 token 계산
        uint256 reward_amount = getMiningReward();
        _balances[msg.sender] = _balances[msg.sender].add(reward_amount);
        tokensMinted = tokensMinted.add(reward_amount);

        // 특정 era 안에서의 최대 supply 보다 많이 minting 할 수 없다.
        assert(tokensMinted <= maxSupplyForEra);

        // 마지막 reward 관련 정보 저장
        lastRewardTo = msg.sender;
        lastRewardAmount = reward_amount;
        lastRewardEthBlockNumber = block.number;

        _startNewMiningEpoch();

        emit Mint(msg.sender, reward_amount, epochCount, challengeNumber);

        return true;
    }

    function getChallengeNumber() public view returns (bytes32) {
        return challengeNumber;
    }

    function getMiningDifficulty() public view returns (uint) {
        return _MAXIMUM_TARGET.div(miningTarget);
    }

    function getMiningTarget() public view returns (uint) {
        return miningTarget;
    }

    // 비트코인 처럼 특정 reawrdEra 마다 반씩 줄여가면서 보상을 계산한다.
    function getMiningReward() public view returns (uint) {
        return (50 * 10**uint(_decimals) ).div( 2**rewardEra ) ;
    }

    function getMintDigest(uint256 nonce, bytes32 challenge_digest, bytes32 challenge_number) public view returns (bytes32 digesttest) {
        bytes32 digest = keccak256(challenge_number,msg.sender,nonce);
        return digest;

    }

    // mining software 를 도와준다
    function checkMintSolution(uint256 nonce, bytes32 challenge_digest, bytes32 challenge_number, uint testTarget) public view returns (bool) {
        bytes32 digest = keccak256(abi.encodePacked(challenge_number,msg.sender,nonce));
        require(uint256(digest) < testTarget);
        return (digest == challenge_digest);
    }

    // 새로운 새로운 epoch 시작
    function _startNewMiningEpoch() internal {

        //  mint 된 총 량은 그 기간안에서 줄 수 있는 최대량보다 작아야 하며
        // 40 번째 주기에서는 거의 토큰이 없으므로 이를 체크하여 rewardEra (기간) 를 결정한다.
        if (tokensMinted.add(getMiningReward()) > maxSupplyForEra && rewardEra < 39) {
            rewardEra = rewardEra + 1;
        }

        // max supply 를 계산한다. (reward era 가 바뀐 경우에만 바뀌겠징??)
        maxSupplyForEra = _totalSupply - _totalSupply.div(2 ** (rewardEra + 1));

        // epoch count 를 증가 시킨다.
        epochCount = epochCount.add(1);

        // epochCount 가 난이도 조절해야 하는 count 에 도달하면 체크한다.
        if(epochCount % _BLOCKS_PER_READJUSTMENT == 0) {
            _reAdjustDifficulty();
        }

        // 최근 이더리움 block hash 를 challengeNumber 에 넣는다.
        challengeNumber = blockhash(block.number - 1);
    }

    // 난이도를 조절한다.
    function _reAdjustDifficulty() internal {

        // 난이도 조절 기간에 다다를 때, 그 사이에 얼마나 많은 block number 수가 있었는지 확인 (보통 한시간에 360 블럭이 있다(3600s / 10s))
        uint256 ethBlocksSinceLastDifficultyPeriod = block.number - latestDifficultyPeriodStarted;

        // 이 토큰이 원하는 만큼의 block 수를 정의 (예측)
        // btc 는 10 분에 하나의 블록이 생성되는데 이더리움은 60 블록이 생성되므로 60 을 곱해준다.(비트코인은 1024 블락이지만 이더리움에서는 60을 곱한 블락 수만큼 생기기 때문)
        uint256 epochsMined = _BLOCKS_PER_READJUSTMENT;
        uint256 targetEthBlocksPerDiffPeriod = epochsMined * 60;

        // 실제 block 수가 작다는 것은 사람들이 빠르게 마이닝 했다는 소리이므로
        // 실제 block 수가 예측한 block 수보다 작다면 난이도를 높힌다. (아니라면 난이도를 낮춘다.)
        if (ethBlocksSinceLastDifficultyPeriod < targetEthBlocksPerDiffPeriod ) {
            uint256 excess_block_pct = (targetEthBlocksPerDiffPeriod.mul(100)).div(ethBlocksSinceLastDifficultyPeriod);
            uint256 excess_block_pct_extra = excess_block_pct.sub(100).limitLessThan(1000);

            // 난이도를 높힌다(mining target 을 낮춘다)
            miningTarget = miningTarget.sub(miningTarget.div(2000).mul(excess_block_pct_extra));

        } else {
            uint256 shortage_block_pct = (ethBlocksSinceLastDifficultyPeriod.mul(100)).div(targetEthBlocksPerDiffPeriod);
            uint256 shortage_block_pct_extra = shortage_block_pct.sub(100).limitLessThan(1000);

            // 난이도를 낮춘다(mining target 을 높힌다)
            miningTarget = miningTarget.add(miningTarget.div(2000).mul(shortage_block_pct_extra));

        }

        // 다음 번 난이도 조절을 위한 starting block number 설정
        latestDifficultyPeriodStarted = block.number;


        // 만약 설정한 max/min 난이도를 벗어난다면 조절
        if(miningTarget < _MINIMUM_TARGET) {
            miningTarget = _MINIMUM_TARGET;
        }

        if(miningTarget > _MAXIMUM_TARGET) {
            miningTarget = _MAXIMUM_TARGET;
        }
    }

    // ----------------------------------------------------------------------------
    // ERC20 구현


    function totalSupply() external view returns (uint256) {
        return _totalSupply - _balances[address (0)];
    }

    function balanceOf(address owner) public view returns (uint256) {
        return _balances[owner];
    }

    function allowance(address owner, address spender) public view returns (uint256) {
        return _allowed[owner][spender];
    }

    function transfer(address to, uint256 value) public returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) public returns (bool) {
        require(spender != address(0));

        _allowed[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) public returns (bool) {
        require(value <= _allowed[from][msg.sender]);

        _allowed[from][msg.sender] = _allowed[from][msg.sender].sub(value);
        _transfer(from, to, value);
        return true;
    }

    function increaseAllowance(address spender, uint256 addedValue) public returns (bool) {
        require(spender != address(0));

        _allowed[msg.sender][spender] = (
        _allowed[msg.sender][spender].add(addedValue));
        emit Approval(msg.sender, spender, _allowed[msg.sender][spender]);
        return true;
    }

    function decreaseAllowance(address spender, uint256 subtractedValue) public returns (bool) {
        require(spender != address(0));

        _allowed[msg.sender][spender] = (
        _allowed[msg.sender][spender].sub(subtractedValue));
        emit Approval(msg.sender, spender, _allowed[msg.sender][spender]);
        return true;
    }

    function _transfer(address from, address to, uint256 value) internal {
        require(value <= _balances[from]);
        require( to != address(0) );

        _balances[from] = _balances[from].sub(value);
        _balances[to] = _balances[to].add(value);
        emit Transfer(from, to, value);
    }

    // -----------
    function approveAndCall(address spender, uint tokens, bytes data) public returns (bool success) {

        _allowed[msg.sender][spender] = tokens;

        emit Approval(msg.sender, spender, tokens);

        ApproveAndCallFallBack(spender).receiveApproval(msg.sender, tokens, this, data);

        return true;

    }

    function transferAnyERC20Token(address tokenAddress, uint tokens) public onlyOwner returns (bool success) {

        return IERC20(tokenAddress).transfer(owner(), tokens);

    }
}