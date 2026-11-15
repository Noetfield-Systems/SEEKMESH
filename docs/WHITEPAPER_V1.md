# SEEKMESH — The Web3 Discovery Realm
## Protocol Whitepaper v1.0 · Strategic / pre-token · 2026-11-15

**Status:** Strategic protocol specification, NOT an announcement of a minted token, launched staking system, live funded reward campaign, or operating decentralized protocol. **Owner / product identity:** SEEKMESH is an independent Web3 initiative. Its GitHub repository's current organizational namespace is only technical repository custody; it is not authority to present SEEKMESH as a Noetfield product or use Noetfield billing.

**Canonical machine specification:** spec/seekmesh.ssot.json. **Status of features:** docs/IMPLEMENTATION_LEDGER_V1.md. **Narrative:** docs/WORLD_BIBLE_V1.md. **Engineering:** docs/PROTOCOL_BLUEPRINT_V1.md.

### Abstract
The future internet is generated, linked, served, maintained and used by people and autonomous agents. Publishing becomes cheaper; verification, source provenance, relevance and useful discovery become more valuable. SEEKMESH proposes a persistent world that transforms discovery from passive consumption into a community-coordinated economy: source-linked projects appear on a living graph; agents search and reassess sources; humans verify and improve them; guilds organize useful work; wallets hold identity and optionally onchain credentials; projects pay for genuinely useful discovery, campaign fulfillment and agent-readable data; participants receive reputation, first-party utility and, only where separately funded, verifiable onchain payouts.

**The proposition:** Discover the next internet. Prove what's real. Build your place in it.

### 1. Why now — market problem and thesis
- Search interfaces surface pages, not necessarily verified participants, interoperable capabilities or source provenance. Agents produce vast new catalogs but can also fabricate or recycle information.
- Web3 ecosystems scatter listings among chains, games, wallets, quest tools, market rankings, communities and project pages. Centralized algorithms and pay-to-play placement can distort what users find.
- Existing play-to-earn products can attract speculation without creating corresponding non-speculative value. Pure click/engagement incentives invite automation and spam.
- Project teams, open-source maintainers, guild leaders and AI agents need a common, updateable discovery graph with inspectable evidence, contribution attribution and programmable utility.

**Hypothesis, not proven market dominance:** a network that rewards *accepted, source-linked, continuously useful discovery* can create durable information supply and user demand. Verification quality and repeat-use must be measured before claiming network effects.

### 2. The product is a world, not a directory
The floating islands, Sakura discovery tree, original companion explorers, crystalline interfaces and guild halls are a coherent interaction language. Every visible portal should resolve to a real action:
1. **Explore:** search a structured index; follow original links; compare provenance and freshness.
2. **Missions:** perform a source-quality primer, return for meaningful work, submit evidence, verify sources and complete funded tasks.
3. **Guilds:** join/found community groups; publish relevant signals; coordinate category curation and later guild campaigns.
4. **Build:** submit tools, agent services, open-source projects and protocols; publish project profiles; prove ownership when available.
5. **Rewards:** see earned non-transferable XP and MESH Credits; redeem accepted credits for visible in-world utility; separately claim funded rewards once that rail exists.
6. **Market:** discover useful projects and first-party visibility, sponsor clearly labelled quests, obtain discovery API access and eventually pay agents through crypto rails.
7. **Identity:** pseudonymous explorer account linked to a self-custodied wallet; credentials and ownership proofs once supported.

This is a **gamified discovery product**, not a claim that battle gameplay, NFT trading, earnable tokens, exchange functions or yield are live.

### 3. Roles and incentives
**Explorers** search and report meaningful sources, earn information and optional first-party progress. **Builders** publish verifiable projects, gain discovery and collaboration. **Curators** inspect freshness and provenance, are rewarded for quality after acceptance. **Guilds** organize specialized curation and missions. **Projects / protocols** fund measurable verified missions and discovery distribution. **Operators and AI agents** contribute indexing and verification labor subject to quality and budgets. **Users of data / AI agents** consume source-grounded discovery by API.

The correct flywheel is: project inventory → useful discovery → evidence & freshness → trusted ranking → builder reach and agent demand → budgeted mission/data transactions → verified contributors rewarded → richer inventory. Every arrow needs evidence; more members alone is not economic success.

### 4. Source graph / proof-of-discovery
The minimum graph objects are Source, Project, Creator, AgentService, Guild, Claim, Evidence, Revision, Review, Mission, Completion, RewardReceipt and Wallet. A project has canonical URLs and links to claims with timestamps, independent evidence, review state, confidence and expiration. New discoveries are **candidates**, not silently verified facts. Agents may retrieve and propose; authorized review rules decide whether items are published. Public provenance should distinguish self-declared, editorially seeded, community approved and independently corroborated.
A candidate evidence score can weight provenance, freshness, usefulness, relevance and risk, but the weighting and false-positive rates require calibration on real reviewed samples. Never market algorithmic confidence as an independent audit.

### 5. Agent / worker network
SEEKMESH autonomy dispatches work to specialized capabilities: crawler, fetcher, canonicalizer, duplicate detector, category classifier, safety gate, facts/evidence checker, freshness monitor, editor, publisher, QA verifier, growth researcher and analytics operator. Logical shards are scheduling partitions, **not simultaneously running funded agents**. Physical concurrency, domain rate limits, robots.txt, retries and source-change budgets remain enforced. Evidence receipts connect input, policy, tool execution, observation, outcome and published revision.
The first runtime is a centralized orchestrator using persistent SQLite and Railway, with optional distributed workers. Long-term permissionless curation or paid nodes require a verifiable workload and anti-Sybil scheme; token/node rewards must be paid from a controlled finite budget.

### 6. Identity and ownership
The current live account is a pseudonymous handle/password with a durable off-chain record. The current wallet implementation proves control of a particular EVM address with a nonce-bound EIP-191 signature and associates it with an existing account. That is **not the same as standards-compliant ERC-4361 Sign-In With Ethereum**, independent wallet login or a smart-contract wallet session. Protocol roadmap: complete SIWE with domain/URI, chain, issued-at, expiration and nonce; EIP-1271 for smart accounts; opt-in verified project ownership; credential attestation for accepted discoveries. Wallet remains user-custodied; no private key is requested by SEEKMESH.

### 7. Three economically distinct units
**XP:** off-chain, non-transferable contribution record; levels, recognition and access. **MESH Credits:** currently off-chain first-party, non-transferable consumable credits, awarded for accepted activity; redeemed for first-party visibility (20 credits for 7-day display of an approved owned source, six simultaneous slots). **SEEK:** a proposed, unissued protocol utility token. **No exchange rate, cash redemption, claim, guaranteed token airdrop, yield or rights to future token distribution exists.** These units must not share a wallet balance label.

### 8. Future protocol economy, not a speculative cash promise
Web3-native economic mechanisms, subject to independent deployment:
- **Funded mission escrow:** sponsor deposits supported stablecoins into an auditable campaign contract, publishes eligibility and proof rules, and authorizes payouts only against validated completion; unspent balances return according to explicit campaign rules.
- **Discovery API metering:** agents and developers pay small amounts of stablecoin via x402/HTTP 402, or signed onchain-access attestations, to obtain premium provenance and recrawl outputs.
- **Project discovery market:** verified profiles, fixed-scope sponsored expeditions and clearly labelled first-party placements; payment does not purchase a positive review or guarantee ranking.
- **Agent services:** project teams pay for sourced reports, verified integration testing and human-readable research packs, delivered with receipts.
- **Guild missions:** verified category curation with shared budgets and measured quality; rewards apportioned by accepted work, not registration count.

**Platform revenue:** campaign/marketplace facilitation fee, paid API consumption, optional curated expedition fee. **Participant rewards:** real stablecoin rewards only if sponsor funds have settled and obligations can be fulfilled. The marketplace must show fees, payout conditions and refund rules before a wallet transaction.

### 9. Token design — proposal only
Token name: SEEK (working name, uniqueness and trademark clearance pending). Proposed chain: EVM-compatible, with Base as first *evaluation candidate* due to low transaction costs and existing stablecoin/x402 infrastructure. Neither mainnet, canonical chain, address nor token ticker is ratified. Proposed hard cap: 1,000,000,000 SEEK; **design assumption, not deployment commitment.**

Illustrative allocation: 40% community and quality contribution, 20% ecosystem/developer incentives, 15% team with vesting, 10% treasury, 10% integrations and partnerships, 5% liquidity/reserve. Token launch requires explicit contract implementation, independent audits appropriate to scope, admin/mint rights disclosure, onchain treasury and vesting, and demonstrable utility. Emissions must not automatically reward clicks, self-referrals or self-reported bot work. Staking/slashing, DAO powers and financial rights are NOT active.

### 10. Verification and reward budgets
A mission is eligible for actual monetary payout only when funding is recorded and settled; a claim is submitted; evidence validates against mission rules; the completion is idempotently approved; and the payout is executed with an immutable transaction reference. No payout based solely on liking/reposting, clicking, arbitrary inflationary XP, or an unverified external event.
Gross platform inflows minus facilitator fees, verification and compute costs, refunds, payments and rewards determine contribution margin. The objective is a positive contribution margin before scaling monetary incentives.

### 11. Guild economy, progression, and world building
An explorer may join communities, create a guild and share short signals with rate limits and moderation; rankings reflect recorded XP. Expansion candidates: season challenges, category-specific guild hubs, cosmetic identity collectibles, owner-verified builder outposts, proof badges, and real shared missions. Distinct fantasy characters are **guide archetypes**, not borrowed Axie characters, and are not asserted to be NFTs. Any collectible tokenization requires explicit, opt-in mint and asset metadata policy.

### 12. Distribution and GTM
Initial wedge: **AI-agent infrastructure + Web3 builder discovery**, not all of the internet. Acquire real MCP/tool maintainers, open-source agent builders, EVM ecosystem guilds, Web3 researchers and protocol teams. Give meaningful utility to the first 50–100 contributors: validated listing, verified source card, useful community connection, source recrawl and quest history. Each founder cohort must show successful discovery tasks, repeat returns, approved evidence, fresh listings and funded missions before large issuance plans. Use authentic developer/community channels and consensual partner outreach; do not fabricate follower, wallet, revenue or airdrop numbers.

### 13. Trust, transparency and safety
Sources must respect owners' site crawl permissions and practical rate limits. Do not claim a verified project is safe to invest in. Reveal paid placements, synthetic/agent-produced metadata, conflicts of interest, uncertain ownership and rating methodology. Make moderation receipts contestable. Protect user and wallet privacy. Store only needed identity information. Avoid dependence on one social platform's paid engagement API.

### 14. Architecture and decentralization phases
- **Live:** independent branded Web3 Realm UI; source search; manual/evaluated community submissions; pseudonymous accounts; XP/credit ledger; guild membership and posts; linked wallet ownership proof; founder console; autonomous discovery coordinator; revenue intent capture.
- **Next:** standardized SIWE login, project ownership verification, richer evidence/version graph, quality-calibrated rankings, API provenance, search freshness, data portability.
- **Native commerce:** stablecoin treasury + mission escrow, x402 paid API, independently verifiable receipts, settlement/refund flows.
- **Protocol expansion:** public node participation, governance, appropriate onchain credentials and optionally the SEEK utility token.

Migration to decentralization is contingent on credible, objectively measurable decentralization of decision-making, data and settlement. A cloud app with a wallet is not automatically decentralized.

### 15. Outcomes to prove
North Star: **Weekly useful discoveries resulting in a source click, contribution, completed verification, verified match or paid agent/API job** (instrumented, not inflated page views). Supporting measures: weekly unique active humans and wallets (distinguish identifiers), successful search sessions, 7-day retention, approved-source ratio, recrawl freshness, guild contributors, verified task completions, campaign funded/settled volume, fee revenue, gross margin, disputes and refunds.

### 16. What could make this fail
No real supply, weak search, inaccurate listings, empty guilds, inauthentic points farming, high scraping costs, confusing wallet UX, token speculation without utility, underfunded rewards, source disputes, or competitors delivering better discovery in one click. The priority response is to fix task utility and the inventory graph—not to artificially inflate incentives.

### Source notes (checked 2026-11-15)
- Zealy quest rewards / USDC payout structure: https://zealy.io/docs/quest-properties/rewards
- Layer3 quests and credentials: https://app.layer3.xyz/
- Presearch token roles and node incentives: https://docs.presearch.io/presearch-project/tokenomics
- DappRadar games and dapp rankings: https://dappradar.com/rankings/category/gaming
- ERC-4361 (SIWE): https://eips.ethereum.org/EIPS/eip-4361
- x402 protocol: https://www.coinbase.com/developer-platform/discover/launches/x402
- Cloudflare x402 agent tools: https://developers.cloudflare.com/agents/tools/payments/
- Galxe/Gravity November 2026 transition: https://help.galxe.com/en/articles/18361711-galxe-is-integrating-into-gravity-what-you-need-to-know
- Kaito post-to-earn end: https://www.coingecko.com/learn/what-is-kaito-earn-yap-points

This whitepaper describes an evolving digital service and proposed protocol architecture. It is not an offer to sell securities, a claim of guaranteed returns, an audited smart-contract release or a guarantee of token distribution.
