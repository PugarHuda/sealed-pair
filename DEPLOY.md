# Deploy Sealed Pair to Vercel

Two paths. Pick whichever fits your workflow.

---

## Path A — CLI (fastest, ~3 minutes)

```powershell
# 1. Authenticate (one-time, browser opens for ~30s)
vercel login

# 2. Link this directory to a new Vercel project
vercel link --yes

# 3. Push every env var from .env.local to all three environments
.\scripts\setup-vercel-env.ps1

# 4. Deploy a preview build — Vercel prints a share-able URL when done
vercel deploy

# 5. Promote to production when ready
vercel --prod
```

That's it. Vercel detects Next.js 14 automatically. The three serverless routes
(`/api/sui`, `/api/health`, `/api/walrus/*`) become **Fluid Compute functions**
on Node.js 24 LTS — same proxy code, just running on Vercel's edge instead of
your laptop.

---

## Path B — GitHub + Vercel dashboard (best for ongoing work)

This setup gives you free **continuous deploys** — every push to `main`
auto-deploys production, every PR gets a preview URL.

### B.1 Push to GitHub

```powershell
gh repo create sealed-pair --public --source=. --push
```

(Needs `gh` CLI logged in. Alternative: create the repo via GitHub web UI, then
`git remote add origin … && git push -u origin master`.)

### B.2 Import into Vercel

1. Open <https://vercel.com/new>
2. **Import** your `sealed-pair` repo
3. Vercel detects Next.js — leave Build Command / Output Directory defaults
4. Click **Environment Variables** and add the keys below
5. Click **Deploy**

### B.3 Required env vars

| Variable | Value | Notes |
|---|---|---|
| `TATUM_API_KEY_MAINNET` | `t-…cb305` | **Sensitive** — server-side only |
| `TATUM_API_KEY_TESTNET` | `t-…3324b` | **Sensitive** — server-side only |
| `SUI_NETWORK` | `mainnet` | Default network for `/api/sui` |
| `WALRUS_NETWORK` | `testnet` | Optional (defaults to testnet) |
| `NEXT_PUBLIC_SEALED_PAIR_PACKAGE_ID` | `0x…` | **Add after** running `scripts\deploy-move.ps1` |

The `NEXT_PUBLIC_` prefix is intentional only for the package id — it's a public
identifier baked into the client bundle so `lib/sui-orders.ts` can query events.
Everything else stays server-side.

---

## Post-deploy checklist

After your first preview URL is live:

- [ ] Hit `<preview-url>/api/health?network=mainnet` — should return `{ ok:true, chainId:"35834a8a", checkpoint:"…" }`
- [ ] Open `<preview-url>/app` — NetworkPill in the top-right should show a live checkpoint number
- [ ] Click "Seal a quote", fill the form, submit — ceremony should upload to Walrus testnet and print a real `blobId`
- [ ] Copy the blobId → paste `https://aggregator.walrus-testnet.walrus.space/v1/blobs/<blobId>` in another tab → should download ciphertext bytes
- [ ] Switch role to Theo → open your sealed quote → fund escrow → terms decrypt for real

---

## After the Move package is deployed

Once you've run `.\scripts\deploy-move.ps1` and the script auto-updated
`.env.local` with `NEXT_PUBLIC_SEALED_PAIR_PACKAGE_ID`:

```powershell
# Push the new env var to Vercel + redeploy
.\scripts\setup-vercel-env.ps1
vercel --prod
```

The RFQ board on the deployed site will now also show **live on-chain quotes**
read via `suix_queryEvents` through Tatum, refreshing every 30s.

---

## Troubleshooting

- **`vercel: command not found`** → `npm install -g vercel`
- **Build error on Vercel: missing env** → run `setup-vercel-env.ps1` again,
  then `vercel --prod --force` to invalidate the build cache.
- **`429` from Tatum on /api/health** — free tier is 3 req/sec across all
  endpoints. NetworkPill polls every 15s so it's fine; only an issue under
  unusual load. Upgrade Tatum plan if needed.
- **Walrus 5xx during demo** — the multi-publisher failover in `lib/walrus.ts`
  tries 3 testnet publishers in order. If all three are down (rare),
  `aggregator.walrus-testnet.walrus.space` is usually first to recover.
