pragma solidity ^0.4.15;

import "zeppelin-solidity/contracts/token/StandardToken.sol";
import "zeppelin-solidity/contracts/token/BurnableToken.sol";
import "zeppelin-solidity/contracts/ownership/Ownable.sol";

/**
 * @title BitImageToken
 * @dev ERC20 burnable token based on OpenZeppelin's implementation.
 */
contract BitImageToken is StandardToken, BurnableToken, Ownable {

    /**
     * @dev Event for tokens timelock logging.
     * @param _holder {address} the holder of tokens after they are released.
     * @param _releaseTime {uint256} the UNIX timestamp when token release is enabled.
     */
    event Timelock(address indexed _holder, uint256 _releaseTime);

    string public name;
    string public symbol;
    uint8 public decimals;
    bool public released;
    address public saleAgent;

    mapping (address => uint256) public timelock;

    modifier onlySaleAgent() {
        require(msg.sender == saleAgent);
        _;
    }

    modifier whenReleased() {
        if (timelock[msg.sender] != 0) {
            require(released && now > timelock[msg.sender]);
        } else {
            require(released || msg.sender == saleAgent);
        }
        _;
    }


    /**
     * @dev Constructor instantiates token supply and allocates balanace to the owner.
     */
    function BitImageToken() public {
        name = "Bitimage Token";
        symbol = "BIM";
        decimals = 18;
        released = false;
        totalSupply = 10000000000 ether;
        balances[msg.sender] = totalSupply;
        Transfer(address(0), msg.sender, totalSupply);
    }

    /**
     * @dev Associates this token with a specified sale agent. The sale agent will be able
     * to call transferFrom() function to transfer tokens during crowdsale.
     * @param _saleAgent {address} the address of a sale agent that will sell this token.
     */
    function setSaleAgent(address _saleAgent) public onlyOwner {
        require(_saleAgent != address(0));
        require(saleAgent == address(0));
        saleAgent = _saleAgent;
        super.approve(saleAgent, totalSupply);
    }

    /**
     * @dev Sets the released flag to true which enables to transfer tokens after crowdsale is end.
     * Once released, it is not possible to disable transfers.
     */
    function release() public onlySaleAgent {
        released = true;
    }

    /**
     * @dev Sets time when token release is enabled for specified holder.
     * @param _holder {address} the holder of tokens after they are released.
     * @param _releaseTime {uint256} the UNIX timestamp when token release is enabled.
     */
    function lock(address _holder, uint256 _releaseTime) public onlySaleAgent {
        require(_holder != address(0));
        require(_releaseTime > now);
        timelock[_holder] = _releaseTime;
        Timelock(_holder, _releaseTime);
    }

    /**
     * @dev Transfers tokens to specified address.
     * Overrides the transfer() function with modifier that prevents the ability to transfer
     * tokens by holders unitl release time. Only sale agent can transfer tokens unitl release time.
     * @param _to {address} the address to transfer to.
     * @param _value {uint256} the amount of tokens to be transferred.
     */
    function transfer(address _to, uint256 _value) public whenReleased returns (bool) {
        return super.transfer(_to, _value);
    }

    /**
     * @dev Transfers tokens from one address to another.
     * Overrides the transferFrom() function with modifier that prevents the ability to transfer
     * tokens by holders unitl release time. Only sale agent can transfer tokens unitl release time.
     * @param _from {address} the address to send from.
     * @param _to {address} the address to transfer to.
     * @param _value {uint256} the amount of tokens to be transferred.
     */
    function transferFrom(address _from, address _to, uint256 _value) public whenReleased returns (bool) {
        return super.transferFrom(_from, _to, _value);
    }

    /**
     * @dev Approve the passed address to spend the specified amount of tokens on behalf of msg.sender.
     * Overrides the approve() function with  modifier that prevents the ability to approve the passed
     * address to spend the specified amount of tokens until release time.
     * @param _spender {address} the address which will spend the funds.
     * @param _value {uint256} the amount of tokens to be spent.
     */
    function approve(address _spender, uint256 _value) public whenReleased returns (bool) {
        return super.approve(_spender, _value);
    }

    /**
     * @dev Increment allowed value.
     * Overrides the increaseApproval() function with modifier that prevents the ability to increment
     * allowed value until release time.
     * @param _spender {address} the address which will spend the funds.
     * @param _addedValue {uint} the amount of tokens to be added.
     */
    function increaseApproval(address _spender, uint _addedValue) public whenReleased returns (bool success) {
        return super.increaseApproval(_spender, _addedValue);
    }

    /**
     * @dev Dicrement allowed value.
     * Overrides the decreaseApproval() function with modifier that prevents the ability to dicrement
     * allowed value until release time.
     * @param _spender {address} the address which will spend the funds.
     * @param _subtractedValue {uint} the amount of tokens to be subtracted.
     */
    function decreaseApproval(address _spender, uint _subtractedValue) public whenReleased returns (bool success) {
        return super.decreaseApproval(_spender, _subtractedValue);
    }

    /**
     * @dev Burns a specified amount of tokens.
     * Overrides the burn() function with modifier that prevents the ability to burn tokens
     * by holders excluding the sale agent.
     * @param _value {uint256} the amount of token to be burned.
     */
    function burn(uint256 _value) public onlySaleAgent {
        super.burn(_value);
    }

    /**
     * @dev Burns a specified amount of tokens from specified address.
     * @param _from {address} the address to burn from.
     * @param _value {uint256} the amount of token to be burned.
     */
    function burnFrom(address _from, uint256 _value) public onlySaleAgent {
        require(_value > 0);
        require(_value <= balances[_from]);
        balances[_from] = balances[_from].sub(_value);
        totalSupply = totalSupply.sub(_value);
        Burn(_from, _value);
    }
}
