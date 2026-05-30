# 🎬 Demo video script — Sealed Pair

**Target length:** 90–120 seconds.
**Tone:** trader-direct, not pitchy. Show the product, don't sell it.
**Voice over language:** English (judges international) — Indonesian subtitle optional.

> Tip: record screen + voice in OBS or Loom. Cut hard at the structural beats; don't drag transitions. The product visuals carry — let the seal/reveal moments breathe (~2 sec each).

---

## Beat-by-beat (timestamps assume ~95 sec final cut)

### 0:00 – 0:08 · Hook (8 sec)
**On-screen:** Landing hero of <https://sealed-pair.vercel.app>. Pip swimming. Scroll-down feel.

**VO:**
> "Want to move size on Sui without the mempool eating your face? Watch this."

> *(Slightly bratty. Set the trader tone. No "hi" or "in this video".)*

---

### 0:08 – 0:20 · Problem (12 sec)
**On-screen:** Scroll past the three "pick your poison" cards on the landing.

**VO:**
> "Three options today. Hit a DEX — your order moves the price before it fills.
> Call a desk — you trust a middleman and pay the spread.
> Both leave your DAO with a paper trail nobody can actually verify."

---

### 0:20 – 0:32 · The shape (12 sec)
**On-screen:** Click "Try the demo". Land on RFQ board. Cards visible — show the blurred terms + size band + blobId pill.

**VO:**
> "Sealed Pair flips this. Quotes go up sealed — public size band, private price.
> The blobId is the cryptographic commitment. Walrus stores the encrypted terms forever."

---

### 0:32 – 0:55 · Seal a quote (23 sec) — *the hero moment*
**On-screen:**
1. Top right: switch role to Marina. Click "Seal a quote".
2. Quick form fill: SUI → USDC, 50,000 SUI @ 3.92.
3. Hit "Seal & post to Walrus".
4. Ceremony plays — let the 4 steps each tick (encrypt → upload → seal policy → register).
5. End with blobId + tx digest pills visible.

**VO:**
> "Marina seals a 50k SUI quote. Terms encrypt locally in the browser — AES-GCM, never leaves the device.
> Ciphertext PUTs to Walrus. The blobId that comes back is the proof.
> Sui Seal locks the key behind an on-chain policy. The order registers on Sui through Tatum's RPC.
> Four seconds. The quote is sealed."

**Cut beat:** screenshot the resulting card on the board with the new blobId.

---

### 0:55 – 1:18 · Reveal & settle (23 sec) — *the showpiece*
**On-screen:**
1. Switch to Theo. Click the Marina card.
2. Show the locked state with the lock badge and "Fund escrow to unlock".
3. Click "Fund escrow & request reveal".
4. Policy check lines stream in (`order.state == LOCKED`, `escrow.funded == true`, etc.).
5. Terms decrypt visibly — the blurred numbers sharpen into the real price.
6. Click "Confirm & settle atomically".
7. Settle ceremony — PTB code preview flashes, both legs land.

**VO:**
> "Theo funds the refundable escrow. That deposit is the only thing the Seal policy is waiting for.
> Policy satisfied — Seal nodes hand over the key. Walrus serves the ciphertext. Terms decrypt for both sides.
> Either party confirms — one atomic PTB on Sui moves both legs. No MEV window, no settlement gap.
> Receipt minted on-chain. Done in under three seconds, end to end."

---

### 1:18 – 1:30 · Stack + close (12 sec)
**On-screen:** Vault page showing settled rows + stat cards + "Powered by Tatum" footer. Then snap to repo `https://github.com/PugarHuda/sealed-pair`.

**VO:**
> "Walrus is the commitment. Sui Seal is the access control. Tatum is the rails — every RPC, every event, every analytic.
> Sealed Pair. Private quotes, public settlement, peer to peer on Sui.
> Demo's live at sealed-pair.vercel.app. Code's open. Go break it."

---

## Recording checklist

- [ ] Chrome window, 1440×900 viewport (DevTools off)
- [ ] Wallet extension installed (Slush) — connected before recording the *Marina seal* beat so the on-chain digest actually fires
- [ ] OBS scene: full screen capture, mic gain checked, 30fps min
- [ ] Mute Slack / system notifications
- [ ] Have a settled trade already in the Vault before recording (run the full flow once before take, then start fresh on the board)
- [ ] Edit pass: cut all dead air > 0.3 sec; add captions for every monospace string (blobId, digest) — judges read on phones
- [ ] Export at 1080p MP4, < 50 MB for upload
- [ ] Upload to YouTube **unlisted** (so the form-submitted URL works without exposing pre-launch)
- [ ] Copy YouTube link → paste into `docs/SUBMISSION.md`

---

## Backup script if anything breaks during recording

If wallet signing fails mid-take, narrate over the existing mock path — the visuals still tell the same story. Don't pause to debug live; cut and re-record.

If Tatum RPC 429s during the take, the NetworkPill will say "Gateway error". Mention it in pass:
> *"That red dot? That's Tatum's free-tier rate limit kicking in. We're hitting their RPC live."*

Turn a glitch into proof the demo is real.
