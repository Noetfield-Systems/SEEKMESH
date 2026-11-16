# SEEKMESH v0.6 — Approved Founder Realm Reference

Source of truth: user-supplied 1672×941 SEEKMESH fantasy Web3 realm screenshot (November 15, 2026).

## Full visual reframing
- Original approved fantasy characters and island, waterfall, pink Sakura tree, luminous crystal and artifacts extracted from the founder's own image; packaged as eight optimized first-party WebP files.
- Premium dark royal-blue and sky-blue gradient, warm golden CTAs, violet-magenta highlights, illustrated category tiles and glass-effect explorer panel.
- Flat dark sidebar replaced by horizontal 7-section navigation.
- Full-screen immersive scene + hero copy + Season Zero explorer profile + 6 portal cards + real activity ribbon.
- Responsive 2-column portal grid on small screens; full six-column row on desktop.
- Mobile and desktop browser rendering checked locally with mocked HTTP API fixtures; zero JS errors and zero horizontal overflow at 390px and 1672px.

## Real functionality preserved
- Explore: /api/resources with category and search
- Missions: /api/mesh/checkin, /api/mesh/orientation, /api/mesh/submit with review-gated credits
- Guilds: real Community sources and /api/mesh/leaderboard; guild membership is a future feature
- Build: real pending source submission for review, real member account
- Rewards: live member credits, real /api/mesh/redeem for accepted project spotlight
- Market: earned spotlights from /api/mesh/spotlights and sponsor intake; not a trading exchange
- Wallet: optional read-only eth_requestAccounts from a browser provider, NOT wallet authenticated sign-in
- Profile: real /api/mesh/me user balances, XP, ledger history and qualified referral link
- Operator and autonomous discovery backend left intact
- Existing /manifesto and /start pages preserved

## Integrity and product boundaries
No fabricated explorer count, fictitious token balance, token sale, minting, cash distributions, or trading. The screenshot is art direction, not real user data; live counters are populated by SQLite APIs. Missing token or wallet-auth features are explicitly not portrayed as active. The user-supplied picture is split only as WebP visual assets and never used as a baked interactive UI.

## Deployment
The Railway service retains its existing attached SQLite volume and all production secrets. Only public assets + static asset router + UI and tests change.


## 2026-11-16 — Premium Realm Experience, complete multi-section launch

- Replaced one-screen Hero-and-gates homepage with guided onboarding, seven distinct illustrated chapters, actual Explorer ranking, real Guild previews, actual account state, Season Zero invitations, Agent Atlas/OS explainers and six FAQs.
- Header account dropdown provides real sign-up, sign-in, wallet verification/linking, persisted progress, referrals, rewards, and Sign Out. Connecting a wallet while signed in links it to the existing account; guest EVM login uses SIWE.
- A responsive immersive design system in `public/experience.css` removes the repeated fixed full-page hero background from every chapter and establishes distinct scenic artwork for Explore, Missions, Guilds, Build, Rewards, Market, Atlas and OS.
- Each chapter receives a practical 3-step contextual guide. Agent Atlas explains registry listing versus ERC-8004 ownership versus HTTP observation without conflating them.
- Home numbers are fetched from real `/api/mesh/stats`, `/api/genesis/leaderboard` and `/api/guilds`. All synthetic QA is separate and no fictional token metrics appear.
- `tests/browser-experience.mjs` and `browser-experience.yml` verify scrollable full home, no horizontal overflow at 1440/390px, account menu positioning, walkthrough, major chapter routes, Genesis QA separation, with full-page desktop/mobile screenshots. The browser suite passed on 2026-11-16.
- No SEEK token was issued and no guarantee of future airdrop payments is represented in the new launch UI.
