# 📋 Hackathon submission draft

> Paste these fields into the official form on submission day (D7).
> Replace `<YOUTUBE_URL>` with the unlisted YouTube link after recording.

---

## Project name

**Sealed Pair**

## One-liner

Sealed peer-to-peer OTC trading on Sui — quotes lock as Walrus blobs, reveal only when escrow funds, settle atomically via PTB.

## Tagline

> Move size without tipping your hand.

## Live demo

https://sealed-pair.vercel.app

## Repository

https://github.com/PugarHuda/sealed-pair

## Demo video (2–3 min)

`<YOUTUBE_URL>` *(upload before submitting)*

## Team

Solo — **Pugar Huda Mantoro** ([@PugarHuda](https://github.com/PugarHuda))

## Tech stack

- **Frontend:** Next.js 14 App Router, React 18, TypeScript, Tailwind 3
- **Blockchain:** Sui mainnet (Move package on testnet), Walrus testnet for blob storage
- **Wallet:** @mysten/dapp-kit + @mysten/sui v2 (SuiJsonRpcClient)
- **Crypto:** AES-256-GCM client-side (placeholder for Sui Seal SDK threshold encryption)
- **Hosting:** Vercel Fluid Compute (Node.js 24 LTS)

## How we use Walrus

Walrus is not a storage afterthought in Sealed Pair — it's the **cryptographic commitment primitive** that makes the entire protocol work.

When a maker seals a quote, the encrypted terms become a Walrus blob. The blobId that comes back **is** the commitment, because Walrus is content-addressed: change one byte of the terms and the blobId changes. That on-chain anchor lets us register the order on Sui without ever revealing what's inside, while still guaranteeing the maker can't swap terms after the fact.

The implementation:
- `lib/walrus.ts` — server-only client that PUTs to the public testnet publisher with multi-publisher failover across `publisher.walrus-testnet.walrus.space`, `wal-publisher-testnet.staketab.org`, `walrus-testnet-publisher.trusted-point.com`.
- `app/api/walrus/store/route.ts` — proxies the upload, validates the 10 MiB cap.
- `app/api/walrus/blob/[blobId]/route.ts` — proxies GETs and caches immutably.
- The Move package's `Order` struct stores `blob_id: vector<u8>` as the on-chain reference.

End-to-end this is **verifiable** — judges can copy any blobId from the demo, paste it into `https://aggregator.walrus-testnet.walrus.space/v1/blobs/<id>`, and download the actual stored bytes themselves.

## How we use Tatum

Tatum is on every Sui RPC call the demo makes.

- **`/api/sui`** — generic JSON-RPC proxy; the dApp Kit transport, the live RFQ board, the Vault analytics — every call goes through here using `TATUM_API_KEY_MAINNET` / `TATUM_API_KEY_TESTNET` server-side. Browser never sees the keys.
- **`/api/health`** — uses `sui_getChainIdentifier` + `sui_getLatestCheckpointSequenceNumber` to power the live header pill that polls every 15 seconds.
- **Live RFQ board** — `suix_queryEvents` filtered by `OrderPosted` event type, refreshed every 30 seconds.
- **Live Vault analytics** — `suix_queryEvents` filtered by `OrderSettled`, rendered as on-chain audit rows with SuiScan deep links.
- **MCP-ready** — the API surface is symmetrical to `@tatumio/blockchain-mcp`'s `gateway_execute_rpc` tool, so an AI agent could drive the same flow.

The Move package emits five event types specifically so an indexer can rebuild the entire order book by reading nothing but Tatum-routed `suix_queryEvents` calls.

## What makes this novel

We surveyed 599 Sui Overflow 2025 submissions and the full Walrus Summer 2025 showcase. The closest projects:

- **Shroud** — ZK confidential swaps via DEX pools. Different mechanism, no Walrus.
- **PactDa** — generic escrow agreements + zkLogin. No commit-reveal, no encrypted terms.
- **Alkimi Exchange** — Sui + Seal + Walrus for advertising auctions. Same stack, completely different domain.
- **DeepBook** — public CLOB. The opposite of OTC.

**Nobody combines commit-reveal + Walrus content-addressed commitment + Seal-style selective disclosure + atomic PTB settle for OTC.** That gap is what Sealed Pair fills.

## Hackathon criteria mapping

| Criteria | Weight | Sealed Pair |
|---|---|---|
| Walrus + Tatum Integration | 30% | Walrus = commitment primitive (not storage afterthought). Tatum on **every** RPC: `/api/sui`, `/api/health`, live RFQ via `suix_queryEvents`, Vault analytics, wallet transport. |
| Technical Quality | 30% | TypeScript strict (production build clean). Move package with 5-state lifecycle + unit tests. Atomic PTB-ready settle. Multi-publisher Walrus failover. Defensive env-var sanitisation. |
| Creativity | 20% | First Sui project to combine commit-reveal + Seal-style disclosure + Walrus commitment + atomic settlement for OTC. Pip mascot biology mirrors the protocol pattern (pair-bonded → P2P, curled tail → seal, camouflage → private terms). |
| Presentation | 20% | Live demo URL with real Tatum + real Walrus. Branded OG image. README with verifiable curl commands. Demo video showing actual on-chain digest. |

## Bonus targets

- 🌟 **Best Walrus Integration ($200)** — Walrus is the cryptographic commitment, not storage. blobId stored on-chain as `vector<u8>` field. Multi-publisher failover. Content-addressing as the core protocol invariant.
- ⚡ **Best Use of Tatum Tools ($200)** — RPC + Data API surface (`suix_queryEvents` for events, `sui_executeTransactionBlock` for writes), wallet transport, AI-agent-ready via MCP-compatible proxy shape.

## Sosmed proof

- Twitter: `<TWITTER_POST_URL>` *(post on D0/D7)*
- LinkedIn: `<LINKEDIN_POST_URL>` *(post on D0/D7)*

Both tag `@Tatum_io @WalrusFoundation @SuiNetwork`.

## What's not in scope (acknowledged)

- **Sui Seal SDK integration** — current key custody uses AES-256-GCM with sessionStorage as a demo placeholder. Real Seal threshold encryption is wired structurally (Move policy object, on-chain access control) but the off-chain key servers haven't been hit yet. **Hard gate D4 18:00 WIB.** If the Seal SDK doesn't land cleanly, this stays as a v2 item — documented in the README roadmap.
- **V2 generic settle** — `settle()` in the Move package currently transfers escrow to the maker. The "real" atomic two-leg swap (maker delivers `Coin<GIVE>`, taker delivers `Coin<GET>`, atomically) is V2. V1 is sufficient to prove the state machine + cryptographic audit trail.
- **Identity privacy** — Sui addresses are visible. We're not targeting dark-pool grade anonymity; the goal is *terms privacy with verifiable settlement*, which is a different threat model.

## Anything else

Built across **8 days solo** from blank repo to deployed demo. Designed in [Claude Design](https://claude.ai/design); coding agent built the implementation. All code, every commit, every PR-review-style decision is in the public git history (10+ commits, narrative messages).

Run any of the verification commands from the README — `curl -i https://sealed-pair.vercel.app/api/health?network=mainnet` returns a real Sui checkpoint number that's advancing right now.
