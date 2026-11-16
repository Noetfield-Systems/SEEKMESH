# SEEKMESH — EIP-4361 Wallet-Native Entry
**Implemented: EOA-only Sign-In With Ethereum** · 2026-11-15

## User flow
The main site's Connect Wallet button can create/sign in to a SEEKMESH explorer identity with a wallet signature when not already authenticated. In the account popup, **Sign in with Ethereum Wallet** is also offered. No email, third-party account, fiat checkout, custodial wallet or onchain transaction is required.

1. The browser obtains an address from an injected EIP-1193 wallet and reads the selected EVM chain ID.
2. POST /api/siwe/challenge receives address + chainId, issues a five-minute server-controlled message using the exact EIP-4361 domain/URI, Version 1, alphanumeric nonce, chain ID, issue timestamp and expiration timestamp.
3. Browser signs a readable EIP-191 encoding of that message with personal_sign.
4. POST /api/siwe/verify verifies the stored message and EOA signature, chain, address, nonce, expiry, domain and one-use consumption.
5. A wallet linked to a member logs that member in. A new signed address gets a pseudonymous account with a cryptographically random unknown password and a verified wallet link; it receives only normal one-time off-chain starting XP/Credits, not tokens.
6. Server issues the same 30-day opaque member session used by existing Realm features. Wallet can sign in again later; replaying a prior message cannot create a second session.
7. Existing password accounts preserve their account and may bind an EVM wallet using the older explicit signed ownership-link flow.

## Explicit limitations
- Only externally owned accounts (EOAs) are supported; **ERC-1271 and ERC-6492 smart-contract wallets are not yet supported**. Reject them honestly.
- It is not an onchain login transaction, a transfer, a token claim, a deposit or an automatic financial service.
- Supported chains for sign-in: Ethereum mainnet, Base, Optimism, Arbitrum, Polygon, Ethereum Sepolia, Base Sepolia. The selected chain authenticates scope; it does NOT imply SEEKMESH operates a token or escrow on those chains.
- Account recovery for randomly generated wallet-only accounts requires re-signing from the same wallet. Losing the private key means losing access; the app should not pretend an unrelated password reset exists.
- Sessions currently persist as opaque bearer tokens in browser storage, as was true before SIWE. Hardening can migrate to secure HttpOnly same-site cookies before handling money.
- Passwordless multi-wallet merging and full hardware/ERC-1271 compatibility need additional carefully scoped identity flows and tests.
- Project ownership is NOT proven merely by linking a wallet; original source verification is separate.

## Security acceptance
- Random 128-bit nonce with stored one-time state and five-minute expiry.
- Server constructs and stores the message; the client cannot replace origin, URI, timestamp, chain or nonce after issuing.
- EIP-55 normalized checksummed wallet address; EOA verifyMessage signature recovery.
- Atomic consumed nonce before creating/reusing member; bounded per-IP rate limits.
- Referral bonus remains dependent on approved original contribution, not creating unlimited wallets.
- No web API for exporting signing secrets, no server-side wallet custody, no signing of arbitrary transaction payloads.

Official standard: https://eips.ethereum.org/EIPS/eip-4361
