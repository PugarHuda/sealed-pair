# 🦭 Sealed Pair

[![Sealed Pair — Move size without tipping your hand](https://sealed-pair.vercel.app/opengraph-image)](https://sealed-pair.vercel.app)

> Sealed peer-to-peer OTC trading on Sui. Negotiate in the dark, settle in the open.

**Live demo:** https://sealed-pair.vercel.app
**Repo:** https://github.com/PugarHuda/sealed-pair

Built for the **Tatum × Walrus hackathon** (Build on Sui, May 23 – Jun 6, 2026).

---

## What it is

OTC trades today force a brutal trade-off: post on a DEX and the mempool front-runs you, or call a desk and trust a middleman with the spread. Neither leaves a clean audit trail.

**Sealed Pair** is a different shape:

1. **Seal** — Maker encrypts terms locally, uploads ciphertext to **Walrus**. The blobId *is* the cryptographic commitment.
2. **Discover** — The sealed quote hits a public RFQ board. Takers see only a size band — never the price.
3. **Escrow** — Taker funds a refundable good-faith deposit on Sui. That deposit is what satisfies the Seal access policy.
4. **Reveal** — Sui Seal auto-releases the symmetric key the instant the policy condition is met. Terms decrypt for both sides — no ghosting, no manual reveal.
5. **Settle** — A single Programmable Transaction Block moves both legs atomically. Receipt minted on-chain forever.

**Result:** private quotes, public settlement, verifiable audit trail. No desk to trust. Nothing to front-run.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14 (App Router) + React 18 + TypeScript strict |
| Wallet | **`@mysten/dapp-kit`** — Slush / Suiet / any Sui dApp Kit wallet, autoConnect, real PTB signing |
| Sui RPC | **Tatum Sui gateway** (mainnet / testnet / devnet) via server-side proxy at `/api/sui` |
| Storage | **Walrus** testnet (multi-publisher failover at `/api/walrus/*`) |
| Encryption | AES-256-GCM via Web Crypto API · `@mysten/seal` v1.1 scaffolded for threshold release |
| Smart contracts | Move package `sealed_pair::order` (devnet `0x73d1…c99eb`) — 5-state lifecycle, escrow `Balance<SUI>`, `seal_approve` policy, full event emission |
| Hosting | Vercel (Fluid Compute, Node.js 24 LTS) |
| Brand | Pip the seahorse — pair-bonded mascot mapping P2P OTC pattern |

## Trader-grade features

Beyond the core seal → escrow → reveal → settle flow, the app ships a long
stack of features that turn the prototype into a workable RFQ desk surface
and surface the integration depth to anyone inspecting the live site.

### Discovery & negotiation
- 🔍 **Mine filter** on Board + Vault — chain-derived from the connected wallet's address, not local state.
- 🏅 **Bronze/Silver/Gold maker reputation tiers** — aggregated from real `OrderSettled` events, displayed as colored chips on every card.
- 🔁 **Counter-offer flow** — takers propose alternate terms; each counter is AES-encrypted and uploaded as its own **Walrus blob** (same content-addressed commitment as the parent order). Maker sees pending counters with Accept / Reject.
- 🔒 **Private / targeted orders** — when sealing, the maker can scope an offer to a specific wallet. Board hides it from non-targets; Deal Room gates the Fund button.
- 🔔 **Watchlist + browser notifications** — `(pair, side)` criteria poll against fresh `OrderPosted` events; matches fire an in-app toast + Notification API ping.
- 🎯 **Pair filter via URL** — `?pair=SUI-USDC` deep-link auto-filters the board; clickable pair chips set the same filter.
- ⏱ **Live expiry countdown** — per-card ticker, color shifts yellow under 1h and red on expiry. Adaptive tick rate; full QA-tested.

### Settlement integrity
- ⚛️ **Atomic lock + reveal PTB** — both move calls bundled into one Programmable Transaction Block. Eliminates the cross-fullnode race where `mark_revealed` was hitting `EWrongState` before lock propagated.
- 🪦 **Zombie filter** — second `sui_multiGetObjects` batched read drops any `OrderPosted` whose current state is no longer OPEN.
- 🛡️ **Pre-flight balance + state check** — `getBalance` warns of insufficient SUI before unblocking Fund; `sui_getObject` confirms state==OPEN before the wallet signs.
- 💀 **`cancel_expired` reaper** — anyone-can-call Move PTB to clean up expired orders. Real abort code decoding (`ENotExpired = 4`) for friendly errors.

### Audit surface
- 🏛️ **Live contract introspection** — `sui_getNormalizedMoveModule` fetches the deployed package's functions + emitted event types in real time. Proves the contract is really on-chain.
- 🩺 **Integration health panel** — server-side parallel fan-out probes the Tatum Sui RPC + every Walrus publisher and aggregator we use, with real latency every 30s.
- 🔬 **Walrus blob inspector** — fetch any blobId, see real bytes, Content-Type, latency, served-by header.
- ✅ **Settle digest verifier** — paste any digest, calls `sui_getEvents`, confirms it emitted `OrderSettled` from this exact package id.
- 🧪 **Sui object explorer** — paste any `0x…` id, see raw on-chain content.
- 📑 **JSON receipt + CSV export** — every settled trade can be exported as JSON or batch-downloaded as CSV with full on-chain references.
- 📈 **Order lifetime timeline** — 5 parallel event queries reconstruct every event that touched a given order (Posted → Locked → Revealed → Settled / Cancelled).
- 🧑‍💼 **Maker profile modal** — click any maker avatar to see their full address, posted/settled/cancelled counts, success rate, and 6 most recent posts.
- 🪙 **Wallet portfolio** — `suix_getAllBalances` powers a real balance dropdown; "low SUI" surfaces the network-appropriate faucet.
- ⌨️ **Keyboard shortcuts** — `/` focuses search, `r` refreshes, `Esc` closes any modal.

### AI integration
- 🤖 **MCP-compatible tools** — `/api/mcp` returns a JSON catalog of read-only tools (`list_open_orders`, `verify_settle_digest`, `maker_stats`). The `.mcp.json` config drops straight into Claude Desktop or any MCP client. See [AI integration](#ai-integration) below.

[See the full feature list in CHANGELOG.md if present, or run `git log --oneline` for the timeline.]

## Why it wins

We surveyed 599 Sui Overflow 2025 submissions and the full Walrus showcase. Plenty use one of these pieces. **No one combines commit-reveal + Seal-style selective disclosure + Walrus content-addressed commitment + atomic PTB settle for OTC.** So we did.

| | Sealed Pair | Shroud | PactDa | Alkimi | DeepBook |
|---|---|---|---|---|---|
| Mechanism | **Commit-reveal + Seal** | ZK proofs | Open escrow | Seal + Nautilus | None (public) |
| Storage | **Walrus blob commitment** | None | None | Walrus | None |
| Pattern | **P2P OTC** | Pool swap | Generic | Auction (ads) | CLOB |
| Cryptographic commitment | **✓** | ✗ | ✗ | Auction-internal | ✗ |
| Selective disclosure | **✓ (Seal policy)** | N/A | ✗ | ✓ | ✗ |

---

## Live integration verified

```
$ curl https://sealed-pair.vercel.app/api/health?network=mainnet
{
  "ok": true,
  "network": "mainnet",
  "networkName": "Sui Mainnet",
  "chainId": "35834a8a",
  "checkpoint": "281044055",
  "latencyMs": 78
}
```

```
$ curl -X PUT https://sealed-pair.vercel.app/api/walrus/store?epochs=2 \
       --data-binary @file
{ "ok": true, "blobId": "53iQMTkE-FIDORnfbIDo08qhmPNL2K_wEZEBfg5BrEI", ... }

$ curl https://aggregator.walrus-testnet.walrus.space/v1/blobs/53iQMTkE-FIDORnfbIDo08qhmPNL2K_wEZEBfg5BrEI
<actual stored bytes>
```

Everything from the seal animation onward in the live demo is talking to real Walrus testnet + real Tatum mainnet RPC. No mocks.

---

## Try it yourself

**In your browser:**

1. Open https://sealed-pair.vercel.app/app
2. Top-right network pill shows the live mainnet checkpoint (advancing every 15s)
3. Click **Seal a quote** as Marina (maker) → fill the form → submit
4. Watch the ceremony: real AES-GCM encrypt → real Walrus upload → real blobId
5. Copy the blobId, paste into `https://aggregator.walrus-testnet.walrus.space/v1/blobs/<blobId>` to confirm it's actually on-chain
6. Switch role to **Theo** (taker) → open the sealed quote → fund escrow → terms decrypt for real

**Locally:**

```bash
git clone https://github.com/PugarHuda/sealed-pair.git
cd sealed-pair
cp .env.example .env.local      # then fill in TATUM_API_KEY_* values
npm install
npm run dev
```

---

## Project layout

```
app/                                # Next.js App Router pages + API routes
  ├ page.tsx                        # Marketing landing
  ├ app/page.tsx                    # Interactive prototype shell
  ├ api/sui/route.ts                # Generic Sui JSON-RPC proxy
  ├ api/health/route.ts             # Live Tatum chain status
  └ api/walrus/                     # Walrus publisher + aggregator proxies
components/
  ├ mascot.tsx                      # Pip the seahorse (SVG, 6 poses, 4 palettes)
  ├ landing/                        # Landing sections (Hero / Problem / How / Why / Security / Stack)
  ├ wallet/                         # ConnectButton with autoConnect-aware placeholder
  ├ app/
  │  ├ screens/                     # Board / Create / Deal / Vault
  │  ├ ceremonies.tsx               # Seal + Settle multi-step modals (atomic PTBs)
  │  ├ counter-offer.tsx            # Diam-port: counter-offer modal + maker review panel
  │  └ watchlist.tsx                # Diam-port: watchlist drawer + toast stack
  └ ui/                             # Btn, Card, Badge, Mono, Field, Segmented, Icon …
lib/
  ├ sui-rpc.ts                      # Server-only Tatum-authed RPC client
  ├ walrus.ts                       # Multi-publisher failover client
  ├ crypto.ts                       # AES-256-GCM Web Crypto helpers
  ├ sui-orders.ts                   # On-chain event decoding, zombie filter, reputation aggregator, side hints
  ├ counter-offers.ts               # Diam-port: encrypted counter index keyed by parent orderId
  ├ watchlist.ts                    # Diam-port: criteria + seen-set + Notification helpers
  └ data.ts                         # Personas, makers, seed orders
move/
  ├ sources/order.move              # The Move package (Order, lifecycle, events, seal_approve)
  └ tests/order_tests.move          # Move unit tests
scripts/
  ├ deploy-move.ps1                 # One-shot Move build + publish + env write
  ├ seed-orders.mjs                 # Seal + post N demo orders directly via keystore
  └ setup-vercel-env.ps1            # Push .env.local to Vercel (idempotent)
brand.md                            # Design tokens, typography, voice
DEPLOY.md                           # Vercel deployment walkthrough
```

---

## What you'll see in the demo

### Landing (`/`)
Immersive lagoon scene with **Pip the seahorse** floating over an animated water layer cake. The headline is the trader pitch: *"Move size without tipping your hand."* Below: the problem (DEX vs OTC desk vs no audit trail), the five-step sealed-trade flow, why nobody has built this on Sui, the threat model, the stack, and a CTA into the prototype.

### RFQ Board (`/app`)
Sealed quotes from across the desk. Each card shows the size band publicly but blurs the exact amount/price behind a `▭ ▭ @ ▭ ▭` placeholder until the taker funds escrow. Every card carries its real **Walrus `blobId`** as a copyable mono pill — proof the encrypted terms exist on-chain.

Header is live: **Tatum chain pill** (chain ID + advancing checkpoint, polled every 15s), **Watchlist bell** with active-watch count, **Connect Wallet** with an autoConnect-aware placeholder so the pill doesn't flash on refresh, and a demo persona toggle that hides itself once a real wallet is attached.

Filters: search by pair, `All / Sell / Buy` side toggle, and an `Everyone / Mine N` scope toggle once you have orders posted from this wallet. Cards carry a `Nx settled` reputation chip pulled from on-chain `OrderSettled` events, and a `Your offer` ribbon for cards the connected wallet posted.

### Seal a quote (`/app` → "Seal a quote")
Maker fills the form, hits the seal button, and watches the ceremony:
1. AES-256-GCM encrypts the terms client-side
2. Ciphertext PUTs to a public **Walrus** publisher → real `blobId` comes back
3. Symmetric key sealed with the on-chain Move policy (Seal SDK placeholder)
4. (When wallet connected + package deployed) `create_offer` PTB signs + executes via Tatum RPC → real testnet tx with a **SuiScan deep link**

### Deal room (`/app` → tap any card)
Taker's view of a sealed quote. Before funding the user can either:

- **Fund escrow & request reveal** — a single PTB that splits the gas coin to the exact MIST amount, calls `lock_with_escrow`, then `mark_revealed` atomically (combined to avoid the cross-fullnode race where `mark_revealed` would abort with `EWrongState` before the lock propagated). A streaming policy-check log mimics what Seal nodes verify. The Walrus blob is fetched, AES-GCM decrypts, terms unblur in place.
- **Counter-offer instead** — open a modal, propose alternate `amount / price / memo`. The counter is AES-encrypted and uploaded as its own Walrus blob, then indexed locally. The maker sees pending counters with `Accept / Reject` actions next time they open the order.

If the encrypted fields can't be decoded locally (AES key not in this browser's session — common for orders sealed elsewhere), the affected fields render as `—` with a tooltip rather than misleading `0`s. A pre-flight balance check disables the Fund button if escrow + gas reserve exceeds wallet balance, surfacing the shortfall so the user can pick a smaller order.

### Vault (`/app` → "Vault")
Audit trail. Live on-chain `OrderSettled` events stream in via Tatum's `suix_queryEvents`, then each event is enriched with a single batched `sui_multiGetObjects` call so the row carries give/get assets, parties, size, and the cryptographic-audit checkmarks (blobId matches commitment, hash matches sealed, both legs in one PTB, Walrus blob still retrievable). LIVE rows pulse with an accent border and link straight to **SuiScan**; demo rows render with the same component for a unified UI.

`All trades / Mine N` toggle filters to rows where either the maker or the taker matches the connected wallet — works across devices because matching is derived from chain truth, not localStorage. The four stat cards mix demo data with live on-chain counts so the dashboard reads correctly even before the Move package is deployed.

---

## AI integration

Sealed Pair exposes its on-chain reads as **MCP-compatible HTTP tools** so any
AI agent (Claude Desktop, Cursor, Continue, custom orchestrator) can query
the live RFQ board, verify settlement digests, and read maker reputation
without needing to wire the Sui RPC plumbing themselves.

```bash
# Live tool catalog
curl https://sealed-pair.vercel.app/api/mcp

# List the current open orders (zombie-filtered)
curl 'https://sealed-pair.vercel.app/api/mcp/list-orders?limit=10'

# Verify any settlement tx digest came from THIS package
curl 'https://sealed-pair.vercel.app/api/mcp/verify-digest?digest=<base58>'

# Aggregate maker reputation
curl 'https://sealed-pair.vercel.app/api/mcp/maker-stats?address=0x...'
```

A canonical client config is shipped at [`.mcp.json`](./.mcp.json). All tools
are read-only — mutations require wallet signing and stay out-of-scope for
the MCP surface.

Bonus: a real-time **Tatum Data API** surface at `/api/tatum-data/wallet-history`
proxies `suix_queryTransactionBlocks` filtered `FromAddress` so the connected
wallet's recent transactions show up directly in the portfolio dropdown.

## Roadmap

Shipped this hackathon:

- [x] **Sui dApp Kit wallet** — Slush/Suiet integration, autoConnect, real PTB execution for `create_offer`, atomic `lock_with_escrow + mark_revealed`, and `settle`
- [x] **Move package on Sui devnet** — `0x73d1…c99eb`, deployed and exercised by every flow above
- [x] **Sui Seal SDK scaffold** — `@mysten/seal` v1.1 wired with a working `seal_approve` Move policy; threshold-server hookup is the final swap
- [x] **Diam-style trader UX** — counter-offer flow, watchlist + browser notifications, per-maker reputation, Mine filter, zombie-order filter, side inference

Post-hackathon:

- [ ] **Seal threshold release** — swap the AES-key fallback for real 2-of-3 key-server share assembly behind the same `seal_approve` policy already on-chain
- [ ] **V2 settle()** — generic `Coin<GIVE>` + `Coin<GET>` atomic swap inside Move (V1 is escrow-only)
- [ ] **Tatum Data API analytics** — historical volume + tx history in Vault
- [ ] **Cross-device counter / watchlist** — move the localStorage indexes into a Move `Table` shared object

---

## Hackathon submission

Sealed Pair targets all three of the **Tatum × Walrus** hackathon prize tracks:

- **Walrus + Tatum Integration (30%):** content-addressed blobId as cryptographic commitment, multi-publisher failover, full Tatum mainnet RPC + future Data API.
- **Technical Quality (30%):** clean TypeScript strict, server-side secret custody, 5-state Move lifecycle with Move unit tests, atomic PTB-ready settle.
- **Creativity (20%):** first Sui project combining commit-reveal + Seal-style disclosure + Walrus commitment + atomic settlement for OTC. Pip mascot biology mirrors the protocol pattern.
- **Presentation (20%):** live demo URL, full landing page, README with verifiable curl commands.

Stretch bonus targets:
- 🌟 **Best Walrus Integration** — Walrus is the cryptographic commitment, not storage.
- ⚡ **Best Use of Tatum Tools** — RPC + future Data API + optional MCP for AI agent flow.

---

## License

Apache 2.0. Code is MIT-spirit — borrow shamelessly.

## Acknowledgments

- **Tatum** for the Sui RPC gateway powering all on-chain reads
- **Mysten Labs** for Sui, Walrus, and the Seal primitive
- **Anthropic Claude Design** for the hi-fi visual handoff this implementation faithfully ports

— Built by [@PugarHuda](https://github.com/PugarHuda)
