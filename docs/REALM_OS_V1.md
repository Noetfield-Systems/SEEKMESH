# SEEKMESH Realm OS v1 — Autonomous Discovery, Community, Growth and Web3 Launch
**As-built operating manual · November 15, 2026 · Independent Web3 initiative**

## What was actually built
A native **embedded operating system** inside SEEKMESH, not a fork of Noetfield OS and not a separately deployed SaaS.
- Backend: realm-os/engine.js with persistent tables in the existing Railway SQLite /data volume.
- App UI: /os via original premium fantasy Realm navigation, showing real objectives, six phase gates, newly inspected discovery signals, weekly source expeditions and registered roles.
- Founder: /operator remains the authenticated console; now supports OS pause/resume/pulse, setting measured numeric goals and recording an operator-attested work-packet outcome.
- APIs: GET /api/os/status, GET /api/os/expeditions, GET /api/admin/os (ADMIN_KEY), POST /api/admin/os/control (ADMIN_KEY), POST /api/internal/os/tick (AUTONOMY_CRON_KEY).
- Runtime: one persistent internal timer on the deployed service; default 300 seconds (REALM_OS_TICK_MS), start immediately on process startup. Existing autonomy worker pool and scheduler are reused. No extra running servers or agents are inferred from the ten capability roles.
- Persistence: realm_os_state, realm_os_agents, realm_os_goals, realm_os_packets, realm_os_receipts, realm_os_expeditions. SQL migration uses CREATE TABLE IF NOT EXISTS and does not discard user accounts or graph data.

## Real agent cells (logical role registry)
Discovery Scout (coverage and freshness), Evidence Keeper (review receipts), Guild Steward (community quality), Quest Architect (source-linked expeditions), Growth Navigator (activation and source use), Marketplace Operator (opt-in native Web3 partnerships), Chain Sentinel (settlement readiness and truth), Release Sentinel (runtime failures), Worker Optimizer (bounded network/inference costs), Realm Governor (goal priority and provenance).
**Do not call these ten independent LLM runtimes**: they are ten specialized capability slots coordinating current deterministic workloads and queues. Existing autonomy engine has 20 separate discovery role definitions, also primarily logical.

## What the OS really does every 5 minutes
1. Reads measured source/member/guild/audit/funding-inquiry activity from current database tables; no invented traffic.
2. Computes current progress against persisted goal targets and six phase gates.
3. Publishes or maintains one weekly source-discovery expedition targeting a category with limited coverage, bounded to three accepted contributions for a useful first goal.
4. Opens non-duplicated work packets for accepted-source reviews, failed crawling jobs, community moderation, partner inquiry qualification, discovery activation and missing stablecoin/x402 capabilities.
5. Emits immutable-ish append-only operational receipts with explicit verification method (measured database row, scheduled task or human-attested note).
6. Reuses the autonomy scheduler's ongoing crawler/inspection/quality checks and counters, without circumventing robots.txt or daily request caps.
7. Exposes safely labelled inspected candidates as **unverified scout signals**; those are never silently merged into the verified graph, given endorsement, or offered crypto rewards.

Every 5-minute pulse is **not** ten expensive LLM calls. Every work packet is not automatically executed code. The first internally executed job is expedition creation; discovery/crawling is already performed by the existing autonomy pool. The rest are persisted owner-scoped tasks with concrete acceptance criteria rather than status theater.

## How phase gates work
- Phase 0 / Genesis: Realm and OS configured and running (software status only).
- Phase 1 / Discovery: accepted community sources target 15; healthy source audits target 30.
- Phase 2 / Community: 3 real guilds, 20 persisted memberships, 15 real visible guild messages.
- Phase 3 / Distribution: 50 accounts, 100 recorded source clicks per 7 days, 3 real partner inquiries (all counted distinctly; no unique-user inference).
- Phase 4 / Crypto commerce: 1 independently verified settled funded campaign and 1 verified x402 settlement. **The currently recorded value is zero; the contracts, wallet and payment verifier are not yet live.**
- Phase 5 / Scale: 100 approved community sources; measurable data/freshness/retention work needed beyond these first targets.

The public UI shows actual progress computed at request time and the currently selected weekly expedition. Operators can tune numeric targets through /operator without falsifying actuals.

## Interaction and operational guarantees
- Member contribution XP and MESH Credits still credit through the existing approved-submission ledger; there is no parallel currency ledger inside Realm OS.
- Expedition count is an observed subset of approved submissions in the selected category during its 7-day period, not a separate user mint.
- Worker numbers shown include actual connected edge workers in the last 24 hours and current physical discovery executors, not the number of logical sharding templates.
- Full crypto-native settlement needs explicit testnet/mainnet contracts, supported USDC asset, address and onchain tx proofs. The operating system does not claim earnings on an unissued SEEK token.
- Realm OS founder actions are authenticated with the existing ADMIN_KEY. Secret not stored in localStorage. An operator evidence note is labelled **operator_attested_not_independently_verified**, not cryptographic proof.
- Pause/resume Realm OS does not pause critical public browsing, user access or community records. The separately controlled autonomy crawler has its existing controls.

## Launch target playbook
**Now:** Discovery Realm remains publicly accessible; wallet sign-in, source search, guilds and free accepted-source quests are not tied to token issuance.
**First 7 days:** 10 real verified source contributions, 3 guilds, 20 qualified explorers; measure search→click and approved contribution quality.
**First native transaction:** sponsor-funded USDC expedition on a selected EVM chain, test escrow/payout/replay/refund, then a live small actual funded campaign with a disclosed contract and transaction receipt.
**First agent sale:** x402 metered source/provenance endpoint that returns data only after facilitator-verified settlement. Zero prices and test simulations cannot be described as revenue.
**Scale:** stable quality/freshness, 7-day retention, repeat paying project teams and positive contribution margin. Consider SEEK only when economic utility is proven.

## Operator acceptance checks
1. GET /api/os/status returns 10 logical roles, 6 phase states, real metrics and no issued-token claims.
2. POST /api/admin/os/control rejects unauthenticated actions; authenticated pulse creates exactly one weekly expedition idempotently.
3. GET /api/os/expeditions reflects accepted database records, not views/clicks.
4. Authenticated founder changes a goal target; resulting percentage is computed against actual measurements.
5. Work packet can only be operator-attested with 30+ characters of evidence; it is NOT labelled externally verified.
6. Wallet-first SIWE EOA verification uses one-time domain/chain-bound signature and emits a real session token; wrong domain/chain/nonce/expiry fail.
7. npm test, GitHub Actions, Railway /api/health and actual public /os routes all succeed on the same commit.
