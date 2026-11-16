# SEEKMESH Native Web3 Launch — execution plan

**Independent Web3 initiative; no unrelated financial accounts or Stripe.**

## Implemented
- /migrate: member CSV import from Galxe with exact DNS TXT owner challenge; no inherited claims, balances or personal data.
- /atlas: source-linked MCP registry, ERC-8004 ownerOf via selected RPC and x402 self-declared services; all evidence types disclosed.
- /os: deterministic executor, bounded attempts/budgets, SHA256 output artifacts, existing discovery engine coordination.
- /api/proof/premium?id=1: 0.05 USDC, x402 v2 PAYMENT-REQUIRED/PAYMENT-SIGNATURE, facilitator verify then settle; only a confirmed transaction is recorded. No receiver -> HTTP 503, no fake paid response.
- /api/native/campaigns: real verified funding and payout events from configured escrow.
- Farcaster manifest, owned PNG icons and shareable expedition landing/cast cards; account association must be genuinely signed before claiming Mini App publication.

## Real money milestones
1. Set independent SEEKMESH_USDC_RECEIVER on Railway (Base mainnet EVM wallet). Validate an x402 native payment from a separate payer, review facilitator settlement and a transaction receipt; never substitute a mock.
2. Use manual GitHub Actions workflow **SEEKMESH Base Sepolia escrow deployment** with dedicated GitHub secrets BASE_SEPOLIA_RPC_URL, SEEKMESH_TESTNET_DEPLOYER_KEY (test ETH funded), SEEKMESH_TREASURY_ADDRESS. The workflow runs Foundry, verifies Base Sepolia chain 84532, deploys and checks bytecode.
3. Put deployed SEEKMESH_ESCROW_CONTRACT, SEEKMESH_ESCROW_CHAIN_ID=84532 and BASE_SEPOLIA_RPC_URL on Railway. Sign a sponsor funding transaction using independent testnet wallet and send tx hash to campaign funding receipt endpoint. Exercise payout and refund; display chain proof, not simulated values.
4. After confirming independent treasury and contract review for real funding, repeat with a genuine mainnet sponsor. Confirm actual customer revenue (fees, not escrow principal) before scaling.

## Remaining independent-owner dependencies
The connected SEEKMESH service has no independent USDC receiver, onchain treasury signer or deployment RPC configured; no real sponsor funds, x402 payment receipts, Farcaster signed account association, mainnet deployment or minted SEEK token have been verified. Discovery and guild launches do not depend on those.

## Migration and Guild completion
- `/migrate` supports **Galxe campaign URL only**, with no invented tasks, or URL plus a CSV of title/description/action_url rows.
- The owner can attach an authentic CSV later to an existing draft if no tasks have been imported. Neither operation moves wallets, historical rewards, user information or token claims.
- An import is private until the independent project's DNS TXT challenge succeeds. The verified owner may use **Create / Link Founder Guild**, which links a persisted real Guild and its members to that public imported campaign. Each Guild can share `/guild/:slug` with original first-party social art and a Farcaster Mini App preview; the destination still supports normal browser access.
- The Guild social card shows only real persisted member counts and visible signals; no simulated engagement.
