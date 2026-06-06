# Sosmed templates — pick one and post

> Required mentions: **@Tatum_io** **@WalrusFoundation** **@SuiNetwork**
> Required hashtags: at least one of #SuiNetwork #Walrus #BuildOnSui
> Live URL to embed: <https://sealed-pair.vercel.app>
> Repo URL: <https://github.com/PugarHuda/sealed-pair>
> Pitch deck: <https://sealed-pair.vercel.app/slide>

---

## ⭐ SUBMIT DAY — pick one and post NOW (2026-06-06)

### MAIN TWEET (recommended · 268 chars)

Copy-paste-ready. Hits the hook, lands the unique angle, includes 3 mentions + 2 hashtags + 2 links.

> 🦭 Just shipped Sealed Pair — sealed P2P OTC on @SuiNetwork.
>
> Maker encrypts terms → @WalrusFoundation blob (blobId IS the commitment)
> Taker funds escrow → atomic PTB settles both legs
>
> 14 Sui RPC methods via @Tatum_io.
>
> sealed-pair.vercel.app
>
> #BuildOnSui #Walrus

---

### THREAD VARIANT (1/4 → 4/4 for those who want depth)

**1/4** (main tweet — same as above):

> 🦭 Just shipped Sealed Pair — sealed P2P OTC on @SuiNetwork.
>
> Maker encrypts terms → @WalrusFoundation blob (blobId IS the commitment)
> Taker funds escrow → atomic PTB settles both legs
>
> 14 Sui RPC methods via @Tatum_io.
>
> sealed-pair.vercel.app

**2/4** (the insight):

> The trick: blobId is the BLAKE2b hash of the ciphertext.
>
> Storing it on-chain in `Order.blob_id` turns Walrus from a CDN into a content-addressed cryptographic commitment.
>
> Swap the bytes anywhere → commitment provably breaks.
>
> That's commit-reveal for OTC.

**3/4** (Tatum tools + MCP):

> Tatum's official MCP doesn't yet ship Sui-native Blockchain Data tools — Sui is only via gateway_execute_rpc raw RPC.
>
> So I built 4 Sui-native MCP tools:
> • list_open_orders
> • wallet_history
> • verify_settle_digest
> • maker_stats
>
> `.mcp.json` composes both → AI agents get Sui + 22 chains in one config.

**4/4** (deck + CTA):

> 10-slide live pitch deck (keyboard-nav, click "F" for fullscreen):
> sealed-pair.vercel.app/slide
>
> Source:
> github.com/PugarHuda/sealed-pair
>
> Solo build, 14 days, 40 features. Built for @Tatum_io × @WalrusFoundation Build-on-Sui hackathon.
>
> Private quotes. Public settlement. No middleman. 🐚

---

### LINKEDIN — long-form (rec'd for hackathon judges who LinkedIn-stalk)

> 🦭 Shipped Sealed Pair for the Tatum × Walrus hackathon — sealed peer-to-peer OTC trading on Sui.
>
> **The problem:** OTC trading forces a brutal trade-off. Post on a DEX and the mempool front-runs your size. Call a desk and trust them with the spread. Neither leaves an audit trail.
>
> **The shape:**
> 1️⃣ Maker encrypts terms locally
> 2️⃣ Ciphertext goes to Walrus → the blobId IS the cryptographic commitment (BLAKE2b hash of the ciphertext, stored in the Move Order object)
> 3️⃣ Sealed quote hits a public RFQ board; takers see only the size band
> 4️⃣ Taker funds refundable escrow on Sui — that escrow satisfies the Seal-style access policy
> 5️⃣ Key auto-releases; terms decrypt for both sides; one atomic PTB settles both legs
>
> **What's underneath:**
> • 14 distinct Sui RPC methods via Tatum's gateway (devnet/testnet/mainnet auto-switch, server-side x-api-key custody)
> • Walrus testnet — 3 publishers + 3 aggregators with HTTP failover
> • 5 Move PTBs deployed on Sui devnet, all wired live; 25+ OPEN orders + 2 SETTLED on-chain right now
> • 40 features shipped solo in 14 days
> • 4 Sui-native MCP tools that fill a real gap — Tatum's own MCP doesn't yet expose Sui Blockchain Data tools natively
>
> Live demo: https://sealed-pair.vercel.app
> Pitch deck: https://sealed-pair.vercel.app/slide
> Source: https://github.com/PugarHuda/sealed-pair
>
> Big credit to @Tatum.io for the gateway, @Mysten Labs for Sui + Walrus + Seal, and the @WalrusFoundation team for the storage primitive that made this possible.
>
> #TatumXWalrus #BuildOnSui #Sui #Walrus #DeFi #OTC

---

## Twitter / X (260-char variants)

### A. Builder energy (the strongest narrative)

> 🦭 Sealed Pair — sealed peer-to-peer OTC on @SuiNetwork.
>
> Maker encrypts terms → @WalrusFoundation stores ciphertext → @Tatum_io RPC + atomic PTB settle.
>
> The blobId IS the commitment. Nothing to front-run. Live at sealed-pair.vercel.app
>
> #BuildOnSui

### B. Pitch-first

> Move size without tipping your hand.
>
> Sealed P2P OTC on @SuiNetwork. Quotes lock as @WalrusFoundation blobs, reveal only when escrow funds — then settle atomically.
>
> Built with @Tatum_io for the Build-on-Sui hackathon.
>
> sealed-pair.vercel.app
>
> #SuiNetwork #Walrus

### C. Tech-flex

> Stack notes from a Sui hackathon weekend:
>
> • Tatum gateway for every RPC call ⚡
> • Walrus blob as cryptographic commitment 🦭
> • AES-GCM client-side (Seal SDK next)
> • Move package shared Order + escrow Balance
>
> Live: sealed-pair.vercel.app
> Code: github.com/PugarHuda/sealed-pair
>
> @Tatum_io @WalrusFoundation @SuiNetwork

---

## LinkedIn (longer-form, builds credibility)

> Just shipped the first cut of **Sealed Pair** — sealed peer-to-peer OTC trading on Sui.
>
> The problem: big crypto trades today force a brutal trade-off. Hit a DEX and the mempool front-runs you. Call a desk and trust a middleman with the spread. Neither leaves a clean audit trail.
>
> The shape we built:
> 1. Maker encrypts deal terms locally
> 2. Ciphertext goes to **Walrus** — the blobId is the commitment
> 3. Quote hits a public RFQ board; takers see only a size band
> 4. Taker funds refundable escrow — the policy that releases the key
> 5. Terms decrypt for both sides; settlement is a single atomic Sui transaction
>
> No desk to trust. Nothing to front-run. Verifiable audit trail forever.
>
> All RPC reads run through Tatum's Sui mainnet gateway. Every encrypted blob is real testnet Walrus storage — verifiable from any aggregator. Move package live for the on-chain side.
>
> Live demo: https://sealed-pair.vercel.app
> Source: https://github.com/PugarHuda/sealed-pair
>
> Built for the @Tatum_io × @WalrusFoundation hackathon. Big credit to @Mysten Labs for Sui, Walrus, and Seal.
>
> #Sui #Walrus #Tatum #BuildOnSui #OTC #DeFi

---

## Suggested image (1200×675, OG-style)

Hero composition:
- Pip the seahorse swimming over the lagoon scene (from the landing page)
- Headline overlay: **"Move size without tipping your hand."**
- Bottom corner: "sealed-pair.vercel.app"
- Top right: small logos for Tatum / Walrus / Sui

Quickest path to capture: open https://sealed-pair.vercel.app in a browser at 1200×675 viewport, screenshot the hero section above the fold, drop the URL banner in.

---

## After posting

1. Pin the post to your profile for the week leading up to the deadline
2. Reply with a screen-recording of the seal+reveal flow (D6 deliverable)
3. Re-share on the day you submit with "submitted ✅"
