// scripts/seed-orders.mjs
//
// Populate the live RFQ board with 3-5 real on-chain Order objects.
//
// Prerequisites (in order):
//   1. Move package deployed → NEXT_PUBLIC_SEALED_PAIR_PACKAGE_ID in .env.local
//   2. `sui client active-address` returns your keypair (the script reads
//      ~/.sui/sui_config/sui.keystore for the private key)
//   3. `sui client faucet` has dropped some testnet SUI on that address
//
// Usage:
//   node scripts/seed-orders.mjs               # 3 orders, defaults
//   node scripts/seed-orders.mjs --count 5     # 5 orders
//
// What happens per order:
//   - Random terms (pair, amount, price) generated
//   - AES-256-GCM encrypts the terms locally (matches what the app does)
//   - Ciphertext PUTs to the Walrus testnet publisher (real blob)
//   - Move call `create_offer` registers the Order on Sui testnet
//   - Tx digest + Order object id + blob id printed
//
// The deployed prototype's RFQ board polls `suix_queryEvents` every 30s,
// so the new orders surface there automatically after ~30s.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { webcrypto } from "node:crypto";
import { fromBase64 } from "@mysten/sui/utils";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { Transaction } from "@mysten/sui/transactions";

const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

const argv = process.argv.slice(2);
const COUNT = Number(argv[argv.indexOf("--count") + 1]) || 3;
const WALRUS_PUBLISHER = "https://publisher.walrus-testnet.walrus.space";
const TATUM_TESTNET_URL = "https://sui-testnet.gateway.tatum.io";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..").replace(/^\/(\w):/, "$1:");
const envFile = path.join(repoRoot, ".env.local");

function readDotEnv(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z][A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^﻿/, "").trim();
  }
  return out;
}

function readSuiKeypair() {
  // Default keystore path on Windows ($USERPROFILE\.sui\sui_config) and Unix ($HOME/.sui/sui_config)
  const keystore = path.join(os.homedir(), ".sui", "sui_config", "sui.keystore");
  if (!fs.existsSync(keystore)) {
    throw new Error(`Sui keystore not found at ${keystore}. Run 'sui client new-address ed25519' first.`);
  }
  const keys = JSON.parse(fs.readFileSync(keystore, "utf8"));
  if (!Array.isArray(keys) || keys.length === 0) throw new Error("Empty keystore");
  // Each entry is base64 of 1 (ed25519 flag) + 32 secret bytes
  const raw = fromBase64(keys[0]);
  if (raw[0] !== 0x00) throw new Error("Expected ed25519 key (flag 0x00) as first key");
  return Ed25519Keypair.fromSecretKey(raw.slice(1));
}

async function aesEncrypt(text) {
  const subtle = webcrypto.subtle;
  const key = await subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(
    await subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(text)),
  );
  const out = new Uint8Array(iv.length + cipher.length);
  out.set(iv, 0);
  out.set(cipher, iv.length);
  return out;
}

async function uploadToWalrus(bytes) {
  const res = await fetch(`${WALRUS_PUBLISHER}/v1/blobs?epochs=4`, {
    method: "PUT",
    body: bytes,
    headers: { "Content-Type": "application/octet-stream" },
  });
  if (!res.ok) throw new Error(`Walrus ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.newlyCreated?.blobObject?.blobId ?? json.alreadyCertified?.blobId;
}

function randomQuote() {
  const pairs = [
    { give: "SUI", get: "USDC", priceRange: [3.8, 4.05] },
    { give: "USDC", get: "SUI", priceRange: [0.247, 0.262] },
    { give: "WAL", get: "USDC", priceRange: [0.58, 0.63] },
    { give: "SUI", get: "USDT", priceRange: [3.85, 4.0] },
    { give: "USDC", get: "DEEP", priceRange: [0.039, 0.043] },
  ];
  const p = pairs[Math.floor(Math.random() * pairs.length)];
  const amount = Math.round(10_000 + Math.random() * 90_000);
  const price = Number((p.priceRange[0] + Math.random() * (p.priceRange[1] - p.priceRange[0])).toFixed(3));
  return { give: p.give, get: p.get, amount, price, counter: Math.round(amount * price) };
}

async function main() {
  console.log(`${CYAN}=== Sealed Pair seed-orders ===${RESET}`);
  const env = readDotEnv(envFile);
  const packageId = env.NEXT_PUBLIC_SEALED_PAIR_PACKAGE_ID;
  if (!packageId) {
    console.error(`${RED}✗ NEXT_PUBLIC_SEALED_PAIR_PACKAGE_ID not set in .env.local${RESET}`);
    console.error("  Run .\\scripts\\deploy-move.ps1 first.");
    process.exit(1);
  }
  console.log(`${DIM}package: ${packageId}${RESET}`);

  const keypair = readSuiKeypair();
  const address = keypair.toSuiAddress();
  console.log(`${DIM}address: ${address}${RESET}`);

  const client = new SuiJsonRpcClient({
    network: "testnet",
    url: TATUM_TESTNET_URL,
    // We don't have x-api-key support out-of-the-box in the SDK transport,
    // but the gateway accepts unauthenticated reads at low rate. For writes
    // we'd want to pipe through /api/sui; the user-facing app already does.
  });

  console.log(`\n${CYAN}=== seeding ${COUNT} orders ===${RESET}`);
  const created = [];
  for (let i = 1; i <= COUNT; i++) {
    const q = randomQuote();
    console.log(`\n[${i}/${COUNT}] ${q.give} → ${q.get}, ${q.amount} @ ${q.price}`);

    process.stdout.write("  encrypt + walrus upload… ");
    const plaintext = JSON.stringify({ ...q, minFill: Math.round(q.amount * 0.25), v: 1 });
    const cipher = await aesEncrypt(plaintext);
    const blobId = await uploadToWalrus(cipher);
    console.log(`${GREEN}ok${RESET} ${DIM}${blobId.slice(0, 16)}…${RESET}`);

    process.stdout.write("  create_offer ptb…       ");
    const escrowMist = q.give === "SUI"
      ? BigInt(Math.max(1_000_000, Math.floor(q.amount * 0.05 * 1e9)))
      : BigInt(Math.max(1_000_000, Math.floor(q.counter * 0.02 * 1e6)));
    const expiryEpoch = BigInt(Number.MAX_SAFE_INTEGER);
    const policyId = "0x" + "00".repeat(31) + "01"; // placeholder until Seal SDK fully wired

    const tx = new Transaction();
    tx.moveCall({
      target: `${packageId}::order::create_offer`,
      arguments: [
        tx.pure.vector("u8", Array.from(new TextEncoder().encode(blobId))),
        tx.pure.id(policyId),
        tx.pure.vector("u8", Array.from(new TextEncoder().encode(q.give))),
        tx.pure.vector("u8", Array.from(new TextEncoder().encode(q.get))),
        tx.pure.u64(escrowMist),
        tx.pure.u64(expiryEpoch),
      ],
    });

    try {
      const result = await client.signAndExecuteTransaction({
        signer: keypair,
        transaction: tx,
        options: { showObjectChanges: true, showEffects: true },
      });
      const orderObj = result.objectChanges?.find(
        (c) => c.type === "created" && c.objectType?.endsWith("::order::Order"),
      );
      console.log(`${GREEN}ok${RESET} digest ${DIM}${result.digest.slice(0, 12)}…${RESET}`);
      created.push({
        n: i,
        give: q.give,
        get: q.get,
        amount: q.amount,
        digest: result.digest,
        orderId: orderObj?.objectId ?? "?",
        blobId,
      });
    } catch (e) {
      console.log(`${RED}fail${RESET} ${e.message?.slice(0, 80) ?? e}`);
    }
  }

  console.log(`\n${CYAN}=== summary ===${RESET}`);
  console.log("| n | pair        | amount  | order id              | tx digest             | blob id              |");
  console.log("|---|-------------|---------|-----------------------|-----------------------|----------------------|");
  for (const o of created) {
    const pair = `${o.give} → ${o.get}`.padEnd(11);
    const amt = String(o.amount).padEnd(7);
    const oid = (o.orderId.slice(0, 6) + "…" + o.orderId.slice(-4)).padEnd(21);
    const dig = (o.digest.slice(0, 6) + "…" + o.digest.slice(-4)).padEnd(21);
    const bid = (o.blobId.slice(0, 6) + "…" + o.blobId.slice(-4)).padEnd(20);
    console.log(`| ${o.n} | ${pair} | ${amt} | ${oid} | ${dig} | ${bid} |`);
  }
  console.log(`\n${GREEN}done.${RESET} board polls every 30s — refresh https://sealed-pair.vercel.app/app shortly.`);
}

main().catch((e) => {
  console.error(`${RED}fatal:${RESET}`, e);
  process.exit(1);
});
