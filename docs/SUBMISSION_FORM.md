# Tatum × Walrus Hackathon — Google Form Submission Answers

> Copy-paste ready. Open the form, paste each section into its matching field.
>
> **Form URL:** (Tatum Discord pinned post or direct hackathon page)
> **Deadline:** 2026-06-06 17:00 UTC

---

## 1. Email

```
hudapugar@gmail.com
```

---

## 2. Tatum account ID

> *(Dashboard bottom-left, looks like a hex string.)*

```
6a096f50e1aa253232944f0f
```

*(Derived from `TATUM_API_KEY_*` env vars — Tatum keys are formatted
`t-<accountId>-<keyId>`. Confirm against the dashboard before submitting.)*

---

## 3. Project description

```
Sealed Pair — sealed peer-to-peer OTC trading on Sui.

Today's OTC trading forces a brutal trade-off: post on a DEX and the
mempool front-runs your size, or call a desk and trust them with the
spread. Both leak information; neither leaves a clean audit trail.

Sealed Pair is a third option. Makers encrypt their terms locally and
upload the ciphertext to Walrus — the blobId IS the on-chain
cryptographic commitment (BLAKE2b hash of the ciphertext stored in the
Move Order object). The sealed quote hits a public RFQ board where
takers see only the size band. A taker funds a refundable escrow on Sui;
the escrow is the proof-of-intent that satisfies a Seal-style access
policy. The instant the policy condition is met, the AES key releases,
terms decrypt for both parties, and a single atomic Programmable
Transaction Block moves both legs of the trade. The receipt is on-chain
forever.

Private quotes. Public settlement. No front-running. No middleman.

40 features shipped across 14 days as a solo build. 14 distinct Sui RPC
methods through the Tatum gateway. 5 Move PTBs wired live on Sui devnet
with 25+ OPEN orders + 2 SETTLED rows verifiable on SuiScan. 3 Walrus
publishers + 3 aggregators with HTTP failover. 4 Sui-native MCP tools
that fill a real gap (Tatum's own MCP doesn't yet expose Sui Blockchain
Data tools — Sui is only reachable via gateway_execute_rpc raw RPC).

Live demo:  https://sealed-pair.vercel.app
Pitch deck: https://sealed-pair.vercel.app/slide
GitHub:     https://github.com/PugarHuda/sealed-pair
Move pkg:   0x73d1acdda1d468d49e340023e7c3cc578466327dfa6109d93c5ce767640c99eb (devnet)
```

---

## 4. Demo video (2-3 min YouTube link)

```
https://youtu.be/<UPLOAD-AND-PASTE-HERE>
```

*(Upload `docs/pitch.mp4` or record fresh per `VIDEO_SCRIPT.md`. Set
visibility to **Unlisted** so reviewers can watch without it indexing.
After upload, copy the short share URL.)*

**Action checklist before submitting:**
- [ ] Video uploaded
- [ ] Visibility set to **Unlisted** (not Private — reviewers wouldn't be able to view)
- [ ] Watched the upload through once to confirm audio + visuals OK
- [ ] Copied the `youtu.be/...` short URL into the form

---

## 5. GitHub repo

```
https://github.com/PugarHuda/sealed-pair
```

---

## 6. Walrus experience feedback

```
📄 Documentation

The HTTP API spec at https://docs.wal.app/usage/web-api.html is exactly
what an integrator needs — three endpoints (PUT blobs, GET blobs, GET
blobs/by-object-id), clear examples, accurate response shapes. We
discovered the blobs/by-object-id reverse-lookup ourselves from the
spec; it became one of the most-used surfaces in our app (you can
paste a Sui object id and see the underlying Walrus blob).

🛠️ Developer Tools

The public testnet publisher + aggregator endpoints were rock-solid
throughout the build. We added our own multi-publisher / multi-
aggregator failover wrapper (3 + 3 hosts), but the primaries handled
every PUT we threw at them. Latency was consistently sub-500ms.

🐛 Bugs or limitations

Nothing genuinely broke. Two friction points worth flagging:

1. blobId encoding — the spec shows the URL-safe base64 form but some
   SDK paths returned the raw form. We normalized client-side. A docs
   call-out distinguishing the two would help.
2. CORS on the public aggregators was permissive enough for read calls
   from a browser, but a PUT to the public publisher from the browser
   needed a server-side proxy (gas + CORS). That's correct security
   posture, but a "browser → publisher direct, what's allowed" docs
   section would save integrators an hour.

💡 What could be improved?

A first-class "Walrus as a commitment scheme" guide. The blobId being
BLAKE2b of the ciphertext is what made our project work — we treat
Walrus as a content-addressed cryptographic commitment, not as a CDN.
Right now an integrator has to derive that property from the spec; a
docs section that frames Walrus as a commitment primitive (with a Move
example storing blobId on-chain) would unlock a whole pattern of
applications.

Second: a Move helper module for blobId-on-chain patterns (verify-blob,
expected-hash assertions). We rolled our own; a Sui-native package
would be a powerful primitive.
```

---

## 7. Additional documentation

```
SUBMISSION.md  — https://github.com/PugarHuda/sealed-pair/blob/master/SUBMISSION.md
README.md      — https://github.com/PugarHuda/sealed-pair#sealed-pair
Pitch deck     — https://sealed-pair.vercel.app/slide
Video script   — https://github.com/PugarHuda/sealed-pair/blob/master/VIDEO_SCRIPT.md
Slide script   — https://github.com/PugarHuda/sealed-pair/blob/master/docs/SLIDE_SCRIPT.md
ROADMAP        — https://github.com/PugarHuda/sealed-pair/blob/master/ROADMAP.md
QA report      — https://github.com/PugarHuda/sealed-pair/blob/master/docs/QA_REPORT.md
Deploy guide   — https://github.com/PugarHuda/sealed-pair/blob/master/DEPLOY.md
MCP catalog    — https://sealed-pair.vercel.app/api/mcp
MCP client cfg — https://github.com/PugarHuda/sealed-pair/blob/master/.mcp.json
```

---

## 8. LinkedIn

```
https://www.linkedin.com/in/<your-handle>/
```

*(Fill in your actual LinkedIn URL.)*

---

## 9. Discord handle

```
<your-discord-username>
```

*(e.g. `pugarhuda` or `pugar#0001` depending on your Discord setup.)*

---

## 10. Social post links (extra points)

> *(After posting on X/LinkedIn tagging @Tatum_io, @WalrusFoundation, @SuiNetwork.)*

```
X (Twitter):  https://x.com/<your-handle>/status/<post-id>
LinkedIn:     https://www.linkedin.com/posts/<your-handle>_<slug>
```

**Suggested X post body:**

```
just shipped Sealed Pair — sealed peer-to-peer OTC trading on Sui 🦭

🔒 maker encrypts terms locally → @WalrusFoundation blob (blobId IS the commitment)
🌊 sealed quote hits public RFQ board
⚛️ taker funds escrow → Seal auto-reveals → atomic PTB settles both legs

powered by @Tatum_io's Sui RPC gateway (14 distinct methods) + @SuiNetwork

private quotes. public settlement. no front-running.

live demo → https://sealed-pair.vercel.app
deck → https://sealed-pair.vercel.app/slide
github → https://github.com/PugarHuda/sealed-pair

#TatumXWalrus #BuildOnSui
```

**Suggested LinkedIn post body:**

```
🦭 Shipped Sealed Pair for the Tatum × Walrus hackathon — sealed
peer-to-peer OTC trading on Sui.

The problem: OTC trading today forces a brutal trade-off. Post on a
DEX and the mempool front-runs your size. Call a desk and trust them
with the spread. Neither leaves an audit trail.

The shape: maker encrypts terms locally → uploads ciphertext to Walrus
(the blobId IS the cryptographic commitment) → sealed quote hits a
public RFQ board → taker funds a refundable escrow on Sui → Seal-style
policy auto-releases the decryption key → one atomic Programmable
Transaction Block moves both legs → receipt on-chain forever.

What's underneath:
• 14 distinct Sui RPC methods via @Tatum_io's gateway
• Walrus testnet (3 publishers + 3 aggregators, multi-host failover)
• 5 Move PTBs deployed on Sui devnet, all wired live
• 40 features shipped solo in 14 days
• 4 Sui-native MCP tools that fill a real gap — Tatum's own MCP
  doesn't yet expose Sui Blockchain Data tools

Live demo: https://sealed-pair.vercel.app
Pitch deck: https://sealed-pair.vercel.app/slide

#TatumXWalrus #BuildOnSui #DeFi
```

---

## 11. Anything else you'd like to add?

```
Two notes for the judges:

1. Anti-mock discipline: every probe on the Integration Health panel
   hits real Tatum + real Walrus infrastructure. Every order on the
   RFQ board is a real on-chain Sui object. Every blobId resolves to
   real ciphertext on a Walrus aggregator. The only scaffold-only
   pieces are clearly disclosed in SUBMISSION.md's "anti-mock
   disclosure" section: Seal threshold release (the policy IS deployed
   on-chain, just uses sessionStorage for the key in V1), counter-
   offer index (real Walrus blobs, localStorage for the discovery
   index), and private-order enforcement (client-side gating; V2
   moves this into the Move struct).

2. Submission scope clarity: this is a 14-day solo build. The roadmap
   is in ROADMAP.md if you want to see what's next — but everything
   demoed in the video and visible at the live URL is shipped, tested,
   and verifiable on-chain today.

Thank you for running this hackathon — the combination of Walrus
content-addressing + Sui PTBs + Tatum's gateway is genuinely the right
toolkit for sealed financial primitives. Looking forward to building
more on this stack.
```

---

## Final pre-submit checklist

- [ ] Video uploaded to YouTube as **Unlisted**, link verified
- [ ] GitHub repo public (currently private? flip the toggle on GH)
- [ ] Tatum account ID double-checked against dashboard
- [ ] LinkedIn URL has the trailing slash / no typos
- [ ] Discord handle matches what's in the Tatum Discord server
- [ ] X + LinkedIn posts published BEFORE pasting their URLs in the form (so the URLs resolve when judges click)
- [ ] Hit submit BEFORE 17:00 UTC

*Time check: it's currently 2026-06-06. Cap is 17:00 UTC today.*
