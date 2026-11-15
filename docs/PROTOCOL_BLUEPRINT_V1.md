# SEEKMESH — Protocol & Application Blueprint v1.0
**Technical plan · as-built vs to-build · repository: Noetfield-Systems/SEEKMESH**

## A. Current live boundaries
Runtime: Node.js 22 native HTTP service, persistent SQLite database /data on Railway, autonomous discovery engine, first-party static/interactive Realm assets, GitHub Actions tests. One Railway replica observed. This is a **centralized service with self-custody-adjacent wallet proof**, not a decentralized chain-backed system yet.
The current backend has /api/resources, /api/mesh/*, guild routes, source review/report, operator controls, autonomy status. Wallet ownership is verified server-side through nonce + EIP-191 signatures tied to existing account; do not call this ERC-4361 SIWE login.
Authoritative current feature ledger: docs/IMPLEMENTATION_LEDGER_V1.md.

## B. Logical system domains
**Presentation:** Realm shell, Explore, Missions, Guilds, Build, Rewards, Market, Profile. Use original WebP art plus semantic controls; must remain mobile accessible.
**Graph:** sources, canonical origin, category, alias, project profile, claim, version, content hash, evidence, freshness, owner and independent review.
**Trust:** proof receipt, quality checks, moderation, appeal, review outcome; no paid positive ratings.
**Identity:** pseudonymous account, optional wallet binding, session/auth, builder ownership proof.
**Quest:** campaign, mission, eligibility, proof submission, completion verification, reward allocation, dispute outcome.
**Community:** guilds, memberships, posts, abuse reporting, collaborative category milestones.
**Economy:** XP/credits ledger, spotlight redemption, sponsor escrow and onchain payment receipt (future).
**Autonomy:** scheduler, source registry, crawling and safe-fetch, extraction, AI evaluation and verification, prioritized queues and reproducible receipts.
**Measurement:** aggregate page/feature engagement, source clicks, search relevance, verified actions, paid receipts.

## C. Minimum canonical objects
- Resource: resource_id, origin_url, canonical_url, project_id, tags, category, submitter, last_seen, last_verified, source_class, confidence, state, evidence_hash.
- SourceEvidence: evidence_id, source_id, factual_claim, cited_url, capture_time, content_hash, method, evaluator, expiration, review outcome.
- Project: project_id, linked_resources, verified_owner_wallet, guild_id, risk warnings, source profile.
- Guild: id, slug, founder, members, public signals, reviewed contribution statistics and moderation record.
- Mission: id, type, sponsor wallet (if funded), escrow address (if deployed), eligibility, verification policy, quotas, deadline, per-completion budget.
- Completion: id, member, mission_id, evidence, idempotency key, accepted/rejected state, proof receipt.
- Reward: kind (XP, internal Credit, stablecoin transfer, optional token), funding source, amount, claim state, tx hash or ledger key.
- AgentJob: job_id, tenant/source, task, budget, retry count, lease owner, observation, verifier receipt, final state.
- Payment: chain_id, tx_hash, wallet, amount_base_units, asset_address, mission_id, settlement status and confirmations.
Data migrations should preserve extant SQLite objects and previous onboarding members; no second parallel identity ledger.

## D. The central workflow — true E2E
1. Agent discovers new source through approved feed/search domain.
2. Safe-fetch validates host and robots rules, enforces host delay, retries transient failures, and stores evidence.
3. Source is deduplicated/canonicalized and assigned source class / candidate quality.
4. Human/editor or bounded policy validates; accepted item joins the public graph.
5. Explorer follows URL, optionally submits corrections, and a contributor's verified work is scored.
6. Contributor receives exact-once ledger update. A Guild may add category context.
7. Builder redeems internal Credits for *labelled* placement of an accepted project (already exists).
8. When funded missions are enabled, sponsor sends stablecoins to audited/enforced escrow, verifiable completion causes eligible payout; unspent funds are returned under policy.
9. A machine client may call paid discovery endpoints with x402; verify completed transfer before returning premium payload.
Every paid or published result should carry an attributable receipt: actor, task, asset, policy version, accepted evidence, review, timestamp and optional onchain tx.

## E. Web3-native settlement plan (target design, not shipped)
- Evaluate **Base EVM** as initial stablecoin execution chain. Do not hardcode a chain as final or assert a token address exists.
- Phase 1: standard ERC-4361 SIWE login (domain-bound nonce, issued-at, chain, URI, ERC-1271 contract signatures); preserve optional regular account onboarding.
- Phase 2: USDC mission escrow contract with exact funded balance, sponsor cancellation boundaries, monotonic receipt nonce, deadline, approved verifier, payout amount, fee cap, refunds and dispute handling.
- Phase 3: x402 stablecoin HTTP payment for premium provenance/agent results, with explicit 402 offer, facilitator verification, payment confirmation and replay-safe fulfilled request receipt. Start with a well-supported facilitator/library, rather than minting proprietary money.
- Phase 4: onchain credentials / badges and portable reputation; allow off-chain verification record even if badge mint fails.
- Phase 5: consider SEEK only after enough recurring usage and paid transaction demand; contract scope, supply rights, administrator powers, vesting, fee economics and launch terms published.

## F. Required smart contract invariants
- Stablecoin escrow payout total never exceeds recorded funded balance net of explicit protocol fee.
- One accepted completion generates at most one payout; idempotent claim and tx receipt.
- Sponsor cannot redirect/withdraw funds reserved for eligible accepted completions.
- Verifier cannot mint funds or retroactively change signed proof criteria without versioned consent.
- Emergency pause affects new disbursement operations only under published rules and must not appropriate user funds.
- Configurable fee caps published before deposit. Payout refunds and recourse are explicit.
- Authorization domains and admin signer/upgrade powers disclosed onchain; contract version and relevant events indexed.
Do not expose a "Claim Tokens" button until a real contract and claimable wallet allocation exist.

## G. Autonomous worker architecture
Coordinator → bounded job queue → source/robots/egress gate → fetch/parse → candidate evaluator → claim evidence → independent QA reviewer → commit/publish → SourceRevision receipt.
Roles (logical capability templates): source scout, crawler, structured extractor, project classifier, agent registry detector, evidence verifier, duplicate finder, recrawl scheduler, human review assistant, attack/spam filter, guild-source recommender, curator QA, external API assembler, health monitor and budget optimizer.
Operating model: a handful of physical workers process many logical shards; prioritize cheap deterministic filters first; LLM use only on ambiguous/high-value candidates, with explicit cost caps. Production telemetry must report real worker counts, attempts, freshness and failures.

## H. Surface map / release acceptance
- Home: visually true to founder's world; real season, member status, live stats; no fake "48K users."
- Explore: searchable source index with provenance, last verification and ability to report missing/incorrect links.
- Missions: real policy/ledger-based quests; no instant reward merely for opening card.
- Guilds: real membership/feed/moderation; next, category task packs and funded missions.
- Build: ownership-verifiable project profiles and actual discovery exposure.
- Rewards: separate XP/Credits, sponsor-funded crypto payouts, later optional SEEK.
- Market: project discovery and opt-in paid services; clear native wallet checkout only for delivered products.
- Profile: wallet signature ownership proof and durable contribution/receipt graph.
- Whitepaper: canonical versioned claims with clear deployed/proposed distinction.

## I. Minimum acceptance tests for next release
1. Two wallets independently authenticate via ERC-4361 domain-bound and non-reusable nonce; invalid/expired/wrong-chain signatures fail.
2. A submitted project enters pending state, obtains evidence, is accepted and becomes searchable with provenance.
3. Duplicate/rejected submission cannot mint multiple XP/Credits; approved source spotlight burns exactly 20 Credits and is publicly labelled.
4. Guild creation, membership, posting and moderation persist across process restarts.
5. Five different quest criteria distinguish real proof from self-reported click.
6. Sponsor funds a small mission with USDC on testnet, a signed completion is accepted, contract pays exactly once, refund path works.
7. x402 API returns HTTP 402 to unpaid request and premium payload + receipt after confirmed payment; replay and invalid payments fail.
8. Metrics reconcile accepted entries, source clicks, payouts and onchain receipts; output never fabricates unique users.
9. CI tests pass, browser tests on desktop/mobile pass, Railway production smoke passes on exact commit, and wallet tests pass on selected supported chain.
10. Current production dataset and secrets are preserved by migration/rollout.
