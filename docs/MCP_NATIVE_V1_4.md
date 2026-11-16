# SEEKMESH Native Agent-Commerce Launch — MCP v1.4.1
**Source:** `server.json`, `integrations/mcp-server.js`, `native/x402.js`, `atlas/engine.js`.
**Verified code launch:** GitHub CI and Railway. **Unverified commercial launch:** No independent receiving wallet, facilitator-confirmed payment, funded sponsor, onchain Escrow deployment or SEEK issuance.

## Machine discovery
- Public endpoint: `POST https://seekmesh-web-production.up.railway.app/mcp`
- Modern stateless transport version: `2026-07-28`. Every request must use `MCP-Protocol-Version`, `Mcp-Method`, `Accept: application/json, text/event-stream` and corresponding `params._meta` fields; named tool calls also carry `Mcp-Name`.
- Free read-only tools: `search_sources`, `search_agent_atlas`, `get_live_expeditions`, `get_guilds`, `get_source_proof_quote`, `get_native_market_status`.
- Official registry name: `io.github.Noetfield-Systems/seekmesh`, remote transport HTTPS. Published by GitHub OIDC without PAT. [Current registry readback](https://registry.modelcontextprotocol.io/v0.1/servers?search=seekmesh&version=latest).
- Production-safe nonidentifying tool invocation metrics: `GET /api/mcp/stats`. These are calls, not unique Agent users, customers or paid orders.
- Original web experience, Guilds, wallet EIP-4361 and missions remain available in parallel.

## Evidence-based Agent Trust Atlas
- The OS synchronizes public registry metadata from `https://registry.modelcontextprotocol.io/v0.1/servers?limit=50&version=latest`.
- Self-registered ERC-8004 and x402 entries are marked self-reported. The onchain `ownerOf` check is a separate higher-quality ownership observation, not an agent-security audit.
- New bounded auto-probe checks at most five real MCP endpoints daily using the existing public-IP-only, robots-aware safe-fetch with timeout and byte budgets. An HTTP response/latency record is not an MCP capability test or a security assessment. Disabled with `ATLAS_AUTO_PROBE=false`.

## Native x402 — live collection conditions
- Price: **0.05 USDC per paid proof report on Base Mainnet (eip155:8453)**.
- Before quoting, the configured facilitator must advertise `x402Version:2`, `scheme:exact`, `network:eip155:8453` from its HTTPS `/supported` response. The x402.org default testnet facilitator is **not** supported for this mainnet flow.
- Configure independently controlled `SEEKMESH_USDC_RECEIVER` and a compatible `X402_FACILITATOR_URL`. Base RPC uses `BASE_RPC_URL` or public Base RPC. The quoted recipient/asset/amount and resource URL must match the buyer's signed authorization.
- Facilitator `/verify` and `/settle` are invoked using x402 v2 envelopes. A successful facilitator response alone never grants access: a confirmed Base receipt with a unique USDC `Transfer` from authorized payer to configured merchant, exactly 50,000 USDC base units, is required.
- Pending settlement hashes survive retries, so delayed finality can be reconciled without attempting another charge. Only persisted successful transfers count toward verified paid receipts.
- With no receiving wallet, the premium endpoint returns HTTP **503**. With a receiver and an incompatible facilitator, it also returns HTTP **503**. An unsigned authorized-ready request returns HTTP **402**; no fake report is delivered.

## First real monetization
1. Publish a dedicated independent SEEKMESH receiving address through the existing secured service controls.
2. Verify production facilitator network compatibility using `GET /api/native/x402/status`; perform a genuine wallet-paid `GET /api/proof/premium?id=<source_id>`.
3. Independently match the paid API response to a real Base chain receipt and count it exactly once in `/api/mcp/stats` and `/api/native/x402/status`.
4. Run Base Sepolia escrow deployment from `.github/workflows/deploy-base-sepolia.yml` only with a dedicated test ETH-funded signer, treasury and RPC. Then prove one actual funded MissionRewardPaid receipt; no testnet token is commercial revenue.
5. Recruit a real partner via verified Galxe migration/Guild and repeat on mainnet with genuine sponsor funds. No Stripe, unrelated venture billing or imagined capital events.

**Evidence rule:** Only independently verified work is called complete. Source code, registry publication and successful CI do not equal sponsor funding, customer payment or acquired users.
