// scripts/seed-orders.mjs
//
// Populate the live RFQ board with diverse, real on-chain Order objects.
// Each "case" exercises a different code path so the demo shows the full
// spectrum of UI states (whale, retail, stables, exotic pair, tight/wide
// spread, short/long expiry, BUY/SELL labelling, private targeted offer).
//
// Prerequisites (in order):
//   1. Move package deployed → NEXT_PUBLIC_SEALED_PAIR_PACKAGE_ID in .env.local
//   2. `sui client active-address` returns your keypair (the script reads
//      ~/.sui/sui_config/sui.keystore for the private key)
//   3. `sui client faucet` has dropped some testnet SUI on that address
//
// Usage:
//   node scripts/seed-orders.mjs                       # all 10 diverse cases
//   node scripts/seed-orders.mjs --count 5             # legacy random mode
//   node scripts/seed-orders.mjs --case whale          # one specific case
//   node scripts/seed-orders.mjs --target 0x...        # use as targetTaker
//                                                       for the private case
//   node scripts/seed-orders.mjs --list                # print available cases
//
// What happens per order:
//   - Terms generated according to the case archetype
//   - AES-256-GCM encrypts the terms locally (matches what the app does)
//   - Ciphertext PUTs to the Walrus testnet publisher (real blob)
//   - Move call `create_offer` registers the Order on Sui devnet
//   - Tx digest + Order object id + blob id printed
//
// The deployed prototype's RFQ board polls `suix_queryEvents` every 30s,
// so the new orders surface there automatically after ~30s.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { webcrypto } from "node:crypto";
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
const arg = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : null;
};
const has = (name) => argv.includes(name);

const LEGACY_COUNT = Number(arg("--count")) || null;
const ONE_CASE = arg("--case");
const TARGET_TAKER = arg("--target");
const LIST = has("--list");

const WALRUS_PUBLISHER = "https://publisher.walrus-testnet.walrus.space";
const NETWORK = "devnet";
const RPC_URL = "https://fullnode.devnet.sui.io:443";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const envFile = path.join(repoRoot, ".env.local");

/* ============================ case archetypes ============================
 * Each case is a named scenario the seed script produces. Together they
 * exercise the breadth of UI behaviour we need to show in a demo. */
const CASES = [
  {
    name: "whale-sui",
    desc: "Whale SELL · SUI → USDC · 250k size, huge escrow",
    terms: () => ({ give: "SUI", get: "USDC", amount: 250_000, price: 3.92 }),
    note: "Whale block — call desk for chunked execution.",
    sizeHint: "5k-100k+ band",
  },
  {
    name: "retail-sui",
    desc: "Retail SELL · SUI → USDC · 2.5k size, tiny escrow",
    terms: () => ({ give: "SUI", get: "USDC", amount: 2_500, price: 3.88 }),
    note: "Small retail leg — partial fills welcome.",
  },
  {
    name: "stable-buy",
    desc: "Stable BUY · USDC → SUI · stablecoin giving, asset receiving",
    terms: () => ({ give: "USDC", get: "SUI", amount: 8_000, price: 0.256 }),
    note: "Filling an open SUI position — fixed price, fast settle.",
  },
  {
    name: "stable-stable",
    desc: "Stable-stable · USDC → USDT · low-vol carry trade",
    terms: () => ({ give: "USDC", get: "USDT", amount: 50_000, price: 0.998 }),
    note: "Carry trade across stables — minimum slippage tolerance.",
  },
  {
    name: "exotic",
    desc: "Exotic pair · WAL → DEEP · thin orderbook",
    terms: () => ({ give: "WAL", get: "DEEP", amount: 12_000, price: 14.5 }),
    note: "OTC for a pair you won't find on a DEX.",
  },
  {
    name: "tight-spread",
    desc: "Tight spread · SUI → USDC at slight premium",
    terms: () => ({ give: "SUI", get: "USDC", amount: 18_000, price: 4.05 }),
    note: "Looking for a +3bps premium vs mark.",
  },
  {
    name: "wide-spread",
    desc: "Wide spread · SUI → USDC at discount, urgent",
    terms: () => ({ give: "SUI", get: "USDC", amount: 30_000, price: 3.72 }),
    note: "Urgent unwind — happy to leave 100bps on the table.",
  },
  {
    name: "short-expiry",
    desc: "Short expiry · 2 epochs · time-pressured",
    terms: () => ({ give: "USDC", get: "SUI", amount: 6_500, price: 0.255 }),
    expiryEpochs: 2,
    note: "Filling against an end-of-day target.",
  },
  {
    name: "long-expiry",
    desc: "Long expiry · 90 epochs · standing offer",
    terms: () => ({ give: "WAL", get: "USDC", amount: 25_000, price: 0.61 }),
    expiryEpochs: 90,
    note: "Standing offer — leave it on the book all month.",
  },
  {
    name: "private",
    desc: "Private/targeted · only one wallet may fund",
    terms: () => ({ give: "SUI", get: "USDC", amount: 45_000, price: 3.95 }),
    note: "Bilateral block — pre-agreed terms with named taker.",
    requiresTarget: true,
  },
];

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
  const keystore = path.join(os.homedir(), ".sui", "sui_config", "sui.keystore");
  if (!fs.existsSync(keystore)) {
    throw new Error(`Sui keystore not found at ${keystore}. Run 'sui client new-address ed25519' first.`);
  }
  const keys = JSON.parse(fs.readFileSync(keystore, "utf8"));
  if (!Array.isArray(keys) || keys.length === 0) throw new Error("Empty keystore");
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

function escrowMistFor(terms) {
  // Same back-derivation the dApp uses in lib/sui-orders.ts::computeEscrowMist.
  // SUI give → 5% of give-amount in MIST; otherwise 2% of counter in 1e6.
  if (terms.give === "SUI") {
    return BigInt(Math.max(1_000_000, Math.floor(terms.amount * 0.05 * 1e9)));
  }
  const counter = Math.round(terms.amount * terms.price);
  return BigInt(Math.max(1_000_000, Math.floor(counter * 0.02 * 1e6)));
}

function pickCases() {
  if (LIST) return [];                       // handled in main
  if (LEGACY_COUNT && !ONE_CASE) {
    // Legacy random mode for back-compat with earlier README invocations.
    return Array.from({ length: LEGACY_COUNT }, () => {
      const c = CASES[Math.floor(Math.random() * CASES.length)];
      return { ...c, name: `${c.name}-rand-${Math.floor(Math.random() * 9999)}` };
    });
  }
  if (ONE_CASE) {
    const match = CASES.find((c) => c.name === ONE_CASE);
    if (!match) {
      console.error(`${RED}✗ unknown --case "${ONE_CASE}". Try --list.${RESET}`);
      process.exit(1);
    }
    return [match];
  }
  return CASES;                              // default: run them all
}

async function main() {
  console.log(`${CYAN}=== Sealed Pair seed-orders ===${RESET}`);

  if (LIST) {
    console.log(`${DIM}Available cases (pass via --case <name>):${RESET}\n`);
    for (const c of CASES) {
      const tag = c.requiresTarget ? `${YELLOW}(needs --target 0x…)${RESET}` : "";
      console.log(`  ${c.name.padEnd(16)} ${c.desc} ${tag}`);
    }
    return;
  }

  const env = readDotEnv(envFile);
  const packageId = env.NEXT_PUBLIC_SEALED_PAIR_PACKAGE_ID;
  if (!packageId) {
    console.error(`${RED}✗ NEXT_PUBLIC_SEALED_PAIR_PACKAGE_ID not set in .env.local${RESET}`);
    process.exit(1);
  }
  console.log(`${DIM}package: ${packageId}${RESET}`);

  const keypair = readSuiKeypair();
  const address = keypair.toSuiAddress();
  console.log(`${DIM}address: ${address}${RESET}`);

  const client = new SuiJsonRpcClient({ network: NETWORK, url: RPC_URL });

  let currentEpoch = 0n;
  try {
    const sys = await client.getLatestSuiSystemState();
    currentEpoch = BigInt(sys.epoch ?? "0");
    console.log(`${DIM}epoch:   ${currentEpoch}${RESET}`);
  } catch {
    console.log(`${DIM}epoch:   (lookup failed, using +30 default)${RESET}`);
  }

  const queued = pickCases();
  console.log(`\n${CYAN}=== seeding ${queued.length} order${queued.length === 1 ? "" : "s"} ===${RESET}`);

  const created = [];
  for (let i = 0; i < queued.length; i++) {
    const c = queued[i];
    const terms = c.terms();
    const counter = Math.round(terms.amount * terms.price);
    const label = `[${i + 1}/${queued.length}] ${c.name}`;
    console.log(`\n${CYAN}${label}${RESET}`);
    console.log(`  ${DIM}${c.desc}${RESET}`);
    console.log(`  ${terms.give} → ${terms.get}  amount=${terms.amount}  price=${terms.price}  counter=${counter}`);

    if (c.requiresTarget && !TARGET_TAKER) {
      console.log(`  ${YELLOW}skip — needs --target 0x… for targeted audience${RESET}`);
      continue;
    }

    process.stdout.write("  encrypt + walrus upload… ");
    const plaintext = JSON.stringify({
      ...terms,
      counter,
      minFill: Math.round(terms.amount * 0.25),
      note: c.note ?? "",
      v: 1,
    });
    const cipher = await aesEncrypt(plaintext);
    let blobId;
    try {
      blobId = await uploadToWalrus(cipher);
    } catch (e) {
      console.log(`${RED}fail${RESET} ${e.message?.slice(0, 80) ?? e}`);
      continue;
    }
    console.log(`${GREEN}ok${RESET} ${DIM}${blobId.slice(0, 16)}…${RESET}`);

    process.stdout.write("  create_offer ptb…       ");
    const escrowMist = escrowMistFor(terms);
    const expiry = c.expiryEpochs ?? 30;
    const expiryEpoch = (currentEpoch > 0n ? currentEpoch : 0n) + BigInt(expiry);
    const policyId = "0x" + "00".repeat(31) + "01";
    const tx = new Transaction();
    tx.moveCall({
      target: `${packageId}::order::create_offer`,
      arguments: [
        tx.pure.vector("u8", Array.from(new TextEncoder().encode(blobId))),
        tx.pure.id(policyId),
        tx.pure.vector("u8", Array.from(new TextEncoder().encode(terms.give))),
        tx.pure.vector("u8", Array.from(new TextEncoder().encode(terms.get))),
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
      const orderId = orderObj?.objectId ?? "?";
      console.log(`${GREEN}ok${RESET} digest ${DIM}${result.digest.slice(0, 12)}…${RESET}`);
      if (c.requiresTarget && TARGET_TAKER) {
        console.log(`  ${DIM}note: target hint must be stored in browser localStorage`);
        console.log(`        sealedpair:target-hints → { "${blobId}": "${TARGET_TAKER.toLowerCase()}" }${RESET}`);
      }
      created.push({
        case: c.name,
        give: terms.give,
        get: terms.get,
        amount: terms.amount,
        digest: result.digest,
        orderId,
        blobId,
      });
    } catch (e) {
      console.log(`${RED}fail${RESET} ${e.message?.slice(0, 80) ?? e}`);
    }
  }

  console.log(`\n${CYAN}=== summary ===${RESET}`);
  if (created.length === 0) {
    console.log(`${YELLOW}no orders created.${RESET}`);
    return;
  }
  console.log("| case            | pair        | amount  | order id              | tx digest             | blob id              |");
  console.log("|-----------------|-------------|---------|-----------------------|-----------------------|----------------------|");
  for (const o of created) {
    const cn = o.case.padEnd(15);
    const pair = `${o.give} → ${o.get}`.padEnd(11);
    const amt = String(o.amount).padEnd(7);
    const oid = (o.orderId.slice(0, 6) + "…" + o.orderId.slice(-4)).padEnd(21);
    const dig = (o.digest.slice(0, 6) + "…" + o.digest.slice(-4)).padEnd(21);
    const bid = (o.blobId.slice(0, 6) + "…" + o.blobId.slice(-4)).padEnd(20);
    console.log(`| ${cn} | ${pair} | ${amt} | ${oid} | ${dig} | ${bid} |`);
  }
  console.log(`\n${GREEN}done.${RESET} Board polls suix_queryEvents every 30s — refresh https://sealed-pair.vercel.app/app shortly.`);
  console.log(`${DIM}Suiscan: https://suiscan.xyz/${NETWORK}/account/${address}${RESET}`);
}

main().catch((e) => {
  console.error(`${RED}fatal:${RESET}`, e);
  process.exit(1);
});
