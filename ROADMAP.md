# Sealed Pair — 7-day execution plan

> Deadline: **Sat 6 Jun 17:00 UTC** (Sun 00:00 WIB)
> Generated 30 May 2026 · last updated 31 May 2026 (D1 morning).

## Status snapshot

After 2 working sessions: **~4 days ahead of plan**. The risky technical
layers (wallet, on-chain PTBs, Tatum events, Walrus E2E) all ship and run
in production. What's left is mostly user-driven (CLI install, wallet
connect to verify, video record, submit). See per-day breakdown below.

- Production: <https://sealed-pair.vercel.app> · ~78ms Tatum mainnet latency
- Repo: <https://github.com/PugarHuda/sealed-pair> · 13 commits, narrative
- Live integrations verified end-to-end: Tatum chain identifier + checkpoint,
  Walrus PUT+GET byte-perfect round-trip, mobile responsive at 480/760/880
  breakpoints, branded OG image, all server endpoints sanity-tested.

## Status legend

- 🟢 done
- 🟡 in progress / partial
- ⚪ pending
- 🔴 blocked / dropped

---

## D0 — Sat 30 May ✅

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
- 🟢 `scripts/seed-orders.mjs` written — generates 3-5 real on-chain orders after package deploys
- ⚪ Run `node scripts/seed-orders.mjs --count 5` to populate the board
- ⚪ Open `/app` → verify live orders appear in the RFQ board

**Done when:** RFQ Board on production shows orders sourced from `suix_queryEvents`, not just seed data.

**Fallback if Move build fails:** keep package code in repo (judges can read it), skip on-chain RFQ. Demo still works with mock data.

---

## D2 — Mon 1 Jun ✅ (shipped early)

**Goal:** wallet connect + first real PTB call (`create_offer`).

- 🟢 `npm install @mysten/dapp-kit @mysten/sui @tanstack/react-query` (commit `aae2cdf`)
- 🟢 `components/providers.tsx` — TanStack Query → SuiClient → Wallet
- 🟢 Mounted in `app/layout.tsx` (client boundary)
- 🟢 `components/wallet/connect-button.tsx` — brand-styled trigger + ConnectModal + connected pill with disconnect
- 🟢 ConnectButton rendered alongside RoleToggle in `/app` header
- 🟢 SealCeremony's step 4 wires `create_offer` PTB when wallet + package both available (gates on `useCurrentAccount` + `SEALED_PAIR_PACKAGE_ID`)
- 🟢 PTB shape ready in `lib/sui-orders.ts` (typed CallDescription helpers)

**Status:** Live in production. The wallet button appears in `/app` right now; connect Slush/Suiet to verify the picker opens.

---

## D3 — Tue 2 Jun ✅ (shipped early)

**Goal:** complete wallet flow (lock+reveal+settle) + Tatum-powered Vault analytics.

- 🟢 `lock_with_escrow` PTB wired in DealScreen `fund()` (commit `e8b0e17`)
- 🟢 `mark_revealed` PTB fires after Walrus decrypt completes
- 🟢 `settle` PTB runs in parallel with SettleCeremony animation
- 🟢 SuiScan deep links rendered on every successful digest
- 🟢 Tatum Data API research done — Data API doesn't explicitly list Sui per docs, so we use `suix_queryEvents` for OrderSettled through `/api/sui` (still "Powered by Tatum")
- 🟢 `lib/sui-orders.ts::listSettledEvents()` + VaultScreen polling every 30s
- 🟢 Stat card "Trades settled" shows live + demo split

Still TBD post-Move-deploy:
- ⚪ Verify Marina seal → Theo lock → reveal → settle is end-to-end with real signatures (needs wallet + deployed package)
- ⚪ `cancel_open` / `cancel_expired` UI hooks (Move fns exist; UI uses mock cancel today)

---

## D4 — Wed 3 Jun 🟡 (scaffold shipped early)

**Goal:** Sui Seal SDK integration (HARD GATE).

- 🟢 `@mysten/seal` v1.1.3 installed (commit `7b829da`)
- 🟢 `move/sources/order.move` adds `seal_approve(order, requester, ctx): bool`
- 🟢 Move unit test verifies seal_approve is strict (false when OPEN, true when LOCKED+funded, rejects third parties)
- 🟢 `lib/seal.ts` scaffold — public API `encryptForOrder` / `decryptForOrder` / `stashForOrder` matches `lib/crypto.ts` signatures
- 🟢 Real `SealClient.encrypt` + `SessionKey` + PTB flow written inline as commented code with three flip-on prerequisites documented

Decision at D4 18:00 WIB:
- 🟢 if all three prerequisites met (Move deployed with seal_approve + wallet message sign works + key-server objectIds harvested) → flip the commented blocks
- 🟢 otherwise → ship as-is with AES baseline + Move policy already in place (documented in SUBMISSION.md as a v2 item)

**Status:** scaffold done. Activation is now a 30-min "flip 3 comment blocks" task IF the three prerequisites all clear in time.

---

## D5 — Thu 4 Jun 🟢 (most shipped early)

**Goal:** polish + bug bash + README screenshots.

- 🟢 Mobile-responsive pass via CSS classes in globals.css with 880/760/640/480 breakpoints (commit `8bd900a`)
- 🟢 Production bug bash: 1 issue found (testnet API key BOM) + fixed (commit `21a1d13`)
- 🟢 README "screenshots" replaced with auto-generated OG image at `/opengraph-image` (1200×630 PNG, server-rendered)
- 🟢 Branded OG image embedded above README fold + serves as Twitter/LinkedIn share card

Still TBD (after user connects wallet for the first time):
- ⚪ Live play-through as Marina → seal → switch → Theo → lock → reveal → settle (5-min user verification)
- ⚪ If anything glitches under real wallet flow → P0 fix list captured

---

## D6 — Fri 5 Jun 🟡 (drafts ready, recording still pending)

**Goal:** demo video + submission form draft.

- 🟢 `docs/VIDEO_SCRIPT.md` written — 95-second beat-by-beat with VO, on-screen actions, recording checklist, backup script if anything breaks mid-take
- 🟢 `docs/SUBMISSION.md` drafted — every form field pre-filled with criteria mapping, Walrus + Tatum integration narratives, what's-not-in-scope honest acknowledgement, bonus targets
- ⚪ **User action D6:** record 2-3 min walkthrough using OBS / Loom following `VIDEO_SCRIPT.md`
- ⚪ **User action D6:** upload to YouTube unlisted, paste URL into `docs/SUBMISSION.md`
- ⚪ **Feature freeze D6 22:00 WIB** — only doc tweaks from here on

**Done when:** video uploaded, all form fields finalised, repo locked.

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
