# SEEKMESH — Native Mission Escrow Reference Implementation
**Status: Source and automated contract tests only; NOT deployed; NOT audited.** No mainnet contract, funded campaign, paid reward or escrow wallet has been verified.

- Solidity source: [contracts/ExpeditionEscrow.sol](../contracts/ExpeditionEscrow.sol)
- Foundry tests: [test/ExpeditionEscrow.t.sol](../test/ExpeditionEscrow.t.sol)
- CI: [.github/workflows/onchain-escrow.yml](../.github/workflows/onchain-escrow.yml)
- No fiat/Stripe dependency: only an approved ERC-20 stablecoin address and a disclosed fee treasury at deployment.
- Testnet candidate: Base Sepolia chain ID **84532**. Circle test USDC address is `0x036CbD53842c5426634e7929541eC2318f3dCF7e` (official Circle source: https://github.com/circlefin/cctp-go/blob/main/chains.go). The mainnet chain remains undecided.

## Economics and invariants
A sponsor funds 100% of an agreed reward pool + capped protocol fee reserve (max 5%). Sponsor sets mission verifier and deadline of 1 hour to 90 days. Only verifier may pay a verified evidence hash. Each proof can be paid ONCE, and aggregate payouts cannot exceed the budget. Fees accrue only as payouts occur; expired campaign unused rewards and unused fees return to sponsor. Contract is non-reentrant and rejects fee-on-transfer tokens at funding.

IMPORTANT: The contract cannot itself verify whether offchain source discovery was actually useful or whether a verifier is honest. Verifier key custody, proof policy, disputes and visibility to sponsors must be addressed before funding any real campaign.

## Run
Install Foundry and execute `forge test -vv`. All tests use an in-memory mock USDC (6 decimals), not real funds. This release does not execute a broadcast, deploy contracts, move stablecoins, create a token, or advertise rewards.

## Deployment readiness steps (specific, not artificial gates)
1. Confirm actual separately controlled SEEKMESH treasury/verification signer and testnet RPC. Never use unrelated venture wallet or company identity.
2. Independently review contract behavior, verifier authority and refunds; reproduce Foundry tests with selected supported stablecoin.
3. Publish funded mission policy and budget. Deploy on Base Sepolia with publicly checked bytecode and verify an E2E funded testnet escrow, approval, payout and refund.
4. Public mainnet campaign only after a genuine sponsor deposits funds into the disclosed contract and the project verifies a real payout tx hash.
5. Integrate settlement receipts with Realm OS's `settled_campaigns` metric only from independently verified chain transactions. Current metric stays **0**.
