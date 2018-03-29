pragma solidity ^0.4.15;

import "zeppelin-solidity/contracts/lifecycle/Pausable.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";
import "./BitImageToken.sol";

/**
 * @title BitImageCrowdsale
 * @dev The BitImageCrowdsale contract is used for selling BitImageToken tokens (BIM).
 */
contract BitImageTokenSale is Pausable {
    using SafeMath for uint256;

    /**
     * @dev Event for token purchase logging.
     * @param _investor {address} the address of investor.
     * @param _weiAmount {uint256} the amount of contributed Ether.
     * @param _tokenAmount {uint256} the amount of tokens purchased.
     */
    event TokenPurchase(address indexed _investor, uint256 _weiAmount, uint256 _tokenAmount);

    /**
     * @dev Event for Ether Refunding logging.
     * @param _investor {address} the address of investor.
     * @param _weiAmount {uint256} the amount of Ether to be refunded.
     */
    event Refunded(address indexed _investor, uint256 _weiAmount);

    BitImageToken public token;

    address public walletEtherPresale;
    address public walletEhterCrowdsale;

    address public walletTokenTeam;
    address[] public walletTokenAdvisors;
    address public walletTokenBounty;
    address public walletTokenReservation;

    uint256 public startTime;
    uint256 public period;
    uint256 public periodPresale;
    uint256 public periodCrowdsale;
    uint256 public periodWeek;

    uint256 public weiMinInvestment;
    uint256 public weiMaxInvestment;

    uint256 public rate;

    uint256 public softCap;
    uint256 public goal;
    uint256 public goalIncrement;
    uint256 public hardCap;

    uint256 public tokenIcoAllocated;
    uint256 public tokenTeamAllocated;
    uint256 public tokenAdvisorsAllocated;
    uint256 public tokenBountyAllocated;
    uint256 public tokenReservationAllocated;

    uint256 public weiTotalReceived;

    uint256 public tokenTotalSold;

    uint256 public weiTotalRefunded;

    uint256 public bonus;
    uint256 public bonusDicrement;
    uint256 public bonusAfterPresale;

    struct Investor {
        uint256 weiContributed;
        uint256 tokenBuyed;
        bool refunded;
    }

    mapping (address => Investor) private investors;
    address[] private investorsIndex;

    enum State { NEW, PRESALE, CROWDSALE, CLOSED }
    State public state;


    /**
     * @dev Constructor for a crowdsale of BitImageToken tokens.
     */
    function BitImageTokenSale() public {
        walletEtherPresale = 0xD3e6686fD63e2828f6aC8caA1A37C077d59740ef;
        walletEhterCrowdsale = 0x774df4f75F205371471E0E29D8C11162f9DEc538;
        walletTokenTeam = 0xa14CF5D1C2F9dD9F9656F9EF94Fb837c873E0CD1;
        walletTokenBounty = 0x2BD73853a4660fa93C061FB73f07fb69855A6f71;
        walletTokenReservation = 0x71Ff6c566cF153490396FC1ef5E4E9DaaA131456;
        walletTokenAdvisors = [
            0x9a4df9717E6BbCDB747e578C28a7263933F7A89a,
            0xbFf2173e56F3b2868E7369Edca9b2baCAeDa5561,
            0x0FDE8220378615701F6780e19BC1C7C686672c3E,
            0xc7754c583cb96D9C96ecf29B4f0A5c8e72901BBe
        ];
        periodPresale = 2 weeks;
        periodCrowdsale = 6 weeks;
        periodWeek = 1 weeks;
        weiMinInvestment = 0.1 ether;
        weiMaxInvestment = 500 ether;
        rate = 115400;
        softCap = 2300 ether;
        goal = 6700 ether;
        goalIncrement = goal;
        hardCap = 47000 ether;
        bonus = 30;
        bonusDicrement = 5;
        state = State.NEW;
        pause();
    }

    /**
     * @dev Fallback function is called whenever Ether is sent to the contract.
     */
    function() external payable {
        purchase(msg.sender);
    }

    /**
     * @dev Initilizes the token with given address and allocates tokens.
     * @param _token {address} the address of token contract.
     */
    function setToken(address _token) external onlyOwner whenPaused {
        require(state == State.NEW);
        require(_token != address(0));
        require(token == address(0));
        token = BitImageToken(_token);
        tokenIcoAllocated = token.totalSupply().mul(62).div(100);
        tokenTeamAllocated = token.totalSupply().mul(18).div(100);
        tokenAdvisorsAllocated = token.totalSupply().mul(4).div(100);
        tokenBountyAllocated = token.totalSupply().mul(6).div(100);
        tokenReservationAllocated = token.totalSupply().mul(10).div(100);
        require(token.totalSupply() == tokenIcoAllocated.add(tokenTeamAllocated).add(tokenAdvisorsAllocated).add(tokenBountyAllocated).add(tokenReservationAllocated));
    }

    /**
     * @dev Sets the start time.
     * @param _startTime {uint256} the UNIX timestamp when to start the sale.
     */
    function start(uint256 _startTime) external onlyOwner whenPaused {
        require(_startTime >= now);
        require(token != address(0));
        if (state == State.NEW) {
            state = State.PRESALE;
            period = periodPresale;
        } else if (state == State.PRESALE && weiTotalReceived >= softCap) {
            state = State.CROWDSALE;
            period = periodCrowdsale;
            bonusAfterPresale = bonus.sub(bonusDicrement);
            bonus = bonusAfterPresale;
        } else {
            revert();
        }
        startTime = _startTime;
        unpause();
    }

    /**
     * @dev Finalizes the sale.
     */
    function finalize() external onlyOwner {
        require(weiTotalReceived >= softCap);
        require(now > startTime.add(period) || weiTotalReceived >= hardCap);

        if (state == State.PRESALE) {
            require(this.balance > 0);
            walletEtherPresale.transfer(this.balance);
            pause();
        } else if (state == State.CROWDSALE) {
            uint256 tokenTotalUnsold = tokenIcoAllocated.sub(tokenTotalSold);
            tokenReservationAllocated = tokenReservationAllocated.add(tokenTotalUnsold);

            require(token.transferFrom(token.owner(), walletTokenBounty, tokenBountyAllocated));
            require(token.transferFrom(token.owner(), walletTokenReservation, tokenReservationAllocated));
            require(token.transferFrom(token.owner(), walletTokenTeam, tokenTeamAllocated));
            token.lock(walletTokenReservation, now + 0.5 years);
            token.lock(walletTokenTeam, now + 1 years);
            uint256 tokenAdvisor = tokenAdvisorsAllocated.div(walletTokenAdvisors.length);
            for (uint256 i = 0; i < walletTokenAdvisors.length; i++) {
                require(token.transferFrom(token.owner(), walletTokenAdvisors[i], tokenAdvisor));
                token.lock(walletTokenAdvisors[i], now + 0.5 years);
            }

            token.release();
            state = State.CLOSED;
        } else {
            revert();
        }
    }

    /**
     * @dev Allows investors to get refund in case when ico is failed.
     */
    function refund() external whenNotPaused {
        require(state == State.PRESALE);
        require(now > startTime.add(period));
        require(weiTotalReceived < softCap);

        require(this.balance > 0);

        Investor storage investor = investors[msg.sender];

        require(investor.weiContributed > 0);
        require(!investor.refunded);

        msg.sender.transfer(investor.weiContributed);
        token.burnFrom(msg.sender, investor.tokenBuyed);
        investor.refunded = true;
        weiTotalRefunded = weiTotalRefunded.add(investor.weiContributed);

        Refunded(msg.sender, investor.weiContributed);
    }

    function purchase(address _investor) private whenNotPaused {
        require(state == State.PRESALE || state == State.CROWDSALE);
        require(now >= startTime && now <= startTime.add(period));

        if (state == State.CROWDSALE) {
            uint256 timeFromStart = now.sub(startTime);
            if (timeFromStart > periodWeek) {
                uint256 currentWeek = timeFromStart.div(1 weeks);
                uint256 bonusWeek = bonusAfterPresale.sub(bonusDicrement.mul(currentWeek));
                if (bonus > bonusWeek) {
                    bonus = bonusWeek;
                }
                currentWeek++;
                periodWeek = currentWeek.mul(1 weeks);
            }
        }

        uint256 weiAmount = msg.value;
        require(weiAmount >= weiMinInvestment && weiAmount <= weiMaxInvestment);

        uint256 tokenAmount = weiAmount.mul(rate);
        uint256 tokenBonusAmount = tokenAmount.mul(bonus).div(100);
        tokenAmount = tokenAmount.add(tokenBonusAmount);

        weiTotalReceived = weiTotalReceived.add(weiAmount);
        tokenTotalSold = tokenTotalSold.add(tokenAmount);
        require(tokenTotalSold <= tokenIcoAllocated);

        require(token.transferFrom(token.owner(), _investor, tokenAmount));

        Investor storage investor = investors[_investor];
        if (investor.weiContributed == 0) {
            investorsIndex.push(_investor);
        }
        investor.tokenBuyed = investor.tokenBuyed.add(tokenAmount);
        investor.weiContributed = investor.weiContributed.add(weiAmount);

        if (state == State.CROWDSALE) {
            walletEhterCrowdsale.transfer(weiAmount);
        }
        TokenPurchase(_investor, weiAmount, tokenAmount);

        if (weiTotalReceived >= goal) {
            if (state == State.PRESALE) {
                startTime = now;
                period = 1 weeks;
            }
            uint256 delta = weiTotalReceived.sub(goal);
            goal = goal.add(goalIncrement).add(delta);
            bonus = bonus.sub(bonusDicrement);
        }
    }
}
