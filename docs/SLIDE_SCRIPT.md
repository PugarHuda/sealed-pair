# Sealed Pair · Slide Deck Pitch Script

**Deck:** https://sealed-pair.vercel.app/slide (10 slides · keyboard-nav · live)
**Target:** 2:30–3:00 live pitch
**Delivery:** Standing, conversational. Talk TO the room, glance at deck for transitions only.
**Pace:** ~140 wpm. Slow on numbers (14, 30%, 22+), faster on narrative.

> **Tip:** Open the deck full-screen first (`F` key after page loads). Use ← → to navigate. URL bar shows `?n=N` so you can jump straight to a slide from a tab.

---

## Cue sheet (word-for-word)

### Slide 1 · Cover (0:00 – 0:15)

**Visual:** Mascot Pip in center, "Sealed Pair" headline, tagline beneath.

> "OTC trading on Sui today forces a brutal trade-off. Post on a DEX and the mempool front-runs your size. Call a desk and trust them with the spread. Both leak information. Neither leaves an audit trail.
>
> Sealed Pair is a third option."

**Delivery:** Pause after "Sealed Pair is a third option." Move to next slide.

---

### Slide 2 · The problem (0:15 – 0:35)

**Visual:** Three cards — DEX (bolt), OTC desk (user), audit trail (doc).

> "DEXes leak. Mempool sees your order before it fills, slippage takes the rest.
>
> OTC desks ghost. They see the spread. Settlement drags for days.
>
> And after the trade — try proving to your DAO what you agreed to. The paper trail sits off-chain, if it exists at all."

**Delivery:** One sentence per card. Touch each card on the screen with eyes — don't point with hand unless on stage.

---

### Slide 3 · The shape (0:35 – 0:55)

**Visual:** 5-step horizontal flow: Seal → Discover → Escrow → Reveal → Settle.

> "Maker encrypts the terms locally and uploads the ciphertext to **Walrus**. The blobId IS the cryptographic commitment.
>
> A sealed quote hits the public RFQ board — takers see only the size band, never the price.
>
> Taker funds a refundable escrow on Sui. That escrow IS what satisfies the Seal access policy.
>
> The instant the policy condition is met, the key releases. Terms decrypt for both sides.
>
> A single atomic PTB moves both legs. Receipt on-chain forever."

**Delivery:** Cadence of 5 short beats — match the visual rhythm. Eye contact between each.

---

### Slide 4 · Why it wins (0:55 – 1:15)

**Visual:** 4 highlighted boxes: commit-reveal, Seal disclosure, Walrus addressing, atomic PTB.

> "We surveyed all 599 Sui Overflow 2025 submissions and the full Walrus showcase. Plenty use one of these primitives.
>
> Nobody combines **commit-reveal**, plus **Seal-style selective disclosure**, plus **Walrus content addressing**, plus **atomic PTB settlement** — for OTC. This is the gap we filled."

**Delivery:** Emphasize each "plus" with a half-beat pause. The phrase "nobody combines" is the strongest line in the pitch — sell it.

---

### Slide 5 · Tatum integration (1:15 – 1:40)

**Visual:** 4 big numbers: 14 methods, 3 networks, 4 products, 69ms latency. Then 2 columns of evidence.

> "Fourteen distinct Sui RPC methods through the Tatum gateway. Three networks — devnet, testnet, mainnet — auto-switching. Four Tatum products wired end-to-end. Sixty-nine millisecond median latency, probed every thirty seconds.
>
> Our Vault page does live contract introspection through Tatum's `sui_getNormalizedMoveModule` — proves the Move package is really on-chain. The Settle digest verifier proves OrderSettled was emitted from this exact package. Wallet portfolio reads through the Tatum Data API."

**Delivery:** Land the four numbers like a punch combination. Slow down on "live contract introspection" — that's the technical credibility moment.

---

### Slide 6 · Walrus integration (1:40 – 2:05)

**Visual:** Insight callout box "The insight: blobId IS the BLAKE2b hash…" then 2 columns.

> "The insight that drove this build: blobId is the BLAKE2b hash of the ciphertext. Storing it on-chain in `Order.blob_id` turns Walrus from a CDN into a **content-addressed cryptographic commitment**. Swap the bytes anywhere and the commitment provably breaks.
>
> We ship three publishers and three aggregators with HTTP failover. Counter-offers upload their own encrypted blob — same property as the parent order. The Walrus blob inspector shows real bytes, real fetch latency, real served-by aggregator headers."

**Delivery:** "The insight" line is the most quotable beat in the deck. Memorize it cold. Slow. Confident.

---

### Slide 7 · What we shipped (2:05 – 2:25)

**Visual:** 4 feature buckets (Discovery / Negotiation / Settlement / Audit+AI), then 4 stats row.

> "Forty features in fourteen days. Solo build. Discovery surface, negotiation surface, settlement surface, audit and AI surface.
>
> Fifty-nine QA findings across ten rounds. Five Move PTBs wired live. Five OrderEvent types read end-to-end. Fifteen backend routes, all green."

**Delivery:** Brisk. This slide is proof-of-work — let the numbers speak; don't dwell on each feature.

---

### Slide 8 · Sui-native MCP gap-fill (2:25 – 2:45)

**Visual:** Yellow highlight callout box at top + 4 tool cards + curl command.

> "Tatum's official MCP server ships ten Blockchain Data tools across twenty-plus chains. EVM family, Bitcoin family, Solana, Cardano. **Sui isn't one of them yet.**
>
> Our four read-only MCP tools fill that gap with Sui-native semantics. `list_open_orders`, `wallet_history`, `verify_settle_digest`, `maker_stats`. Compose our server with Tatum's official one — an AI agent gets first-class Sui plus twenty-two other chains in one config. Neither side gives that alone."

**Delivery:** "Sui isn't one of them yet" — pause after this. It's the moment you reframe the bonus prize ask. Then ramp up energy through the composition pitch.

---

### Slide 9 · Judging fit (2:45 – 3:00)

**Visual:** Criteria table mapped to weights + 2 sponsor-prize callouts.

> "Mapped to every weight. Walrus and Tatum integration — thirty percent — fourteen RPC methods, commitment-grade Walrus usage. Technical quality — thirty percent — strict TypeScript, atomic PTBs, fifty-nine QA fixes. Creativity — twenty percent — the combination nobody else built. Presentation — twenty percent — live demo, README, this deck.
>
> Best Walrus Integration: blobId as on-chain commitment, plus counter-offer side-blobs. Best Use of Tatum Tools: fourteen methods plus the MCP gap-fill."

**Delivery:** Read the criteria like you're answering exactly the question the judge has on the rubric in front of them.

---

### Slide 10 · CTA (3:00 – 3:15)

**Visual:** Mascot proud-pose, "Stop trusting the desk." headline, two CTAs.

> "Stop trusting the desk. Seal a quote, fund escrow, watch the price crack open on-chain. The whole thing runs in your browser — go break it.
>
> Sealed Pair. Tatum. Walrus. Sui."

**Delivery:** End on the four-word punch list. Hold eye contact, then step back.

---

## Variants

### 90-second cut (for sponsor stages with hard cap)

Use slides **1 → 3 → 5 → 8 → 10** only. Cut slides 2, 4, 6, 7, 9. Total ~1:30.

The trade: lose the problem framing and the proof-of-work numbers. Keep the cryptographic narrative and the Sui-native MCP angle.

### 60-second elevator pitch (no deck)

> "Sealed Pair is a sealed peer-to-peer OTC trading dApp on Sui. Makers encrypt their quotes locally and post to Walrus — the blobId becomes the on-chain commitment. Takers fund escrow on Sui, which auto-releases the decryption key. One atomic PTB settles both legs. Built on the Tatum gateway with fourteen Sui RPC methods, plus an MCP layer that fills a gap Tatum's own official server hasn't covered: native Sui Blockchain Data tools."

Word count: 88. Read in 35–40 seconds at a measured pace.

---

## Live presentation checklist

- [ ] Deck open in fullscreen on the laptop being shown (`F` key after load)
- [ ] `/app` open in a SECOND tab so you can switch to live demo if a judge asks
- [ ] Slush wallet pre-connected on devnet (so the "connect" friction is gone if you live-demo)
- [ ] Mobile hotspot / wifi confirmed before walking on stage
- [ ] Time-keep with phone timer set to 2:45 (gives 15s margin)
- [ ] Water within reach

## If a judge interrupts mid-pitch

| They ask | You answer with |
|---|---|
| "Is the Move package really deployed?" | Switch to Vault tab → live contract introspection panel · "Tatum's sui_getNormalizedMoveModule fetched this live from devnet 30s ago." |
| "Show me a real settled trade." | Vault → click a SETTLED row → SuiScan link in new tab. |
| "Walrus integration looks like CDN usage." | Slide 6 callout — "blobId IS the BLAKE2b hash. Commit-reveal, not storage." Then BlobInspector → show real bytes. |
| "Why is your MCP useful?" | Slide 8 — "Tatum's own MCP doesn't have Sui Blockchain Data tools yet. We fill that gap." Show `/api/mcp` JSON catalog. |
| "What's the most novel thing you built?" | "Walrus blobId as on-chain cryptographic commitment, not as storage. Nobody combined that with atomic PTB OTC settlement before." |

---

## Voice notes

- **Use second-person** ("you", "your") when describing the user flow. It puts the judge in the dApp.
- **Avoid filler words.** Replace "so", "basically", "like" with a pause.
- **Land the numbers.** 14 methods. 22+ chains. 40 features. 59 QA findings. Each one is a credibility deposit.
- **Don't read the slides.** They'll read faster than you can talk. Use the slide as a punctuation mark, not a teleprompter.
- **One breath per beat.** If you find yourself running out of breath, the sentence is too long — chunk it.

*Last updated 2026-06-06 · 13 archetypes seeded on-chain · ready for live demo.*
