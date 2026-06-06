# Sealed Pair · Demo Video Script

**Target:** 2:30 (Tatum × Walrus hackathon submission cap: 2-3 min)
**Format:** Screen recording with voice-over. 1080p, 30fps. Headset mic.
**URL on screen throughout:** `https://sealed-pair.vercel.app`

> **Companion script for live pitch:** [docs/SLIDE_SCRIPT.md](./docs/SLIDE_SCRIPT.md) covers the 10-slide deck at `/slide`. This file is the 2-3 min **screen recording** narration. Use the slide script when presenting live; this script when recording.

**State at recording time (verify before take):**
- 25+ OPEN orders on the board (13 archetypes from `scripts/seed-orders.mjs`)
- 2 SETTLED rows in the Vault (from `scripts/seed-takers.mjs --locks 4 --settles 2`)
- 6 counter-offers installed via `scripts/seed-counters.mjs` + the install URL
- 14 distinct Sui RPC methods routed through Tatum
- 40 features shipped (compare to SUBMISSION.md if uncertain)
- 5 Move PTBs wired live; package id `0x73d1…c99eb` on devnet

---

## Cue sheet

| Time | Visual | Voice-over |
|---|---|---|
| 0:00–0:08 | Landing page hero. Mascot floating. | "OTC trading on Sui today forces a brutal trade-off: post on a DEX and the mempool front-runs you, or call a desk and trust them with the spread. Sealed Pair is a third option." |
| 0:08–0:18 | Scroll past "How it works" — 5 numbered steps. | "Maker seals the terms locally and posts the ciphertext to **Walrus**. The blobId IS the cryptographic commitment. A sealed quote hits the public RFQ board." |
| 0:18–0:28 | Click "Try the demo" → `/app` loads. Watchlist bell, network pill checkpoint visibly advancing, sponsor footer visible. | "Live mainnet checkpoint advancing every 15 seconds — that's **Tatum's** Sui RPC gateway. Walrus aggregators serving the encrypted blobs. Sui storing the orders." |
| 0:28–0:40 | Board view. Point at: pair-depth widget (4 pairs), activity ticker streaming events (POSTED · LOCKED · SETTLED chips), gold/silver/bronze reputation chips, expiry countdown. **Notice the 'Inbox · 6' pulsing button + the inbox banner if connected as maker.** | "The board shows 25+ real on-chain orders polled every 30 seconds. Every chip — pair depth, reputation tier, expiry — is derived from real `OrderPosted` events through `suix_queryEvents`. The inbox pulses when takers respond to your offers." |
| 0:40–0:52 | Click "Seal a quote" → fill form → click Seal. SealCeremony plays. | "Sealing runs locally: AES-256-GCM encrypts the terms, ciphertext PUTs to Walrus testnet, blobId returns. Then the wallet signs `create_offer` — one PTB on Sui devnet, real digest." |
| 0:52–1:05 | Navigate back to Board → new order appears with "Your offer" ribbon → click it. | "Polling picks the new order up within 5 seconds — my wallet address gets a 'Your offer' badge derived from chain truth, not local state. Open the deal room." |
| 1:05–1:25 | Deal Room. Show: sealed terms (blurred), counter-offer button, share link, **TxStatusStrip at top**. Click Fund. Slush popup. Approve. Watch the strip flip yellow → green with SuiScan link. | "Taker funds a refundable escrow. One atomic PTB — `lock_with_escrow` plus `mark_revealed` — eliminates the cross-fullnode race. Status strip flips: signing → locked on-chain. Walrus blob fetches, AES decrypts in place." |
| 1:25–1:38 | Click Settle. SettleCeremony plays — real digest. → Vault page. | "Settle is another atomic PTB. The receipt is on-chain forever. Open the Vault." |
| 1:38–1:55 | Vault scroll: stat cards → maker leaderboard → **deployed contract introspection** → **integration health** (Tatum + Walrus probes with real latency) → digest verifier → settlement history with LIVE chip. | "Live contract introspection — Tatum's `sui_getNormalizedMoveModule` fetches the deployed Move package, exposed functions, and emitted event types in real time. Integration health pings every Walrus publisher, every aggregator, and the Tatum RPC — every number is a live probe." |
| 1:55–2:10 | Click a settled trade → expand → "Copy JSON receipt" → paste into terminal showing it parsed. Click "Inspect blob" → BlobInspector shows real bytes + Content-Type header. | "Each settlement is a machine-readable receipt with the digest, blobId, parties, escrow, and SuiScan link. Every blob is inspectable — first 32 bytes of ciphertext, real fetch latency, served-by header." |
| 2:10–2:25 | Open `/api/mcp` in browser tab → JSON tool catalog. Then `.mcp.json` in repo. | "Read-only Sui-native MCP tools — `list_open_orders`, `wallet_history`, `verify_settle_digest`, `maker_stats`. Tatum's own MCP doesn't expose Sui Blockchain Data tools yet — we fill that gap. The `.mcp.json` composes both servers so an AI agent gets Sui-native semantics plus Tatum's 22+ other chains in one config." |
| 2:25–2:30 | Cut to URL + GitHub: `sealed-pair.vercel.app` and `github.com/PugarHuda/sealed-pair`. | "Sealed Pair. Private quotes. Public settlement. On Sui." |

---

## On-screen text overlays

- **0:08** "Walrus = cryptographic commitment, not just storage"
- **0:28** "Tatum gateway · Sui devnet · live · checkpoint advancing"
- **0:52** "Real Walrus blob upload · real `create_offer` PTB"
- **1:05** "Atomic lock + reveal — no race, no MEV window"
- **1:25** "TxStatusStrip · pending → success in one banner"
- **1:38** "Every metric below = live probe"
- **2:10** "Sui-native MCP · fills the gap Tatum's own server hasn't yet"

---

## What to NOT show (anti-mock discipline)

- Don't open the demo seed orders — only show on-chain `Anon-CB63` / `Anon-E9CC` orders
- Don't claim "Sui Seal threshold release" is live — the policy is deployed, key-server hookup is V2 (be specific if asked)
- Don't show the persona toggle — it auto-hides on wallet connect
- Don't show the `0` placeholders for un-decryptable orders — the em-dash render is the truthful path

---

## Pre-recording checklist

- [ ] `npm run build` clean
- [ ] Vercel deploy of latest master green
- [ ] Wallet has ≥ 3 SUI on devnet (enough for one seal + one fund + one settle)
- [ ] `scripts/seed-orders.mjs` run — 13 archetypes populate the board
- [ ] `scripts/seed-takers.mjs --locks 4 --settles 2` run — 2 SETTLED rows visible in Vault
- [ ] `scripts/seed-counters.mjs --maker <yourAddr> --count 6` install URL opened ONCE — Maker Inbox now shows 6 pending counters
- [ ] Onboarding banner dismissed in advance (so it doesn't pop on screen)
- [ ] Persona toggle confirmed gone (was removed in `b700da5`)
- [ ] Browser zoom 110% (so text reads on 1080p export)
- [ ] Slush wallet pinned to taskbar (faster popup)
- [ ] Mic level check: speech peaks at -6dB
- [ ] `/slide` deck open in a SECOND tab for fast pivots if a take goes long

---

## One-take takes

If a take goes long: cut the maker leaderboard / object explorer mention. Those are nice-to-haves; the **integration health panel** and **MCP catalog** are the two pieces judges grade on directly (Walrus + Tatum 30%, Best Use of Tatum Tools $200).

If a take goes short: add at 1:05 — "Counter-offer flow: takers can propose alternate terms, encrypted as a separate Walrus blob, surfaced to the maker with Accept/Reject." 8 extra seconds.
