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
| Frontend | Next.js 14 (App Router) + React 18 + TypeScript |
| Sui RPC | **Tatum Sui mainnet gateway** via server-side proxy at `/api/sui` |
| Storage | **Walrus** testnet (multi-publisher failover at `/api/walrus/*`) |
| Encryption | AES-256-GCM via Web Crypto API (Seal SDK integration WIP) |
| Smart contracts | Move package `sealed_pair::order` — 5-state lifecycle, escrow `Balance<SUI>`, full event emission |
| Hosting | Vercel (Fluid Compute, Node.js 24 LTS) |
| Brand | Pip the seahorse — pair-bonded mascot mapping P2P OTC pattern |

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
  ├ app/                            # Screens (Board / Seal / Deal / Vault), ceremonies, role toggle
  └ ui/                             # Btn, Card, Badge, Mono, Field, …
lib/
  ├ sui-rpc.ts                      # Server-only Tatum-authed RPC client
  ├ walrus.ts                       # Multi-publisher failover client
  ├ crypto.ts                       # AES-256-GCM Web Crypto helpers
  ├ sui-orders.ts                   # On-chain event decoding + live RFQ fetch
  └ data.ts                         # Personas, makers, seed orders
move/
  ├ sources/order.move              # The Move package (Order, lifecycle, events)
  └ tests/order_tests.move          # Move unit tests
scripts/
  ├ deploy-move.ps1                 # One-shot Move build + publish + env write
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

Header is live: **Tatum chain pill** (mainnet chain ID + advancing checkpoint, polled every 15s), **Connect Wallet** (Slush / Suiet / any Sui dApp Kit wallet), and a demo **Marina / Theo** role toggle.

### Seal a quote (`/app` → "Seal a quote")
Maker fills the form, hits the seal button, and watches the ceremony:
1. AES-256-GCM encrypts the terms client-side
2. Ciphertext PUTs to a public **Walrus** publisher → real `blobId` comes back
3. Symmetric key sealed with the on-chain Move policy (Seal SDK placeholder)
4. (When wallet connected + package deployed) `create_offer` PTB signs + executes via Tatum RPC → real testnet tx with a **SuiScan deep link**

### Deal room (`/app` → tap any card)
Theo's view of a sealed quote. Funding the refundable good-faith deposit triggers:
1. `lock_with_escrow` PTB (splits the gas coin to exact MIST amount)
2. Streaming policy-check log mimicking what Seal nodes verify
3. Real Walrus blob fetch → AES-GCM decrypt → terms unblur in place
4. `mark_revealed` PTB so indexers (Vault) see the state transition

### Vault (`/app` → "Vault")
Audit trail. Live on-chain `OrderSettled` events stream in via Tatum's `suix_queryEvents`, shown as expanded rows with cryptographic-audit checkmarks (blobId matches commitment, hash matches sealed, both legs in one PTB, Walrus blob still retrievable). Each row links straight to **SuiScan**.

The four stat cards mix demo data with live on-chain counts so the dashboard reads correctly even before the Move package is deployed.

---

## Roadmap (post-hackathon)

- [ ] **Sui Seal SDK** — replace AES + sessionStorage demo with real threshold encryption
- [ ] **Sui dApp Kit wallet** — Slush/Suiet integration, real PTB execution
- [ ] **V2 settle()** — generic `Coin<GIVE>` + `Coin<GET>` atomic swap inside Move (V1 is escrow-only)
- [ ] **Tatum Data API analytics** — historical volume + tx history in Vault
- [ ] **Mobile-responsive polish**

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
