// scripts/seed-counters.mjs
//
// Seed REAL counter-offers as a one-time install link.
//
// Why this isn't fully server-side: the counter-offer index lives in
// localStorage on each maker's browser (see lib/counter-offers.ts header
// for the design rationale). What we CAN do server-side is the expensive
// half — generate the AES-encrypted terms, upload the real ciphertext to
// Walrus, get a real blobId. Then we encode just the lightweight metadata
// into a one-time URL the maker opens; their /app handler at
// install-counters writes it to localStorage.
//
// Result: the maker sees 4-5 pending counter-offers on their orders, each
// with a REAL Walrus blobId (they can click "Inspect blob" and see actual
// bytes). It's not a fully decentralized counter-offer system — that's V2
// (Move Table<orderId, blob[]>) — but it IS real Walrus content.
//
// Usage:
//   node scripts/seed-counters.mjs --maker 0xcb63...f317
//                                            # generate hint for this maker's orders
//   node scripts/seed-counters.mjs --maker <addr> --count 6
//                                            # custom counter count

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { webcrypto } from "node:crypto";
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";

const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

const argv = process.argv.slice(2);
const arg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };

const MAKER = arg("--maker");
const COUNT = Number(arg("--count")) || 5;
const APP_URL = arg("--app") || "https://sealed-pair.vercel.app/app";

if (!MAKER || !/^0x[0-9a-fA-F]{64}$/.test(MAKER)) {
  console.error(`${RED}Usage: node scripts/seed-counters.mjs --maker 0x<64hex> [--count 5]${RESET}`);
  process.exit(1);
}

const WALRUS_PUBLISHER = "https://publisher.walrus-testnet.walrus.space";
const NETWORK = "devnet";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
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

// 4 named "personas" the demo can pretend wrote the counter-offers. These
// are illustrative — neither the addresses nor the proposer names are real
// counterparties. Goal: rich-looking inbox for the demo.
const PERSONAS = [
  { addr: "0x4d1f8e4f6c7e9b2a8d5c3e1f7a9b0c2d4e6f8a1b3c5d7e9f1a2b4c6d8e0f2a4b", short: "0x4d1f…2a4b", name: "Whale-A" },
  { addr: "0x7e3d2c1b0a9f8e7d6c5b4a3928171605f4e3d2c1b0a9f8e7d6c5b4a3928171605", short: "0x7e3d…1605", name: "Desk-B" },
  { addr: "0x9c8b7a6958473625140312f3e4d5c6b7a8190b2c3d4e5f6a7b8c9d0e1f2a3b4c", short: "0x9c8b…3b4c", name: "Solo-C" },
  { addr: "0x1a2b3c4d5e6f708192a3b4c5d6e7f80910f2e3d4c5b6a79e8d7c6b5a4938271605", short: "0x1a2b…1605", name: "Fund-D" },
];

function variantOf(base, i) {
  // Counter-offer terms perturb the original by ±2-15% on price + amount.
  const dPrice = 1 + (((i * 7) % 11) - 5) / 100;   // ±5%
  const dAmt   = 1 + (((i * 13) % 9) - 4) / 100;   // ±4%
  const amount = Math.round(base.amount * dAmt);
  const price  = Number((base.price * dPrice).toFixed(4));
  const counter = Math.round(amount * price);
  return { amount, price, counter };
}

async function findMakerOrders(client, packageId, maker, currentEpoch) {
  console.log(`${CYAN}scanning OrderPosted by maker ${maker.slice(0, 10)}…${RESET}`);
  const posted = await client.queryEvents({
    query: { MoveEventType: `${packageId}::order::OrderPosted` },
    limit: 50,
    order: "descending",
  });
  const mine = posted.data
    .map((e) => e.parsedJson)
    .filter((j) => j && j.maker?.toLowerCase() === maker.toLowerCase());
  console.log(`  found ${mine.length} posted by this maker`);

  if (!mine.length) return [];

  const objs = await client.multiGetObjects({
    ids: mine.map((j) => j.order_id),
    options: { showContent: true },
  });
  const open = [];
  for (let i = 0; i < objs.length; i++) {
    const fields = objs[i].data?.content?.fields;
    if (!fields) continue;
    const state = Number(fields.state);
    const expiryEpoch = Number(fields.expiry_epoch);
    if (state !== 0) continue;
    if (!Number.isFinite(expiryEpoch) || currentEpoch >= expiryEpoch) continue;
    open.push({
      orderId: objs[i].data.objectId,
      blobId: fields.blob_id,
      // Decent guess for "original terms" — we don't have plaintext, just
      // use round numbers so the perturbations look natural.
      baseTerms: { amount: 10_000, price: 3.9 },
    });
  }
  return open;
}

async function main() {
  const env = readDotEnv(envFile);
  const PACKAGE_ID = env.NEXT_PUBLIC_SEALED_PAIR_PACKAGE_ID;
  if (!PACKAGE_ID) { console.error(`${RED}Missing NEXT_PUBLIC_SEALED_PAIR_PACKAGE_ID${RESET}`); process.exit(1); }

  const client = new SuiJsonRpcClient({ url: getJsonRpcFullnodeUrl(NETWORK) });
  const sys = await client.getLatestSuiSystemState();
  const currentEpoch = Number(sys.epoch);

  console.log(`${CYAN}=== seed-counters ===${RESET}`);
  console.log(`network: ${NETWORK}  package: ${PACKAGE_ID.slice(0, 14)}…`);
  console.log(`maker:   ${MAKER}  count: ${COUNT}\n`);

  const orders = await findMakerOrders(client, PACKAGE_ID, MAKER, currentEpoch);
  if (!orders.length) {
    console.error(`${YELLOW}No OPEN, non-expired orders by this maker. Run seed-orders.mjs first or check the address.${RESET}`);
    process.exit(0);
  }

  // Round-robin counter-offers across the maker's orders, capped at COUNT.
  const entries = new Map(); // orderId -> { orderId, offers: [] }
  for (let i = 0; i < COUNT; i++) {
    const order = orders[i % orders.length];
    const persona = PERSONAS[i % PERSONAS.length];
    const t = variantOf(order.baseTerms, i);
    const noteOptions = [
      "Better price — split fills welcome.",
      "Larger size if pricing is flexible.",
      "Time-locked at our end; need confirmation today.",
      "We're a maker too — happy to flip if needed.",
      "Can settle in tranches if it helps you.",
    ];
    const note = noteOptions[i % noteOptions.length];
    const terms = { ...t, note, v: 1 };
    console.log(`${CYAN}[${i + 1}/${COUNT}] order ${order.orderId.slice(0, 10)}… by ${persona.name}${RESET}`);
    console.log(`  terms: ${terms.amount} @ ${terms.price} = ${terms.counter} (${note})`);

    const ciphertext = await aesEncrypt(JSON.stringify(terms));
    const blobId = await uploadToWalrus(ciphertext);
    console.log(`  walrus: ${GREEN}ok${RESET} ${DIM}${blobId.slice(0, 16)}…${RESET}`);

    const offer = {
      id: `co_seed_${Date.now()}_${i}`,
      orderId: order.orderId,
      proposedBy: persona.addr,
      proposedByShort: persona.short,
      blobId,
      createdAt: Date.now() - (i * 17 + 5) * 60_000, // backdate 5min, 22min, 39min…
      status: i === 1 ? "rejected" : "pending",      // 1 rejected for variety
      termsPreview: { amount: t.amount, price: t.price, counter: t.counter, note },
    };
    if (!entries.has(order.orderId)) entries.set(order.orderId, { orderId: order.orderId, offers: [] });
    entries.get(order.orderId).offers.push(offer);
  }

  const payload = Array.from(entries.values());
  const b64 = Buffer.from(JSON.stringify(payload)).toString("base64");
  const url = `${APP_URL}?install-counters=${b64}`;

  console.log(`\n${CYAN}=== install link ===${RESET}`);
  console.log(`Open ONCE in the maker's browser to write counters to localStorage:\n`);
  console.log(`${GREEN}${url}${RESET}`);
  console.log(`\n${DIM}(URL is long but legal — base64 of ${payload.length} order-groups, ${COUNT} offers.)${RESET}`);
}

main().catch((e) => { console.error(`${RED}fatal${RESET}: ${e.message}`); process.exit(1); });
