# Sui CLI install — Windows happy path

> Goal: have `sui --version` printing in PowerShell within ~15 minutes, then run `.\scripts\deploy-move.ps1`.

## Fastest path (precompiled binary, no Rust)

1. Open the latest **testnet** release on GitHub:
   <https://github.com/MystenLabs/sui/releases?q=testnet>
2. Download the asset whose name matches your machine. On 64-bit Windows that's the file with **`windows-x86_64.tgz`** in its name (e.g. `sui-testnet-v1.42.0-windows-x86_64.tgz`).
3. Right-click → **Extract All…** to a permanent folder, e.g. `C:\sui\`.
   Inside you'll see `sui.exe`, `sui-bridge.exe`, etc.
4. Add `C:\sui\` (or wherever you extracted) to your **PATH**:
   - Start menu → "Environment Variables" → **Edit the system environment variables**
   - Click **Environment Variables…** → under *User variables*, select **Path** → **Edit** → **New** → paste `C:\sui\`
   - OK out of every dialog
5. **Close and reopen** your PowerShell window so it picks up the new PATH
6. Verify:
   ```powershell
   sui --version
   ```
   Expected: something like `sui 1.42.0-…`

If `sui --version` still says "not recognised", the PATH didn't pick up — close *every* PowerShell window (including the one this CLI is in) and reopen. If you're in a Claude Code session, you may need to restart the session itself for it to inherit the new PATH.

---

## Configure for testnet

```powershell
# Tell the CLI which networks exist; this creates ~/.sui/sui_config/client.yaml
sui client new-env --alias testnet --rpc https://sui-testnet.gateway.tatum.io
sui client switch --env testnet

# Create a fresh keypair for this hackathon (don't reuse a mainnet wallet)
sui client new-address ed25519
sui client active-address

# Get free test SUI
sui client faucet
```

The faucet message will say "Request successful. SUI delivered to <address>". Give it ~10 seconds, then:

```powershell
sui client gas
```

You should see a `Coin` row with ~1 SUI balance. If empty, run `sui client faucet` again.

---

## Deploy the Sealed Pair Move package

From the repo root:

```powershell
.\scripts\deploy-move.ps1
```

The script will:
1. Build the package (`sui move build --path move`)
2. Publish (`sui client publish --gas-budget 200000000`)
3. Parse the output JSON for `PackageID`
4. Write `NEXT_PUBLIC_SEALED_PAIR_PACKAGE_ID=0x…` into `.env.local`

Once that's done, push the new env var to Vercel and redeploy:

```powershell
.\scripts\setup-vercel-env.ps1 -Environments production
vercel --prod
```

After Vercel finishes redeploying (~30s), the RFQ board at <https://sealed-pair.vercel.app/app> will start auto-merging real `OrderPosted` events from your Move package via `suix_queryEvents` through Tatum.

---

## Troubleshooting

- **`sui client publish` says insufficient gas** — run `sui client faucet` once more, then retry. Default budget is 200000000 MIST = 0.2 SUI.
- **`sui move build` complains about edition** — verify `move/Move.toml` has `edition = "2024.beta"` and the Sui dep `rev = "framework/testnet"`. Both are set by default in this repo.
- **`Cannot find module sui`** — your CLI version is too old. Delete the old folder, redownload the latest testnet release.
- **Want to test without deploying yet** — run `sui move test --path move` to execute the unit tests in `move/tests/order_tests.move`.
