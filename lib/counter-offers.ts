// Off-chain counter-offer index — a Diam-style negotiation flow ported to
// Sealed Pair. Each counter is uploaded as an encrypted blob to Walrus (so
// it inherits the same content-addressed commitment property as the parent
// order); a lightweight metadata pointer is kept in localStorage so the UI
// can display the list without rescanning Walrus.
//
// For hackathon scope, *anyone* with the localStorage key can see the
// metadata (taker address, counter blobId). The terms themselves are still
// Walrus-encrypted and remain protected until decrypted with the right key.
// In production this index would be on-chain (a Move CounterTable shared
// object) so makers see counters posted from any client.

import { generateKey, stashKey, encryptText, loadKey, decryptText } from "./crypto";

export type CounterStatus = "pending" | "accepted" | "rejected";

export type CounterOffer = {
  id: string;            // local UUID-ish; not on-chain
  orderId: string;       // parent Order object id
  proposedBy: string;    // taker wallet address (full)
  proposedByShort: string;
  blobId: string;        // Walrus blobId holding the encrypted terms
  createdAt: number;     // Date.now()
  status: CounterStatus;
  // Decoded terms — cached after a successful decrypt so the maker doesn't
  // have to fetch+decrypt on every render. Pure UI optimization; not auth.
  termsPreview?: { amount: number; price: number; counter: number; note?: string };
};

type CounterTerms = {
  amount: number;
  price: number;
  counter: number;       // total in get-asset
  note?: string;
};

const KEY = (orderId: string) => `sealedpair:counters:${orderId}`;
const INDEX_KEY = "sealedpair:counters:index";   // list of orderIds with counters

function readJson<T>(k: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(k);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(k: string, v: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* quota/private-mode — best-effort */
  }
}

function rememberIndex(orderId: string) {
  const idx = readJson<string[]>(INDEX_KEY, []);
  if (!idx.includes(orderId)) {
    idx.push(orderId);
    writeJson(INDEX_KEY, idx);
  }
}

export function listCounterOffers(orderId: string): CounterOffer[] {
  return readJson<CounterOffer[]>(KEY(orderId), []);
}

export function countAllCountersForOrders(orderIds: string[]): number {
  let total = 0;
  for (const id of orderIds) total += listCounterOffers(id).length;
  return total;
}

/**
 * Encrypt + upload counter terms to Walrus, then write a metadata record
 * locally so the UI can list it. Caller passes wallet address (full and
 * shortened) so we can attribute the counter without re-deriving here.
 */
export async function submitCounterOffer(args: {
  orderId: string;
  proposer: string;
  proposerShort: string;
  terms: CounterTerms;
}): Promise<CounterOffer> {
  const key = await generateKey();
  const plaintext = JSON.stringify({ ...args.terms, v: 1 });
  const ciphertext = await encryptText(plaintext, key);
  const body = ciphertext.buffer.slice(
    ciphertext.byteOffset,
    ciphertext.byteOffset + ciphertext.byteLength,
  ) as ArrayBuffer;
  const res = await fetch(`/api/walrus/store?epochs=4`, {
    method: "PUT",
    headers: { "Content-Type": "application/octet-stream" },
    body,
  });
  if (!res.ok) throw new Error(`Walrus store failed (${res.status})`);
  const json = (await res.json()) as { ok: boolean; blobId?: string };
  if (!json.ok || !json.blobId) throw new Error("Walrus returned no blobId");
  await stashKey(json.blobId, key);

  const offer: CounterOffer = {
    id: `co_${Date.now()}_${Math.floor(Math.random() * 0xffff).toString(16)}`,
    orderId: args.orderId,
    proposedBy: args.proposer,
    proposedByShort: args.proposerShort,
    blobId: json.blobId,
    createdAt: Date.now(),
    status: "pending",
    // Cache plaintext preview locally so the proposer's own UI can show their
    // own counter without a fetch round-trip. (Other viewers won't have the
    // key — they need to decrypt via Walrus + sessionStorage.)
    termsPreview: args.terms,
  };
  const list = listCounterOffers(args.orderId);
  list.push(offer);
  writeJson(KEY(args.orderId), list);
  rememberIndex(args.orderId);
  return offer;
}

/** Update status (accept/reject) by offer id. */
export function setCounterStatus(orderId: string, offerId: string, status: CounterStatus) {
  const list = listCounterOffers(orderId);
  const next = list.map((o) => (o.id === offerId ? { ...o, status } : o));
  writeJson(KEY(orderId), next);
}

/** Best-effort decrypt: tries the local sessionStorage key for this blob. */
export async function decryptCounter(blobId: string): Promise<CounterTerms | null> {
  try {
    const key = await loadKey(blobId);
    if (!key) return null;
    const res = await fetch(`/api/walrus/blob/${encodeURIComponent(blobId)}`, { cache: "force-cache" });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const text = await decryptText(buf, key);
    const parsed = JSON.parse(text) as unknown;
    if (
      typeof parsed === "object" && parsed !== null &&
      typeof (parsed as Record<string, unknown>).amount === "number" &&
      typeof (parsed as Record<string, unknown>).price === "number"
    ) {
      return parsed as CounterTerms;
    }
    return null;
  } catch {
    return null;
  }
}
