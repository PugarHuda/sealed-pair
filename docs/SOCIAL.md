# Sosmed templates — pick one and post

> Required mentions: **@Tatum_io** **@WalrusFoundation** **@SuiNetwork**
> Required hashtags: at least one of #SuiNetwork #Walrus #BuildOnSui
> Live URL to embed: <https://sealed-pair.vercel.app>
> Repo URL: <https://github.com/PugarHuda/sealed-pair>

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
