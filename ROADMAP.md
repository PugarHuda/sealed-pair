# Sealed Pair — 7-day execution plan

> Deadline: **Sat 6 Jun 17:00 UTC** (Sun 00:00 WIB)
> Generated 30 May 2026. Update at end of each day.

## Status legend

- 🟢 done
- 🟡 in progress / partial
- ⚪ pending
- 🔴 blocked / dropped

---

## D0 — Sat 30 May (today)

- 🟢 GitHub repo public + README + Vercel auto-deploy connected
- 🟢 `docs/SOCIAL.md` — sosmed templates ready (post any time today)
- 🟢 `docs/SUI_CLI_INSTALL.md` — Windows happy path documented
- ⚪ **User action:** download Sui CLI binary + add to PATH (~15 min, [guide](docs/SUI_CLI_INSTALL.md))
- ⚪ **User action:** post one variant from [docs/SOCIAL.md](docs/SOCIAL.md) on Twitter or LinkedIn (~5 min, claims hackathon bonus)

---

## D1 — Sun 31 May

**Goal:** Move package live on testnet, RFQ board reading real on-chain events.

- ⚪ `sui client new-env --alias testnet --rpc https://sui-testnet.gateway.tatum.io`
- ⚪ `sui client new-address ed25519` + `sui client faucet`
- ⚪ `.\scripts\deploy-move.ps1` → captures PackageID into `.env.local`
- ⚪ `.\scripts\setup-vercel-env.ps1 -Environments production` → push package ID to Vercel
- ⚪ `vercel --prod` → redeploy (or just push to GitHub; auto-deploys)
- ⚪ Write a small Node script `scripts/seed-orders.ts` to call `create_offer` 2–3 times so the board has real on-chain content
- ⚪ Open `/app` → verify a "live" badge or live orders appear in the board

**Done when:** RFQ Board on production shows orders sourced from `suix_queryEvents`, not just seed data.

**Fallback if Move build fails:** keep package code in repo (judges can read it), skip on-chain RFQ. Demo still works with mock data.

---

## D2 — Mon 1 Jun

**Goal:** wallet connect + first real PTB call (`create_offer`).

- ⚪ `npm install @mysten/dapp-kit @mysten/sui @tanstack/react-query`
- ⚪ `components/providers.tsx` — wrap app in `WalletProvider` + `QueryClientProvider`
- ⚪ Mount in `app/layout.tsx` (client boundary only)
- ⚪ `components/wallet/connect-button.tsx` — `<ConnectButton />` styled to match brand
- ⚪ Replace top-right "Marina / Theo" role toggle with **connected wallet address** + role mode selector
- ⚪ In `SealCeremony`, after Walrus upload, build + sign + execute a real `create_offer` PTB
- ⚪ Update `lib/sui-orders.ts::createOfferCall` to construct via `@mysten/sui/transactions::Transaction`

**Done when:** Connecting Slush/Suiet wallet shows the address; clicking Seal triggers a wallet signature prompt and a real testnet tx appears in suiscan.

**Fallback if dApp Kit hydration issues:** wrap everything in `dynamic(() => …, { ssr: false })`. Lose SSR for `/app`, keep landing static.

---

## D3 — Tue 2 Jun

**Goal:** complete wallet flow (lock+reveal+settle) + Tatum Data API in Vault.

- ⚪ `lock_with_escrow` PTB from DealScreen `fund()` button
- ⚪ `mark_revealed` PTB after Seal/AES decrypt completes
- ⚪ `settle` PTB from "Confirm & settle" button
- ⚪ `cancel_open` / `cancel_expired` from Cancel actions
- ⚪ Check Tatum Data API support for Sui (`get_wallet_portfolio`, `get_transaction_history`). If Sui not supported → fall back to `suix_queryTransactionBlocks` via `/api/sui` proxy
- ⚪ Wire `VaultScreen` stat cards to real numbers: total volume, settled count, avg latency

**Done when:** Marina seal → board → Theo lock → reveal → settle is a full end-to-end on-chain flow with real signatures and Vault stats from live data.

**Fallback if Tatum Data API doesn't cover Sui:** display "Powered by Tatum Sui RPC" instead of "Powered by Tatum Data API"; same data, different label.

---

## D4 — Wed 3 Jun

**Goal:** Sui Seal SDK integration (HARD GATE).

- ⚪ Read `seal-docs.wal.app` + `@mysten/seal` npm package
- ⚪ Replace `lib/crypto.ts::stashKey`/`loadKey` (sessionStorage) with Seal threshold encrypt
- ⚪ Update `SealCeremony` step 3 ("Sealing key with on-chain policy") to actually call Seal SDK
- ⚪ Update `DealScreen` reveal to fetch key from Seal nodes after `mark_revealed` succeeds

**HARD GATE — 18:00 WIB:**
- If Seal not working end-to-end by then → **revert Seal commits, keep AES baseline**
- Don't burn D5/D6 on this. Move on.

**Done when:** real Seal threshold encryption replaces sessionStorage; key released only after on-chain `mark_revealed` transitions Order to REVEALED state.

---

## D5 — Thu 4 Jun

**Goal:** polish + bug bash + README screenshots.

- ⚪ Mobile-responsive pass on `/`, `/app/board`, `/app/seal`, `/app/deal/<id>`, `/app/vault`
- ⚪ Full play-through as Marina → seal → switch → Theo → lock → reveal → settle (record any glitches as issues)
- ⚪ Capture screenshots:
  - Hero with Pip swimming
  - RFQ board with sealed quotes
  - Seal ceremony mid-animation (ciphertext preview visible)
  - Deal room with policy check streaming
  - Vault audit row expanded
- ⚪ Embed screenshots into README under a new "Screenshots" section
- ⚪ Fix any P0 bug from the bug bash; defer P1+ to backlog

**Done when:** screenshots committed to README and live at `<repo-url>#screenshots`; full demo flow runs without console errors on mobile + desktop.

---

## D6 — Fri 5 Jun

**Goal:** demo video + submission form draft.

- ⚪ Write 60-second script (Hook → Problem → Demo → Tech → CTA)
- ⚪ Record 2-3 minute walkthrough using OBS or Loom
- ⚪ Edit (cut dead air, add captions for blob ID / address copies)
- ⚪ Upload to YouTube unlisted + capture share URL
- ⚪ Draft submission form fields:
  - Project name: Sealed Pair
  - One-liner: "Sealed peer-to-peer OTC trading on Sui"
  - Live URL: https://sealed-pair.vercel.app
  - Repo: https://github.com/PugarHuda/sealed-pair
  - Video: <YouTube unlisted URL>
  - Team: solo
  - Walrus integration explanation
  - Tatum integration explanation
- ⚪ **Feature freeze 22:00 WIB** — no more code changes; only README/docs from now on

**Done when:** video uploaded, form fields drafted in a Notion or `docs/SUBMISSION.md`, repo locked.

---

## D7 — Sat 6 Jun (final day)

**Goal:** submit + amplify.

- ⚪ Morning: re-test live demo, re-test the deployed URL one final time, verify all links in submission draft work
- ⚪ Submit hackathon form (deadline 17:00 UTC = 00:00 WIB Sun)
- ⚪ Post "🚀 Submitted!" follow-up on Twitter/LinkedIn with the video embedded
- ⚪ Optional: post in Tatum Discord #hackathon channel announcing submission

**Done when:** submission confirmed, sosmed amplified, breathe.

---

## Scoring projection

| Criteria | Weight | Realistic outcome |
|---|---|---|
| Walrus + Tatum Integration | 30% | **9-9.5/10** (Walrus is the commitment primitive, Tatum on every call) |
| Technical Quality | 30% | **8.5-9/10** (clean TS, Move tests, atomic-ready) |
| Creativity | 20% | **9-9.5/10** (gap in ecosystem confirmed, novel combo) |
| Presentation | 20% | **8.5-9/10** (live URL, video, README) |
| **Weighted total** | | **8.85-9.25** |
| Best Walrus Integration | +$200 | Very likely |
| Best Tatum Tools | +$200 | Likely if D3 lands |

Target: top 3 + at least 1 bonus = **$600-800** range. Top 1 + both bonuses = **$1000**.
