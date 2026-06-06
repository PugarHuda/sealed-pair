// scripts/seed-takers.mjs
//
// Populate the live board with REAL taker activity:
//   - Generate a deterministic 2nd keypair (the "taker" persona)
//   - Fund it from the primary seed keypair (so it has SUI for escrow + gas)
//   - Pick a handful of OPEN orders that haven't expired
//   - lock_with_escrow them → OrderLocked event hits the maker inbox
//   - mark_revealed + settle a couple → SETTLED events populate the Vault
//
// Why this matters: with only one keypair seeding the board, every order is
// posted by 0xe9cc and the Vault stays empty. After this script runs:
//   - Maker inbox for the primary keypair shows lockedCount > 0
//   - Vault shows SETTLED rows with real digest + SuiScan deep-link
//   - Activity ticker on the board fires all 5 OrderEvent types live
//
// Usage:
//   node scripts/seed-takers.mjs                 # lock 3 + settle 1
//   node scripts/seed-takers.mjs --locks 5       # custom lock count
//   node scripts/seed-takers.mjs --settles 2     # custom settle count
//   node scripts/seed-takers.mjs --dry           # show plan without executing
//
// Prereqs:
//   - Primary keypair in ~/.sui/sui_config/sui.keystore with > 5 SUI
//   - Move package id in .env.local (NEXT_PUBLIC_SEALED_PAIR_PACKAGE_ID)

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { fromBase64 } from "@mysten/sui/utils";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { Transaction } from "@mysten/sui/transactions";

const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

const argv = process.argv.slice(2);
const arg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const has = (n) => argv.includes(n);

const NUM_LOCKS = Number(arg("--locks")) || 3;
const NUM_SETTLES = Number(arg("--settles")) || 1;
const DRY = has("--dry");

const NETWORK = "devnet";
const RPC_URL = getJsonRpcFullnodeUrl(NETWORK);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const envFile = path.join(repoRoot, ".env.local");

// Deterministic 2nd-keypair derivation: SHA-256 of a fixed phrase produces
// the same 32-byte seed every run, so we don't lose track of the address
// across reruns. NOT a security boundary — devnet only, throwaway funds.
const TAKER_SEED_PHRASE = "sealed-pair-demo-taker-keypair-v1-devnet-only-throwaway";

function readDotEnv(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z][A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^﻿/, "").trim();
  }
  return out;
}

function readPrimaryKeypair() {
  const keystore = path.join(os.homedir(), ".sui", "sui_config", "sui.keystore");
  const keys = JSON.parse(fs.readFileSync(keystore, "utf8"));
  const raw = fromBase64(keys[0]);
  if (raw[0] !== 0x00) throw new Error("Expected ed25519 key");
  return Ed25519Keypair.fromSecretKey(raw.slice(1));
}

async function deriveTakerKeypair() {
  const enc = new TextEncoder().encode(TAKER_SEED_PHRASE);
  const hash = await import("node:crypto").then((m) => m.webcrypto.subtle.digest("SHA-256", enc));
  return Ed25519Keypair.fromSecretKey(new Uint8Array(hash));
}

function envOrDie(env, key) {
  const v = env[key];
  if (!v) { console.error(`${RED}Missing ${key} in .env.local${RESET}`); process.exit(1); }
  return v;
}

async function getBalanceSui(client, addr) {
  const r = await client.getBalance({ owner: addr });
  return Number(r.totalBalance) / 1e9;
}

/** Find OPEN orders we can take. Returns list of {orderId, blobId, escrowMist, makerAddr, expiryEpoch}. */
async function findTakeable(client, packageId, currentEpoch, takerAddr) {
  console.log(`${CYAN}scanning OrderPosted events…${RESET}`);
  const posted = await client.queryEvents({
    query: { MoveEventType: `${packageId}::order::OrderPosted` },
    limit: 50,
    order: "descending",
  });
  console.log(`  found ${posted.data.length} posted events`);

  // For each event, hydrate the order object to read state + expiry + escrow.
  const orderIds = posted.data
    .map((e) => /** @type {any} */(e.parsedJson)?.order_id)
    .filter(Boolean)
    .slice(0, 30); // cap so we don't blow up
  if (!orderIds.length) return [];

  const objs = await client.multiGetObjects({
    ids: orderIds,
    options: { showContent: true, showType: true },
  });

  const takeable = [];
  for (const o of objs) {
    const fields = /** @type {any} */(o.data?.content)?.fields;
    if (!fields) continue;
    const state = Number(fields.state);
    const expiryEpoch = Number(fields.expiry_epoch);
    const escrowRequired = BigInt(fields.escrow_required ?? 0);
    const targetTaker = fields.target_taker; // optional<address>
    const orderId = o.data?.objectId;
    const makerAddr = fields.maker;
    const blobId = fields.blob_id;
    if (state !== 0) continue;                          // not OPEN
    if (!Number.isFinite(expiryEpoch) || currentEpoch >= expiryEpoch) continue; // expired
    // skip private orders unless they happen to target our 2nd keypair
    if (targetTaker && typeof targetTaker === "object" && targetTaker.vec?.length) {
      const t = targetTaker.vec[0];
      if (t && t.toLowerCase() !== takerAddr.toLowerCase()) continue;
    }
    // Cap by escrow size — taker has ~3 SUI; want to lock 3-5 orders total
    // so per-order escrow ceiling is ~0.5 SUI.
    if (escrowRequired > 500_000_000n) continue;        // > 0.5 SUI → skip
    if (escrowRequired === 0n) continue;
    takeable.push({ orderId, blobId, escrowRequired, makerAddr, expiryEpoch });
  }
  return takeable;
}

async function fundTakerIfLow(client, primary, takerAddr, currentBalance) {
  const MIN_SUI = 1.0;
  const FUND_SUI = 3.0;
  if (currentBalance >= MIN_SUI) {
    console.log(`  taker has ${currentBalance.toFixed(3)} SUI — funding skipped`);
    return null;
  }
  console.log(`${CYAN}funding taker with ${FUND_SUI} SUI from primary…${RESET}`);
  const tx = new Transaction();
  const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(BigInt(Math.floor(FUND_SUI * 1e9)))]);
  tx.transferObjects([coin], tx.pure.address(takerAddr));
  if (DRY) { console.log(`  ${DIM}(dry-run skip)${RESET}`); return null; }
  const res = await client.signAndExecuteTransaction({
    signer: primary,
    transaction: tx,
    options: { showEffects: true },
  });
  if (res.effects?.status?.status !== "success") {
    throw new Error(`Funding failed: ${JSON.stringify(res.effects?.status)}`);
  }
  console.log(`  ${GREEN}ok${RESET} digest ${DIM}${res.digest.slice(0, 12)}…${RESET}`);
  await client.waitForTransaction({ digest: res.digest });
  await new Promise((r) => setTimeout(r, 1500)); // settle propagation
  return res.digest;
}

async function lockOrder(client, taker, packageId, order) {
  // lock_with_escrow needs an EXACT-sized SUI coin = order.escrowRequired.
  const tx = new Transaction();
  const [escrowCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(order.escrowRequired)]);
  tx.moveCall({
    target: `${packageId}::order::lock_with_escrow`,
    arguments: [tx.object(order.orderId), escrowCoin, tx.object("0x6")],
  });
  if (DRY) { return { digest: "DRY", skipped: true }; }
  const res = await client.signAndExecuteTransaction({
    signer: taker,
    transaction: tx,
    options: { showEffects: true },
  });
  if (res.effects?.status?.status !== "success") {
    throw new Error(`lock failed: ${JSON.stringify(res.effects?.status)}`);
  }
  await client.waitForTransaction({ digest: res.digest });
  return { digest: res.digest };
}

async function revealAndSettle(client, taker, packageId, order) {
  // mark_revealed → settle in two separate txs (reveal needs LOCKED state
  // visible to fullnode; we just waited for lock above, so it's safe).
  if (DRY) { return { reveal: "DRY", settle: "DRY" }; }
  const tx1 = new Transaction();
  tx1.moveCall({
    target: `${packageId}::order::mark_revealed`,
    arguments: [tx1.object(order.orderId)],
  });
  const res1 = await client.signAndExecuteTransaction({
    signer: taker,
    transaction: tx1,
    options: { showEffects: true },
  });
  if (res1.effects?.status?.status !== "success") {
    throw new Error(`reveal failed: ${JSON.stringify(res1.effects?.status)}`);
  }
  await client.waitForTransaction({ digest: res1.digest });
  await new Promise((r) => setTimeout(r, 800));

  const tx2 = new Transaction();
  tx2.moveCall({
    target: `${packageId}::order::settle`,
    arguments: [tx2.object(order.orderId)],
  });
  const res2 = await client.signAndExecuteTransaction({
    signer: taker,
    transaction: tx2,
    options: { showEffects: true },
  });
  if (res2.effects?.status?.status !== "success") {
    throw new Error(`settle failed: ${JSON.stringify(res2.effects?.status)}`);
  }
  await client.waitForTransaction({ digest: res2.digest });
  return { reveal: res1.digest, settle: res2.digest };
}

async function main() {
  const env = readDotEnv(envFile);
  const PACKAGE_ID = envOrDie(env, "NEXT_PUBLIC_SEALED_PAIR_PACKAGE_ID");
  const primary = readPrimaryKeypair();
  const taker = await deriveTakerKeypair();
  const primaryAddr = primary.getPublicKey().toSuiAddress();
  const takerAddr = taker.getPublicKey().toSuiAddress();
  const client = new SuiJsonRpcClient({ url: RPC_URL });

  console.log(`${CYAN}=== seed-takers ===${RESET}`);
  console.log(`network:       ${NETWORK}`);
  console.log(`package:       ${PACKAGE_ID}`);
  console.log(`primary maker: ${primaryAddr}`);
  console.log(`taker (gen'd): ${takerAddr}`);
  if (DRY) console.log(`${YELLOW}DRY RUN — no transactions will be sent${RESET}`);

  const sys = await client.getLatestSuiSystemState();
  const currentEpoch = Number(sys.epoch);
  console.log(`current epoch: ${currentEpoch}`);

  const primaryBalance = await getBalanceSui(client, primaryAddr);
  const takerBalance = await getBalanceSui(client, takerAddr);
  console.log(`primary balance: ${primaryBalance.toFixed(3)} SUI`);
  console.log(`taker balance:   ${takerBalance.toFixed(3)} SUI`);

  await fundTakerIfLow(client, primary, takerAddr, takerBalance);

  const takeable = await findTakeable(client, PACKAGE_ID, currentEpoch, takerAddr);
  console.log(`${GREEN}${takeable.length} takeable orders found${RESET} (state=OPEN, not expired, escrow ≤ 0.2 SUI)`);

  if (!takeable.length) {
    console.log(`${YELLOW}No takeable orders. Run scripts/seed-orders.mjs first.${RESET}`);
    return;
  }

  // Plan the work: lock N, settle K of those N.
  const lockTargets = takeable.slice(0, Math.min(NUM_LOCKS, takeable.length));
  const settleTargets = lockTargets.slice(0, Math.min(NUM_SETTLES, lockTargets.length));

  console.log(`\n${CYAN}plan:${RESET}`);
  console.log(`  lock ${lockTargets.length} orders`);
  console.log(`  settle ${settleTargets.length} of them (full happy path: lock → reveal → settle)`);

  const results = [];
  for (let i = 0; i < lockTargets.length; i++) {
    const o = lockTargets[i];
    const willSettle = i < settleTargets.length;
    console.log(`\n${CYAN}[${i + 1}/${lockTargets.length}] order ${o.orderId.slice(0, 10)}…${RESET}`);
    console.log(`  escrow_required: ${Number(o.escrowRequired) / 1e9} SUI`);
    console.log(`  maker:           ${o.makerAddr.slice(0, 12)}…`);
    try {
      const { digest } = await lockOrder(client, taker, PACKAGE_ID, o);
      console.log(`  lock:    ${GREEN}ok${RESET} ${DIM}${digest.slice(0, 12)}…${RESET}`);
      if (willSettle) {
        const { reveal, settle } = await revealAndSettle(client, taker, PACKAGE_ID, o);
        console.log(`  reveal:  ${GREEN}ok${RESET} ${DIM}${reveal.slice(0, 12)}…${RESET}`);
        console.log(`  settle:  ${GREEN}ok${RESET} ${DIM}${settle.slice(0, 12)}…${RESET}`);
        results.push({ orderId: o.orderId, lockDigest: digest, revealDigest: reveal, settleDigest: settle, settled: true });
      } else {
        results.push({ orderId: o.orderId, lockDigest: digest, settled: false });
      }
    } catch (e) {
      console.log(`  ${RED}fail${RESET}: ${e.message}`);
    }
  }

  console.log(`\n${CYAN}=== summary ===${RESET}`);
  for (const r of results) {
    console.log(`  ${r.orderId.slice(0, 12)}…  ${r.settled ? "SETTLED" : "LOCKED  "}  ${DIM}${(r.settleDigest || r.lockDigest).slice(0, 12)}…${RESET}`);
  }
  console.log(`\n${GREEN}done.${RESET} Open the maker inbox at /app — lockedCount should be > 0 now.`);
  console.log(`${DIM}Suiscan taker: https://suiscan.xyz/devnet/account/${takerAddr}${RESET}`);
}

main().catch((e) => {
  console.error(`${RED}fatal${RESET}: ${e.message}`);
  process.exit(1);
});
