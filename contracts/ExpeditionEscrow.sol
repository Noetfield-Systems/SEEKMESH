// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title SEEKMESH ExpeditionEscrow (reference implementation, not deployed)
 * @notice A fully-funded stablecoin mission with unique proof payouts and refunds.
 * @dev Not audited. Testnet proof comes before any real mainnet funds.
 *      Centralized verifier can approve payouts; eligibility proof governance is offchain.
 */
interface IMissionToken {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract ExpeditionEscrow {
    error BadConfiguration();
    error BadCampaign();
    error Unauthorised();
    error Closed();
    error AlreadyPaid();
    error InsufficientBudget();
    error TransferFailed();
    error Reentrancy();
    error RefundUnavailable();
    error UnsupportedTokenMechanics();

    struct Campaign {
        address sponsor;
        address verifier;
        uint64 deadline;
        uint16 feeBps;
        uint256 rewardBudget;
        uint256 spent;
        uint256 feeReserve;
        uint256 feePaid;
        bool refunded;
    }

    IMissionToken public immutable token;
    address public immutable feeTreasury;
    uint256 public nextId = 1;
    uint256 private entered = 1;
    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => mapping(bytes32 => bool)) public usedProof;

    event CampaignFunded(uint256 indexed id,address indexed sponsor,address verifier,uint256 rewardBudget,uint256 totalDeposited,uint64 deadline,uint16 feeBps);
    event MissionRewardPaid(uint256 indexed id,bytes32 indexed evidenceHash,address indexed recipient,uint256 amount,uint256 fee);
    event UnspentFundsReturned(uint256 indexed id,address indexed sponsor,uint256 refundedAmount);

    modifier nonReentrant() {
        if (entered != 1) revert Reentrancy();
        entered = 2;
        _;
        entered = 1;
    }

    constructor(IMissionToken stablecoin,address treasury) {
        if (address(stablecoin)==address(0) || treasury==address(0)) revert BadConfiguration();
        token = stablecoin;
        feeTreasury = treasury;
    }

    function fund(uint256 amount,uint16 feeBps,uint64 deadline,address verifier) external nonReentrant returns (uint256 id) {
        if (amount==0 || verifier==address(0) || feeBps>500 ||
            deadline<=block.timestamp+1 hours || deadline>block.timestamp+90 days) revert BadConfiguration();
        uint256 feeReserve = amount * uint256(feeBps) / 10000;
        uint256 total = amount+feeReserve;
        uint256 beforeBalance=token.balanceOf(address(this));
        _safeTransferFrom(msg.sender,address(this),total);
        if(token.balanceOf(address(this))!=beforeBalance+total) revert UnsupportedTokenMechanics();
        id=nextId++;
        campaigns[id]=Campaign({
            sponsor:msg.sender,verifier:verifier,deadline:deadline,feeBps:feeBps,
            rewardBudget:amount,spent:0,feeReserve:feeReserve,feePaid:0,refunded:false
        });
        emit CampaignFunded(id,msg.sender,verifier,amount,total,deadline,feeBps);
    }

    /**
     * @notice A verifier awards only documented, approved proof work.
     * @dev evidenceHash MUST identify one verified task completion with a
     *      sponsor-visible offchain receipt. The contract cannot judge quality.
     */
    function pay(uint256 id,bytes32 evidenceHash,address recipient,uint256 amount) external nonReentrant {
        Campaign storage c=campaigns[id];
        if(c.sponsor==address(0))revert BadCampaign();
        if(msg.sender!=c.verifier)revert Unauthorised();
        if(c.refunded || block.timestamp>=c.deadline)revert Closed();
        if(evidenceHash==bytes32(0) || recipient==address(0) || amount==0)revert BadConfiguration();
        if(usedProof[id][evidenceHash])revert AlreadyPaid();
        if(amount>c.rewardBudget-c.spent)revert InsufficientBudget();
        uint256 fee=amount*uint256(c.feeBps)/10000;
        if(fee>c.feeReserve-c.feePaid)revert InsufficientBudget();
        usedProof[id][evidenceHash]=true;
        c.spent+=amount;c.feePaid+=fee;
        _safeTransfer(recipient,amount);
        if(fee>0)_safeTransfer(feeTreasury,fee);
        emit MissionRewardPaid(id,evidenceHash,recipient,amount,fee);
    }

    /**
     * @notice After the deadline sponsor recovers all unallocated rewards
     *         AND the fee reserve that was not earned by the protocol.
     */
    function refund(uint256 id) external nonReentrant returns(uint256 amount) {
        Campaign storage c=campaigns[id];
        if(c.sponsor==address(0))revert BadCampaign();
        if(msg.sender!=c.sponsor)revert Unauthorised();
        if(c.refunded || block.timestamp<c.deadline)revert RefundUnavailable();
        c.refunded=true;
        amount=c.rewardBudget-c.spent+c.feeReserve-c.feePaid;
        if(amount>0)_safeTransfer(c.sponsor,amount);
        emit UnspentFundsReturned(id,c.sponsor,amount);
    }

    function remaining(uint256 id) external view returns(uint256 reward, uint256 feeReserveAvailable) {
        Campaign memory c=campaigns[id];
        if(c.sponsor==address(0))revert BadCampaign();
        return(c.rewardBudget-c.spent,c.feeReserve-c.feePaid);
    }

    function _safeTransfer(address to,uint256 amount) private {
        (bool ok,bytes memory r)=address(token).call(abi.encodeWithSelector(IMissionToken.transfer.selector,to,amount));
        if(!ok || (r.length!=0 && (r.length!=32 || !abi.decode(r,(bool)))))revert TransferFailed();
    }
    function _safeTransferFrom(address from,address to,uint256 amount) private {
        (bool ok,bytes memory r)=address(token).call(abi.encodeWithSelector(IMissionToken.transferFrom.selector,from,to,amount));
        if(!ok || (r.length!=0 && (r.length!=32 || !abi.decode(r,(bool)))))revert TransferFailed();
    }
}
