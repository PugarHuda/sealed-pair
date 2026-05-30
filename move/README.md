# Sealed Pair — Move Package

On-chain skeleton for the Sealed Pair OTC platform. One module: `sealed_pair::order`.

## What's in the box

- **`Order`** shared object — holds the Walrus `blob_id` commitment, the Seal `policy_id`, the state machine, and the SUI escrow `Balance`.
- **Lifecycle:** `OPEN → LOCKED → REVEALED → SETTLED` plus a `CANCELLED` terminal state reachable from `OPEN` (maker withdraw) or `OPEN | LOCKED` (expiry).
- **Events** for indexing: `OrderPosted`, `OrderLocked`, `OrderRevealed`, `OrderSettled`, `OrderCancelled`.
- **Entry functions:**
  - `create_offer(blob_id, policy_id, give, get, escrow_required, expiry_epoch, ctx)`
  - `lock_with_escrow(order, payment, clock, ctx)`
  - `mark_revealed(order, ctx)`
  - `settle(order, ctx)`
  - `cancel_open(order, ctx)`
  - `cancel_expired(order, ctx)`

V1 fixes the escrow asset to `SUI`. V2 will go generic on `Coin<T>` and add full both-leg atomic swap inside `settle`.

---

## 1. Install the Sui CLI (Windows)

The repo doesn't include a binary. Pick the fastest path for your machine:

### Option A — Pre-built binary (recommended on Windows)

1. Open the latest **testnet** release: <https://github.com/MystenLabs/sui/releases?q=testnet>
2. Download `sui-testnet-*-windows-x86_64.tgz`
3. Extract anywhere (e.g. `C:\sui\`)
4. Add the folder to `PATH` (or copy `sui.exe` to a directory already in PATH)
5. Verify:

```powershell
sui --version
```

### Option B — Build from source (slow, takes ~15 min)

```powershell
# Needs Rust toolchain installed first (https://rustup.rs)
cargo install --locked --git https://github.com/MystenLabs/sui.git --branch testnet sui
```

### Option C — Chocolatey (sometimes lags upstream)

```powershell
choco install sui
```

---

## 2. One-time wallet setup

```powershell
# Tell the CLI which networks exist; this also creates ~/.sui/sui_config/client.yaml
sui client new-env --alias testnet --rpc https://sui-testnet.gateway.tatum.io
sui client new-env --alias mainnet --rpc https://sui-mainnet.gateway.tatum.io

# Switch to testnet for the deploy
sui client switch --env testnet

# Create a fresh address (or import an existing one with `sui keytool import`)
sui client new-address ed25519
sui client active-address

# Get test SUI from the faucet
sui client faucet
```

---

## 3. Build + deploy

From the project root:

```powershell
# Compile
sui move build --path move

# Publish (testnet)
sui client publish --gas-budget 200000000 move
```

The output contains a line like:

```
PackageID: 0xabc123...
```

Copy that value and add it to `.env.local` at the repo root:

```dotenv
NEXT_PUBLIC_SEALED_PAIR_PACKAGE_ID=0xabc123...
```

The Next.js frontend reads this via `lib/sui-orders.ts` to construct programmable transaction blocks against the deployed module.

Or use the helper:

```powershell
.\scripts\deploy-move.ps1
```

which runs `build` → `publish` → extracts the `PackageID` → updates `.env.local` automatically.

---

## 4. Run the unit tests (optional)

```powershell
sui move test --path move
```
