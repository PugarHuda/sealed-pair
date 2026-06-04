# Sealed Pair — Tatum × Walrus Hackathon Submission

> Sealed peer-to-peer OTC trading on Sui. Negotiate in the dark, settle in the open.

**Live demo:** https://sealed-pair.vercel.app
**GitHub:** https://github.com/PugarHuda/sealed-pair
**Move package (devnet):** `0x73d1acdda1d468d49e340023e7c3cc578466327dfa6109d93c5ce767640c99eb`

---

## 60-second pitch

OTC desks today force a brutal trade-off: post on a DEX and the mempool front-runs your size, or call a desk and trust them with the spread. Both leak information; neither leaves a clean audit trail.

Sealed Pair is a third option. Makers encrypt their terms locally and upload the ciphertext to **Walrus** — the blobId IS the cryptographic commitment. The sealed quote hits a public RFQ board where takers see only the size band. A taker funds a refundable escrow on Sui; that escrow is the proof-of-intent that satisfies a Seal-style access policy. The instant the policy is met, the AES key releases, terms decrypt for both parties, and a single atomic Programmable Transaction Block moves both legs of the trade. The receipt is on-chain forever.

Private quotes. Public settlement. No front-running. No middleman.

---

## Why it wins

We surveyed all 599 Sui Overflow 2025 submissions and the full Walrus showcase. Plenty use one of these primitives. **No one combines commit-reveal + Seal-style selective disclosure + Walrus content-addressed commitment + atomic PTB settle for OTC.** This is the gap we filled.

---

## Tatum integration depth

**10 distinct Sui RPC methods** via the Tatum gateway, all through a server-side proxy with API-key custody:

| Method | What it powers |
|---|---|
| `suix_queryEvents` | Live RFQ board (OrderPosted), Vault (OrderSettled), Activity ticker (5 event types), Maker profile, Order timeline |
| `sui_multiGetObjects` | Zombie filter, Vault enrichment, Reputation aggregation |
| `sui_getObject` | Pre-flight state check, standalone Object explorer |
| `sui_getEvents` | Settle digest verifier (proves tx emitted OrderSettled from THIS package) |
| `sui_getNormalizedMoveModule` | Live deployed-contract panel (functions + emitted events) |
| `sui_getLatestSuiSystemState` | Epoch lookup for seal expiry |
| `suix_getAllBalances` | Wallet portfolio dropdown |
| `suix_queryTransactionBlocks` | Tatum Data API surface — recent activity in portfolio |
| `sui_getChainIdentifier` | Network pill health |
| `sui_getLatestCheckpointSequenceNumber` | Live checkpoint counter |

**4 read-only MCP tools** at `/api/mcp/*` expose this surface to AI agents (Claude Desktop, Cursor, custom orchestrators). Catalog at https://sealed-pair.vercel.app/api/mcp; canonical client config at [`.mcp.json`](./.mcp.json).

**Multi-network gateway support** — devnet/testnet/mainnet auto-switch based on `NEXT_PUBLIC_SUI_NETWORK_FOR_EVENTS`. Vault renders a live "Integration health" card that pings the Tatum gateway in real time and shows the round-trip latency.

---

## Walrus integration depth

**Walrus as cryptographic commitment, not just storage:**

- Maker encrypts terms locally with AES-256-GCM (Web Crypto)
- Ciphertext PUTs to a public Walrus testnet publisher → real `blobId` returns
- The `blobId` becomes the on-chain commitment: stored in the Sui Order object via `create_offer`
- Taker can later fetch the blob, derive the key (Seal policy in V2; sessionStorage in V1 demo), and verify the decrypted hash matches what was committed

**Multi-publisher / multi-aggregator failover** — 3 publishers + 3 aggregators per network (`lib/walrus.ts`). The Integration health panel pings all of them every 30s.

**Counter-offer flow** — when a taker proposes alternate terms, the counter is encrypted as its own Walrus blob with the same content-addressed commitment property as the parent order.

**Walrus blob inspector** — paste any blobId, see the real bytes (Content-Type, first 32 / last 16 bytes hex, fetch latency, served-by aggregator).

---

## Move package — sealed_pair::order (devnet)

```move
public fun create_offer(blob_id, policy_id, give_kind, get_kind, escrow_required, expiry_epoch)
public fun lock_with_escrow(order, escrow: Coin<SUI>, clock: &Clock, ctx)
public fun mark_revealed(order, ctx)
public fun settle(order, ctx)
public fun cancel_open(order, ctx)
public fun cancel_expired(order, ctx)
public fun seal_approve(order, requester: address): bool  // Seal access policy
```

5-state lifecycle: OPEN → LOCKED → REVEALED → SETTLED, with CANCELLED branch. All 5 PTBs wired live; `seal_approve` deployed and verifiable via the live contract introspection panel.

Move unit tests pass (`move/tests/order_tests.move`).

---

## Trader-grade feature set

38 features beyond the core 5-step flow. Highlights:

**Discovery**: Mine filter, pair-depth panel, live activity ticker (5 event types), bronze/silver/gold reputation tiers, expiry countdown.

**Negotiation**: Counter-offer flow (encrypted to separate Walrus blob), private/targeted orders, shareable deep-links.

**Settlement integrity**: Atomic lock+reveal PTB (eliminates cross-fullnode race), pre-flight state + balance checks, zombie filter, `cancel_expired` reaper.

**Audit surface**: Live contract introspection, integration health panel, Walrus blob inspector, settle digest verifier, Sui object explorer, JSON receipt + CSV export, order lifetime timeline, maker profile, wallet portfolio with Tatum Data API recent activity.

**AI integration**: 4 read-only MCP tools (`list_open_orders`, `wallet_history`, `verify_settle_digest`, `maker_stats`) with full input schemas; `.mcp.json` ships for Claude Desktop / Cursor.

**Polish**: Keyboard shortcuts (`/`, `r`, `Esc`), browser-history-aware in-app nav, watchlist with browser notifications, network-mismatch banner, faucet helper, sponsor stack footer.

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 14 App Router · React 18 · TypeScript strict · Vercel Fluid Compute |
| Wallet | `@mysten/dapp-kit` v1.0.6 (Slush, Suiet, autoConnect) |
| Sui RPC | **Tatum Sui gateway** with x-api-key custody, server-side proxy |
| Storage | **Walrus** testnet — 3-publisher / 3-aggregator failover |
| Encryption | AES-256-GCM via Web Crypto; `@mysten/seal` v1.1 scaffolded |
| Smart contracts | Move 2024.beta — `sealed_pair::order` deployed to Sui devnet |
| AI surface | MCP-compatible HTTP tools at `/api/mcp/*`, `.mcp.json` config |

---

## Submission checklist

- [x] GitHub repo public — https://github.com/PugarHuda/sealed-pair
- [x] Live demo URL — https://sealed-pair.vercel.app
- [x] Move package deployed (devnet)
- [x] All 5 PTBs hit real `signAndExecute` + `waitForTransaction`
- [x] Walrus integration is real (blobId on-chain, ciphertext on aggregator)
- [x] Tatum RPC integration is real (10 methods, multi-network)
- [x] MCP integration shipped (4 tools, catalog, client config)
- [x] README synced with feature surface
- [x] VIDEO_SCRIPT.md ready for recording
- [ ] Demo video recorded (2-3 min, 1080p)
- [ ] Bonus: tweet thread tagging @Tatum_io @WalrusFoundation @SuiNetwork

---

## Anti-mock disclosure

Three pieces are scaffold-only and clearly labelled in code + UI:

1. **Sui Seal threshold release** — `lib/seal.ts` documents the wiring path; the policy IS deployed on-chain (`seal_approve`), but the AES key release uses sessionStorage instead of the real Mysten key-server quorum. V2 swap is one-line at each call site.
2. **Counter-offer index** — counter blobs are real Walrus uploads, but the discovery index lives in localStorage per device. V2 moves the index to a Move `Table<orderId, blob[]>` so cross-device counters work.
3. **Private order enforcement** — targetTaker is enforced client-side (Board hides cards, Deal Room blocks Fund). V2 moves the allowlist into the Order struct so `lock_with_escrow` itself reverts on a non-matching wallet.

Everything else — encryption, Walrus blobs, all 5 PTBs, all event reads, all aggregations, every probe on the Integration Health panel — hits real chain or real Walrus infrastructure.

---

## Team

@PugarHuda — solo build · 14 days.

---

*Built for the Tatum × Walrus hackathon (Build on Sui), May 23 – June 6, 2026.*
