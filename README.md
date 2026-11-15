# SEEKMESH — The Discovery Protocol

> The internet was built to be searched. The next internet will be discovered.

A high-quality standalone community discovery MVP for AI-native Web3 resources. Built with dependency-free Node.js 22, SQLite, vanilla HTML/CSS/JS, and an optional source-grounded LLM adapter.

## Start

```bash
npm test
npm start
# http://localhost:3000
```

The app starts with **16 editorial source records** and **zero fabricated founding members or user-generated contributions**. Counts shown on the landing page come directly from the SQLite database. Source descriptions are not asserted to be independently reverified live.

## What works

- Full premium responsive marketing website with interactive index, category filtering and search
- Founding member signup, consent capture, unique invite code and ref link (no referral rewards without identity verification)
- Community source suggestions and queue
- Admin approval/rejection with atomic reputation crediting
- Live counts, read-only public JSON discovery API, OpenAPI 3.1 specification and leaderboard
- Privacy/terms and request queue for export/deletion
- Dockerfile and Railway-ready healthcheck
- automated backend/E2E test suite

## Autonomous discovery network (v0.2)

This build adds a **durable, bounded Autonomy OS** to the original MVP instead of replacing the website. It includes:

- 20 specialist roles across discovery, crawling, quality, scoring, curation, freshness, operations and engineering QA
- 2,048 logical scheduling partitions (NOT 2,048 processes or deployed paid models)
- SQLite persistent mission queue with retries, leases, work receipts and day-by-day egress budget
- Public adapter sources: GitHub repositories search and HN Algolia search
- Respect for `robots.txt`, source/site throttles, bounded metadata fetches, timeouts, forbidden private-network addresses and controlled outbound budgets
- Untrusted candidate evidence -> site verification -> founder-reviewed publication; remote workers cannot publish directly
- Audit history for existing resources without replacing editorial records silently
- Optional Cloudflare Workers Cron discovery worker with claim/report authenticated receipts
- [Founder Operator Console](/operator) to inspect sources/jobs/candidates and pause/resume
- Machine-readable read-only Company OS workpackets and QA/repair proposals
- Honest public telemetry in homepage and `/api/autonomy/status`

**Production is deployed on Railway** at https://seekmesh-web-production.up.railway.app/. 24/7 execution requires the Node service to remain alive (or an external scheduler and worker to trigger it); a free Cloudflare Worker does not create thousands of actively running processes. All agent role definitions and logical shard capacity are configuration, not deployed worker counts. Review [docs/AUTONOMY_OS_OPERATIONS.md](docs/AUTONOMY_OS_OPERATIONS.md).

## What does NOT exist yet

The product is publicly deployed with source-linked search, interest registration and human-reviewed submissions. No active payment rail, onchain token, custodial wallet, verified email, default AI model connection, verified user acquisition figures, completed external agent job wiring, or managed verification authority is claimed.

## Run the founder console

Open `/operator` and enter `ADMIN_KEY` from your hosting environment. The key is used in memory and never saved to localStorage. Keep it private. Use this console to review candidates; automatic source publication is intentionally disabled.

## Environment

Copy `.env.example` values into your own server environment. Node does **not** automatically load `.env`; set environment variables in your shell or hosting provider.

- `PORT`: optional, default 3000.
- `PUBLIC_URL`: required when deployed, controls generated invitation links and sitemap.
- `DATA_DIR`: SQLite volume directory; **must be persistent** in production.
- `ADMIN_KEY`: random private key for all admin endpoints. Admin functions stay disabled when absent.
- `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY`: optional OpenAI-compatible LLM summarization; off by default.

Deployment and API: [docs/LAUNCH_OPERATIONS.md](docs/LAUNCH_OPERATIONS.md)

Full Founder thesis (Persian): [docs/FOUNDER_THESIS_FA.md](docs/FOUNDER_THESIS_FA.md)

Community launch copy: [docs/COMMUNITY_GROWTH_KIT.md](docs/COMMUNITY_GROWTH_KIT.md)

Proposed agent workpackets (not wired): [docs/COMPANY_OS_MISSIONS.json](docs/COMPANY_OS_MISSIONS.json)

## Brand

SEEKMESH is a working brand. No trademark, domain registration, legal entity or token symbol has been confirmed by this package.

## 24/7 deployment prerequisites

For Railway, build with the provided Dockerfile, configure `/api/health` as the healthcheck, attach **one persistent volume** at `/data`, set `DATA_DIR=/data`, `PUBLIC_URL` to the real HTTPS hostname, and configure a strong `ADMIN_KEY`. `AUTONOMY_ENABLED=true` starts the OS scheduler on boot and resumes its durable queue after a process restart. Keep the service always-on (rather than sleep-to-zero) to guarantee a 60-second local tick; a Cloudflare Worker Cron can provide fallback 5-minute pulses but does not replace persistence. Multi-replica SQLite service is not supported.

If you connect a verified repository, deploy the source as-is. Do not publish `data/`, `.env` or any API keys. **Cloudflare Worker integration is optional and not deployed by this package.**

## v0.3 changes

- Eight additional specialist roles (20 total), six public data connector presets with two additional HN/GitHub sources (8 total).
- Operator telemetry distinguishes *logical* worker shards, configured concurrency, and actually connected remote workers in the previous 24 hours.
- Public `/api/graph/summary` and `/api/graph/feed` APIs for approved sources and graph evidence; no fabricated usage numbers.
- Remote workers registered by authenticated lease claim, with observed claims, reports, and failure counts.
- No token issuance, speculative on-chain points, or unverifiable autonomous publishing.

The connected Founder OS may consume the read-only `/api/admin/autonomy/workpackets` feed with a configured credential. Outbound control-plane sync is not activated by default.

## Public founding launch — November 15, 2026

Start: https://seekmesh-web-production.up.railway.app/start | Search: https://seekmesh-web-production.up.railway.app/explore | Join: https://seekmesh-web-production.up.railway.app/?action=join | Submit: https://seekmesh-web-production.up.railway.app/?action=submit | Feedback: https://github.com/Noetfield-Systems/SEEKMESH/issues/2

No token is issued, email verification is not enabled, and logical shards are not running remote workers. See [public launch playbook](docs/PUBLIC_LAUNCH_PLAYBOOK.md).

## v0.5 — Account-driven Web3 discovery economy

Pseudonymous member login with scrypt password hashes and session tokens; ledger-backed XP and MESH Credits (off-chain, non-transferable). Daily check-ins and primer quest credit exactly once; reviewed submissions earn 40 XP and 20 credits, with 15 XP/5 credits for a referring member only when their referral contributes an approved source. Owners of approved listings may redeem 20 credits for a seven-day, clearly labeled community spotlight (max six concurrent). No issued token, USDC payout, implied future entitlement, or confirmed sponsorship transaction. Backend routes are under `/api/mesh/*`. Marketing metrics are sourced from real SQLite records.
