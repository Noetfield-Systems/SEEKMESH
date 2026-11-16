// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../contracts/ExpeditionEscrow.sol";
interface Vm {
 function prank(address) external;
 function startPrank(address) external;
 function stopPrank() external;
 function warp(uint256) external;
}
contract MockUSDC is IMissionToken {
 string public constant name="MockUSDC";
 uint8 public constant decimals=6;
 mapping(address=>uint256) public override balanceOf;
 mapping(address=>mapping(address=>uint256)) public allowance;
 function mint(address to,uint256 amount) external {balanceOf[to]+=amount;}
 function approve(address spender,uint256 amount) external returns(bool){allowance[msg.sender][spender]=amount;return true;}
 function transfer(address to,uint256 amount) external returns(bool){
  require(balanceOf[msg.sender]>=amount,"balance");balanceOf[msg.sender]-=amount;balanceOf[to]+=amount;return true;
 }
 function transferFrom(address from,address to,uint256 amount) external returns(bool){
  require(allowance[from][msg.sender]>=amount,"allowance");
  require(balanceOf[from]>=amount,"balance");
  allowance[from][msg.sender]-=amount;balanceOf[from]-=amount;balanceOf[to]+=amount;return true;
 }
}
contract ExpeditionEscrowTest {
 Vm private constant vm=Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
 address sponsor=address(0xA100);
 address verifier=address(0xB100);
 address explorer=address(0xC100);
 address treasury=address(0xD100);
 address attacker=address(0xE100);
 MockUSDC usdc;
 ExpeditionEscrow escrow;
 uint64 deadline;

 function setUp() public{
  usdc=new MockUSDC();
  escrow=new ExpeditionEscrow(IMissionToken(address(usdc)),treasury);
  deadline=uint64(block.timestamp+8 days);
  usdc.mint(sponsor,5_000_000_000);
  vm.prank(sponsor);usdc.approve(address(escrow),type(uint256).max);
 }
 function _fund() internal returns(uint256 id){
  vm.prank(sponsor);id=escrow.fund(1_000_000,250,deadline,verifier);
 }
 function testFundPayUniqueAndRefundAllUnspent() public {
  uint256 id=_fund();
  require(usdc.balanceOf(address(escrow))==1_025_000,"not fully funded");
  vm.prank(verifier);escrow.pay(id,keccak256("source-proof-1"),explorer,400_000);
  require(usdc.balanceOf(explorer)==400_000,"wrong paid amount");
  require(usdc.balanceOf(treasury)==10_000,"fee only on settled payout");
  (uint256 remainingBudget,uint256 remainingFee)=escrow.remaining(id);
  require(remainingBudget==600_000 && remainingFee==15_000,"bad remaining");
  uint256 before=usdc.balanceOf(sponsor);
  vm.warp(deadline);
  vm.prank(sponsor);uint256 refunded=escrow.refund(id);
  require(refunded==615_000 && usdc.balanceOf(sponsor)==before+615_000,"unused pool and fee reserve returned");
  require(usdc.balanceOf(address(escrow))==0,"contract holds no owed balance");
  require(_refundAgainReverts(id),"cannot refund twice");
 }
 function _refundAgainReverts(uint256 id) internal returns(bool){
  vm.prank(sponsor);
  try escrow.refund(id){return false;}catch{return true;}
 }
 function testOneEvidenceCannotPayTwice() public{
  uint256 id=_fund();
  bytes32 evidence=keccak256("same-proof");
  vm.prank(verifier);escrow.pay(id,evidence,explorer,300_000);
  vm.prank(verifier);
  try escrow.pay(id,evidence,explorer,300_000){revert("duplicate payout");}catch{}
  require(usdc.balanceOf(explorer)==300_000,"double payment");
  require(escrow.usedProof(id,evidence),"missing used proof");
 }
 function testUnauthorizedVerifierAndOverBudget() public{
  uint256 id=_fund();
  vm.prank(attacker);
  try escrow.pay(id,keccak256("attack"),explorer,100_000){revert("unauthorized");}catch{}
  vm.prank(verifier);
  try escrow.pay(id,keccak256("over"),explorer,1_000_001){revert("over budget");}catch{}
  require(usdc.balanceOf(explorer)==0,"unauthorized payout");
 }
 function testSponsorCannotRugActiveCampaign() public{
  uint256 id=_fund();
  vm.prank(sponsor);
  try escrow.refund(id){revert("premature refund");}catch{}
  require(usdc.balanceOf(address(escrow))==1_025_000,"escrow drained");
  vm.warp(deadline);
  vm.prank(verifier);
  try escrow.pay(id,keccak256("late"),explorer,200_000){revert("late payout");}catch{}
  require(usdc.balanceOf(explorer)==0,"payout after deadline");
 }
 function testFeeLimitAndNoFakeFunding() public{
  vm.prank(sponsor);
  try escrow.fund(1_000_000,501,deadline,verifier){revert("fee cap bypass");}catch{}
  vm.prank(attacker);
  try escrow.fund(1_000_000,250,deadline,verifier){revert("unfunded campaign");}catch{}
  require(escrow.nextId()==1,"campaign created without funding");
 }
 function testMultipleProofsFeesAndFullRewardUtilization() public{
  uint256 id=_fund();
  vm.prank(verifier);escrow.pay(id,keccak256("a"),explorer,500_000);
  vm.prank(verifier);escrow.pay(id,keccak256("b"),explorer,500_000);
  require(usdc.balanceOf(explorer)==1_000_000,"payout mismatch");
  require(usdc.balanceOf(treasury)==25_000,"fee mismatch");
  require(usdc.balanceOf(address(escrow))==0,"funds should be fully disbursed");
  vm.warp(deadline);vm.prank(sponsor);
  require(escrow.refund(id)==0,"nothing to refund");
 }
}
