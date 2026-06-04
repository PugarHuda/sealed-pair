// Frontend bindings for the deployed `sealed_pair::order` Move module.
//
// What's here:
//   - PACKAGE_ID resolver (reads NEXT_PUBLIC_SEALED_PAIR_PACKAGE_ID).
//   - TypeScript mirrors of the on-chain event payloads.
//   - PTB description builders (target string + args) for create_offer,
//     lock_with_escrow, mark_revealed, settle, cancel_open, cancel_expired.
//   - `listOpenOrders()` — queries OrderPosted events through /api/sui and
//     normalises them into the app's `Order` type so the RFQ board can show
//     real on-chain quotes alongside (or instead of) the seed mocks.
//
// What's NOT here yet:
//   - Wallet integration (signing). Adding @mysten/dapp-kit gives us that;
//     until then, these helpers describe transactions for a future wallet call.

import type { AssetSym, Order, OrderTerms } from "./types";
import { bandFor, fmt, makeOrder } from "./data";

/** Compute the MIST-precision escrow size used by create_offer + lock_with_escrow.
 *  SUI-side trades quote 5% of give-amount in MIST.
 *  Other-side trades quote 2% of counter in the get-asset's smallest unit
 *  (treated as 1e6 for stablecoins as a reasonable hackathon default).
 */
export function computeEscrowMist(terms: OrderTerms, give: AssetSym): bigint {
  if (give === "SUI") {
    return BigInt(Math.max(1_000_000, Math.floor(terms.amount * 0.05 * 1e9)));
  }
  return BigInt(Math.max(1_000_000, Math.floor(terms.counter * 0.02 * 1e6)));
}

/** Fetch the current Sui epoch via our /api/sui proxy. Falls back to 0 on
 *  failure so callers can apply a safe default (e.g., +30 epochs ahead). */
export async function fetchCurrentEpoch(network: "mainnet" | "testnet" | "devnet" = "testnet"): Promise<number> {
  try {
    const res = await fetch("/api/sui", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "sui_getLatestSuiSystemState", network }),
    });
    if (!res.ok) return 0;
    const json = (await res.json()) as { result?: { epoch?: string } };
    const epoch = Number(json.result?.epoch ?? 0);
    return Number.isFinite(epoch) ? epoch : 0;
  } catch {
    return 0;
  }
}

/* ============ env resolution ============ */

/** The deployed Sealed Pair Move package ID (0x… form). null until deploy lands. */
export const SEALED_PAIR_PACKAGE_ID: string | null =
  (process.env.NEXT_PUBLIC_SEALED_PAIR_PACKAGE_ID || "").trim() || null;

/** Which Sui network the package lives on. Drives where the RFQ board polls events,
 *  what SuiScan host the deep links use, and which network DealScreen + SealCeremony
 *  pass to suix_queryEvents / sui_getLatestSuiSystemState calls. */
export const SUI_NETWORK_FOR_EVENTS: "mainnet" | "testnet" | "devnet" =
  (((process.env.NEXT_PUBLIC_SUI_NETWORK_FOR_EVENTS || "").trim() || "testnet") as "mainnet" | "testnet" | "devnet");

export const SUISCAN_HOST = `https://suiscan.xyz/${SUI_NETWORK_FOR_EVENTS}`;

/** Throws a helpful error so we never silently call a non-existent package. */
export function requirePackageId(): string {
  if (!SEALED_PAIR_PACKAGE_ID) {
    throw new Error(
      "NEXT_PUBLIC_SEALED_PAIR_PACKAGE_ID is not set. Run scripts/deploy-move.ps1 (see move/README.md).",
    );
  }
  return SEALED_PAIR_PACKAGE_ID;
}

export const MODULE = "order";
export const target = (fn: string) => `${requirePackageId()}::${MODULE}::${fn}`;

/* ============ side inference ============
 * The Move package does NOT store a SELL/BUY label — it's redundant with
 * give/get on-chain. We need the label for UI filtering, so:
 *   1. For orders sealed in THIS browser we save the user's stated side
 *      under the blobId key. Those wins exact intent recall on refresh.
 *   2. For all other orders we infer from asset roles: giving away a
 *      stablecoin to acquire something else == BUY; everything else == SELL.
 */
const STABLES: ReadonlySet<AssetSym> = new Set<AssetSym>(["USDC", "USDT"]);

export function inferSide(give: AssetSym, get: AssetSym): "SELL" | "BUY" {
  const giveStable = STABLES.has(give);
  const getStable = STABLES.has(get);
  if (giveStable && !getStable) return "BUY";
  return "SELL";
}

const SIDE_HINT_KEY = "sealedpair:side-hints";
type SideHints = Record<string, "SELL" | "BUY">;

function readSideHints(): SideHints {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SIDE_HINT_KEY);
    return raw ? (JSON.parse(raw) as SideHints) : {};
  } catch {
    return {};
  }
}

/** Persist user's chosen side for a blob. Called after a successful seal so
 *  the live RFQ board recovers it after a refresh / cross-device load.
 *  Per-device only — cross-device hint persistence would require on-chain
 *  storage or a backend, beyond hackathon scope. */
export function rememberSideHint(blobId: string, side: "SELL" | "BUY"): void {
  if (typeof window === "undefined" || !blobId) return;
  try {
    const cur = readSideHints();
    cur[blobId] = side;
    window.localStorage.setItem(SIDE_HINT_KEY, JSON.stringify(cur));
  } catch {
    /* quota — best-effort */
  }
}

export function getSideHint(blobId: string): "SELL" | "BUY" | null {
  if (!blobId) return null;
  return readSideHints()[blobId] ?? null;
}

/* ----- targeted-audience hints ----------------------------------------- */

const TARGET_HINT_KEY = "sealedpair:target-hints";
type TargetHints = Record<string, string>;

function readTargetHints(): TargetHints {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(TARGET_HINT_KEY);
    return raw ? (JSON.parse(raw) as TargetHints) : {};
  } catch {
    return {};
  }
}

/** Remember that an order is targeted at a specific taker address. Keyed by
 *  Walrus blobId because that's available before the on-chain orderObj id
 *  is known. Stored lower-cased for case-insensitive matching downstream. */
export function rememberTargetHint(blobId: string, target: string | null): void {
  if (typeof window === "undefined" || !blobId) return;
  try {
    const cur = readTargetHints();
    if (target) cur[blobId] = target.trim().toLowerCase();
    else delete cur[blobId];
    window.localStorage.setItem(TARGET_HINT_KEY, JSON.stringify(cur));
  } catch {
    /* quota — best-effort */
  }
}

export function getTargetHint(blobId: string): string | null {
  if (!blobId) return null;
  return readTargetHints()[blobId] ?? null;
}

/* ============ on-chain event mirrors ============ */

/** Mirrors `sealed_pair::order::OrderPosted`. */
export type OrderPostedEvent = {
  order_id: string;
  maker: string;
  blob_id: string; // base64 or hex of the vector<u8>
  give_kind: string;
  get_kind: string;
  escrow_required: string; // u64 comes through as a string
  expiry_epoch: string;
};

/** Mirrors `sealed_pair::order::OrderLocked`. */
export type OrderLockedEvent = {
  order_id: string;
  taker: string;
  escrow_amount: string;
};

export type OrderRevealedEvent = { order_id: string };
export type OrderSettledEvent = { order_id: string; settled_at_epoch: string };
export type OrderCancelledEvent = { order_id: string; reason: number };

/* ============ PTB description helpers ============ */

/**
 * Returned shape describes a Move call — wallets and the @mysten/sui SDK
 * accept this kind of object directly when building a Transaction.
 */
export type MoveCallDescription = {
  target: string;
  arguments: unknown[];
  typeArguments: string[];
};

export const createOfferCall = (args: {
  blobId: Uint8Array;
  policyId: string;
  give: AssetSym;
  get: AssetSym;
  escrowRequiredMist: bigint | number | string;
  expiryEpoch: bigint | number | string;
}): MoveCallDescription => ({
  target: target("create_offer"),
  arguments: [
    Array.from(args.blobId),
    args.policyId,
    Array.from(new TextEncoder().encode(args.give)),
    Array.from(new TextEncoder().encode(args.get)),
    String(args.escrowRequiredMist),
    String(args.expiryEpoch),
  ],
  typeArguments: [],
});

export const lockEscrowCall = (args: {
  orderId: string;
  paymentCoinId: string;
}): MoveCallDescription => ({
  target: target("lock_with_escrow"),
  arguments: [args.orderId, args.paymentCoinId, "0x6" /* shared Clock */],
  typeArguments: [],
});

export const markRevealedCall = (orderId: string): MoveCallDescription => ({
  target: target("mark_revealed"),
  arguments: [orderId],
  typeArguments: [],
});

export const settleCall = (orderId: string): MoveCallDescription => ({
  target: target("settle"),
  arguments: [orderId],
  typeArguments: [],
});

export const cancelOpenCall = (orderId: string): MoveCallDescription => ({
  target: target("cancel_open"),
  arguments: [orderId],
  typeArguments: [],
});

export const cancelExpiredCall = (orderId: string): MoveCallDescription => ({
  target: target("cancel_expired"),
  arguments: [orderId],
  typeArguments: [],
});

/* ============ Live RFQ board: read OrderPosted events ============ */

type RpcEvent = {
  id: { txDigest: string; eventSeq: string };
  packageId: string;
  type: string;
  parsedJson: Record<string, unknown>;
  timestampMs?: string;
};

type QueryEventsResp = {
  data: RpcEvent[];
  hasNextPage: boolean;
  nextCursor: { txDigest: string; eventSeq: string } | null;
};

/**
 * Fetch the most recent `OrderPosted` events for the deployed package,
 * then back-check the current on-chain state of each Order and drop anything
 * that's no longer OPEN (already locked, revealed, settled, or cancelled).
 * Without this filter, the board lists orders the user can't actually act
 * on — clicking one only surfaces the abort code 0 (EWrongState) after a
 * wallet popup, which is a terrible UX.
 *
 * Two RPC calls per refresh: one suix_queryEvents + one sui_multiGetObjects.
 * Returns Orders normalised to the app's frontend type so they slot straight
 * into the RFQ board.
 */
export async function listOpenOrders(opts: {
  network?: "mainnet" | "testnet" | "devnet";
  limit?: number;
} = {}): Promise<Order[]> {
  if (!SEALED_PAIR_PACKAGE_ID) return [];

  const eventType = `${SEALED_PAIR_PACKAGE_ID}::${MODULE}::OrderPosted`;
  const body = {
    method: "suix_queryEvents",
    params: [{ MoveEventType: eventType }, null, opts.limit ?? 50, true],
    network: opts.network,
  };

  const res = await fetch("/api/sui", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { result?: QueryEventsResp };
  const events = json.result?.data ?? [];
  const candidates = events.map(eventToOrder).filter((o): o is Order => o !== null);
  if (candidates.length === 0) return [];

  // Single batched read to learn each Order's current state. If this call
  // fails for any reason we degrade to returning the unfiltered list — a
  // stale board with one bad row is still better than an empty board.
  try {
    const stateRes = await fetch("/api/sui", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method: "sui_multiGetObjects",
        params: [candidates.map((o) => o.orderObj), { showContent: true }],
        network: opts.network,
      }),
    });
    if (!stateRes.ok) return candidates;
    const stateJson = (await stateRes.json()) as {
      result?: Array<{ data?: { content?: { fields?: Record<string, unknown> } } }>;
    };
    const items = stateJson.result ?? [];
    // Guard against a partial response: if the gateway returned fewer
    // objects than we asked for, the index-aligned filter would silently
    // drop valid orders from the tail. Fall back to candidates instead.
    if (items.length !== candidates.length) {
      console.warn(`[listOpenOrders] partial multiGetObjects response (got ${items.length}/${candidates.length})`);
      return candidates;
    }
    return candidates.filter((_, i) => {
      const fields = items[i]?.data?.content?.fields;
      if (!fields) return false;          // object missing → it was deleted/never existed
      const state = Number(fields.state ?? -1);
      return state === 0;                  // 0 = OPEN per Move module
    });
  } catch {
    return candidates;
  }
}

function eventToOrder(evt: RpcEvent): Order | null {
  const p = evt.parsedJson as Partial<OrderPostedEvent>;
  if (!p.order_id || !p.maker) return null;

  const blobIdRaw = (evt.parsedJson as { blob_id?: unknown }).blob_id;
  const blobId = decodeBytesField(blobIdRaw);

  const give = (p.give_kind ?? "SUI") as AssetSym;
  const get = (p.get_kind ?? "USDC") as AssetSym;
  const escrowMistStr = String(p.escrow_required ?? "0");
  const escrowMistNum = Number(escrowMistStr);
  const approxGiveAmount = escrowMistNum > 0
    ? (give === "SUI" ? Math.floor(escrowMistNum / 1e9 / 0.05) : Math.floor(escrowMistNum / 1e6 / 0.02))
    : 10_000;

  // Stable, human-readable maker name. Picks a hex pair after the 0x prefix
  // so the avatar circle gets a meaningful initial instead of the literal
  // digit "0" that every Sui address starts with.
  const makerHex = p.maker.startsWith("0x") ? p.maker.slice(2) : p.maker;
  const makerName = `Anon-${makerHex.slice(0, 4).toUpperCase()}`;

  // Prefer the user's stated side if we sealed this blob locally; otherwise
  // fall back to a stablecoin-heuristic so the BUY filter actually returns
  // results for stablecoin → asset orders.
  const side = getSideHint(blobId) ?? inferSide(give, get);
  const base = makeOrder({
    maker: { name: makerName, handle: shortAddr(p.maker), color: addrColor(p.maker), addr: p.maker },
    side,
    give,
    get,
    amount: Math.max(1_000, approxGiveAmount),
    price: 0,
    createdAgo: evt.timestampMs ? timeAgo(Number(evt.timestampMs)) : "live",
    expiresIn: humanExpiry(p.expiry_epoch),
  });

  // Devnet/testnet/mainnet epochs are all ~24h. We mint orders with a
  // +30-epoch expiry window, so project that forward from the post-time
  // event timestamp to get a stable countdown target. Stable means it
  // doesn't drift across re-renders / re-fetches.
  const EPOCH_MS = 86_400_000;
  const EXPIRY_EPOCHS = 30;
  const expiresAtMs = evt.timestampMs
    ? Number(evt.timestampMs) + EXPIRY_EPOCHS * EPOCH_MS
    : Date.now() + EXPIRY_EPOCHS * EPOCH_MS;

  return {
    ...base,
    blobId,
    orderObj: String(p.order_id),
    sizeBand: bandFor(approxGiveAmount),
    escrowRequiredMist: escrowMistStr,
    targetTaker: getTargetHint(blobId) ?? undefined,
    expiresAtMs,
  };
}

/** Pick a deterministic accent color from an address — different makers
 *  get visually distinguishable avatars without a name registry. */
function addrColor(addr: string): string {
  const palette = ["#7b8cff", "#5fe0ff", "#ff6fae", "#4dd6a8", "#ffb24a", "#8b6cff"];
  let h = 0;
  for (let i = 2; i < Math.min(addr.length, 14); i++) h = (h * 31 + addr.charCodeAt(i)) | 0;
  return palette[Math.abs(h) % palette.length];
}

/** Render expiry_epoch as "in N epoch(s) (~Nd)" if it's a plausible epoch number,
 *  else show the raw value. Devnet epochs ≈ 1 day. */
function humanExpiry(epoch: string | undefined): string {
  if (!epoch || epoch === "?") return "epoch unknown";
  const e = Number(epoch);
  if (!Number.isFinite(e) || e <= 0) return `epoch ${epoch}`;
  // We don't know the current epoch here without an extra RPC call, so just
  // express the absolute target. The UI knows the network and can compute
  // delta separately if it wants to.
  return `epoch ${e}`;
}

/**
 * Move Option<address> can serialize as several shapes depending on the
 * Sui RPC version + showContent option. Cover all four observed forms:
 *   - `null` / `undefined`           → None
 *   - `"0x..."` (direct string)      → Some (simplified)
 *   - `{ vec: ["0x..."] }`           → Some (canonical)
 *   - `{ fields: { vec: [...] } }`   → Some (nested object form)
 *   - `{ Some: "0x..." }`            → Some (alternative variant tag)
 * Returns the address string when present, null otherwise.
 */
function extractOptionAddress(raw: unknown): string | null {
  if (!raw) return null;
  if (typeof raw === "string") return raw.startsWith("0x") ? raw : null;
  if (typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  // { vec: ["0x..."] } or { vec: [] }
  if (Array.isArray(obj.vec)) {
    const v = obj.vec[0];
    return typeof v === "string" && v.startsWith("0x") ? v : null;
  }
  // { fields: { vec: [...] } }
  if (obj.fields && typeof obj.fields === "object") {
    const inner = obj.fields as Record<string, unknown>;
    if (Array.isArray(inner.vec) && typeof inner.vec[0] === "string") {
      return (inner.vec[0] as string).startsWith("0x") ? (inner.vec[0] as string) : null;
    }
  }
  // { Some: "0x..." }
  if (typeof obj.Some === "string" && obj.Some.startsWith("0x")) return obj.Some;
  return null;
}

function decodeBytesField(raw: unknown): string {
  if (Array.isArray(raw)) return new TextDecoder().decode(new Uint8Array(raw));
  if (typeof raw === "string") return raw;
  return "bafyk_unknown";
}

function shortAddr(addr: string): string {
  return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

function timeAgo(tsMs: number): string {
  const delta = Math.max(0, Date.now() - tsMs);
  const s = Math.floor(delta / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h`;
}

/** Status pill data — handy for UI to show "live board active" or "mock". */
export function packageStatus(): { id: string | null; configured: boolean } {
  return { id: SEALED_PAIR_PACKAGE_ID, configured: SEALED_PAIR_PACKAGE_ID !== null };
}

/* ============ Settled events for the Vault ============ */

export type SettledEvent = {
  orderId: string;
  settledAtEpoch: number;
  txDigest: string;
  timestampMs?: number;
};

/**
 * A settled trade enriched with the on-chain Order fields, so the Vault can
 * render the same columns whether the row is a demo seed or a live event.
 */
export type SettledTrade = {
  orderId: string;
  txDigest: string;
  settledAtEpoch: number;
  when: string;            // human-readable time-ago
  maker: string;           // full address
  taker: string | null;
  give: AssetSym;
  get: AssetSym;
  blobId: string;
  escrowRequiredMist: string;
  escrowDisplayLabel: string; // e.g. "5,856 USDC" — back-derived from escrow + asset
};

/**
 * Read recent `OrderSettled` events for the deployed package via Tatum's
 * Sui RPC gateway. Returns [] when the package hasn't been deployed yet, so
 * the Vault renders fine in demo mode.
 */
export async function listSettledEvents(opts: {
  network?: "mainnet" | "testnet" | "devnet";
  limit?: number;
} = {}): Promise<SettledEvent[]> {
  if (!SEALED_PAIR_PACKAGE_ID) return [];

  const eventType = `${SEALED_PAIR_PACKAGE_ID}::${MODULE}::OrderSettled`;
  const body = {
    method: "suix_queryEvents",
    params: [{ MoveEventType: eventType }, null, opts.limit ?? 50, true],
    network: opts.network,
  };

  try {
    const res = await fetch("/api/sui", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { result?: QueryEventsResp };
    const events = json.result?.data ?? [];
    return events
      .map<SettledEvent | null>((evt) => {
        const p = evt.parsedJson as { order_id?: string; settled_at_epoch?: string };
        if (!p.order_id) return null;
        return {
          orderId: p.order_id,
          settledAtEpoch: Number(p.settled_at_epoch ?? 0),
          txDigest: evt.id.txDigest,
          timestampMs: evt.timestampMs ? Number(evt.timestampMs) : undefined,
        };
      })
      .filter((e): e is SettledEvent => e !== null);
  } catch {
    return [];
  }
}

/**
 * Fetch full Order objects for a list of ids and merge with the settled
 * events to produce SettledTrade rows. One RPC call per Vault load.
 */
export async function enrichSettledEvents(
  events: SettledEvent[],
  network: "mainnet" | "testnet" | "devnet" = SUI_NETWORK_FOR_EVENTS,
): Promise<SettledTrade[]> {
  if (events.length === 0) return [];
  try {
    const res = await fetch("/api/sui", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method: "sui_multiGetObjects",
        params: [events.map((e) => e.orderId), { showContent: true }],
        network,
      }),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      result?: Array<{ data?: { content?: { fields?: Record<string, unknown> } } }>;
    };
    const items = json.result ?? [];
    // Mirror listOpenOrders' partial-response guard: index alignment is
    // load-bearing here, so on a short response we'd silently misattribute
    // fields from one settle event to another.
    if (items.length !== events.length) {
      console.warn(`[enrichSettledEvents] partial multiGetObjects response (got ${items.length}/${events.length})`);
      return [];
    }
    return events
      .map<SettledTrade | null>((evt, i) => {
        const fields = items[i]?.data?.content?.fields;
        if (!fields) return null;
        const give = decodeBytesField(fields.give_kind) as AssetSym;
        const get = decodeBytesField(fields.get_kind) as AssetSym;
        const escrowMistStr = String(fields.escrow_required ?? "0");
        const escrowMistNum = Number(escrowMistStr);
        // Back-derive a give-side display amount the same way the RFQ board
        // does, so live + demo rows show comparable size figures.
        const approxGiveAmount = escrowMistNum > 0
          ? give === "SUI"
            ? Math.floor(escrowMistNum / 1e9 / 0.05)
            : Math.floor(escrowMistNum / 1e6 / 0.02)
          : 0;
        const escrowDisplayLabel = `${approxGiveAmount.toLocaleString("en-US")} ${give}`;
        const taker = extractOptionAddress(fields.taker);
        return {
          orderId: evt.orderId,
          txDigest: evt.txDigest,
          settledAtEpoch: evt.settledAtEpoch,
          when: evt.timestampMs ? timeAgo(evt.timestampMs) + " ago" : `epoch ${evt.settledAtEpoch}`,
          maker: String(fields.maker ?? ""),
          taker,
          give,
          get,
          blobId: decodeBytesField(fields.blob_id),
          escrowRequiredMist: escrowMistStr,
          escrowDisplayLabel,
        };
      })
      .filter((t): t is SettledTrade => t !== null);
  } catch {
    return [];
  }
}

/* ============ Maker reputation ============ */

/** Per-maker rollup derived from past OrderSettled events. */
export type MakerStats = {
  settles: number;       // total settled trades signed by this maker
  lastEpoch: number;     // most recent settle epoch
  asMakerAddr: string;   // canonical full address (lookup key fallback)
};

/**
 * Build a reputation Map keyed by BOTH the shortened "0xabcd…wxyz" form
 * (the same form stored in Order.maker.handle for live rows) AND the full
 * 0x… address — so callers can look up by either. Two RPC calls:
 * suix_queryEvents (settled list) + sui_multiGetObjects (maker per order).
 */
export async function fetchMakerReputation(
  network: "mainnet" | "testnet" | "devnet" = SUI_NETWORK_FOR_EVENTS,
  limit = 100,
): Promise<Map<string, MakerStats>> {
  const events = await listSettledEvents({ network, limit });
  if (events.length === 0) return new Map();
  const enriched = await enrichSettledEvents(events, network);
  const map = new Map<string, MakerStats>();
  for (const t of enriched) {
    if (!t.maker) continue;
    const fullKey = t.maker;
    const shortKey = shortAddr(t.maker);
    const existing = map.get(fullKey) ?? { settles: 0, lastEpoch: 0, asMakerAddr: t.maker };
    existing.settles += 1;
    if (t.settledAtEpoch > existing.lastEpoch) existing.lastEpoch = t.settledAtEpoch;
    map.set(fullKey, existing);
    map.set(shortKey, existing);    // alias: short → same stats record
  }
  return map;
}

/* ============ Maker profile aggregation ============ */

export type MakerProfile = {
  address: string;
  totalPosted: number;       // every OrderPosted event with this maker
  totalSettled: number;      // count from OrderSettled join (maker side)
  totalCancelled: number;    // OrderCancelled events touching maker's orders
  lastActivityMs: number | null;
  recentPosted: Array<{ orderId: string; pair: string; timestampMs: number; blobId: string }>;
};

/** Aggregate on-chain stats for a single maker. Fetches OrderPosted events
 *  in bulk, filters client-side by maker address — cheap on volume but
 *  costs one extra suix_queryEvents to capture cancellations. */
export async function fetchMakerProfile(
  address: string,
  network: "mainnet" | "testnet" | "devnet" = SUI_NETWORK_FOR_EVENTS,
): Promise<MakerProfile> {
  if (!SEALED_PAIR_PACKAGE_ID) {
    return {
      address, totalPosted: 0, totalSettled: 0, totalCancelled: 0,
      lastActivityMs: null, recentPosted: [],
    };
  }
  const targetLower = address.toLowerCase();
  // 1. Posted events (filter by maker) — let fetch errors bubble to the
  // modal so the user sees the real reason instead of a silent zero count.
  const postedRes = await fetch("/api/sui", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      method: "suix_queryEvents",
      params: [
        { MoveEventType: `${SEALED_PAIR_PACKAGE_ID}::${MODULE}::OrderPosted` },
        null, 100, true,
      ],
      network,
    }),
  });
  if (!postedRes.ok) throw new Error(`Posted events fetch failed (${postedRes.status})`);
  let postedEvents: RpcEvent[] = [];
  {
    const json = (await postedRes.json()) as { result?: QueryEventsResp };
    postedEvents = (json.result?.data ?? []).filter((evt) => {
      const p = evt.parsedJson as Partial<OrderPostedEvent>;
      return p.maker?.toLowerCase() === targetLower;
    });
  }
  // 2. Settled count — join via enrichSettledEvents which carries maker field
  const settledEvents = await listSettledEvents({ network, limit: 100 });
  const enriched = settledEvents.length > 0 ? await enrichSettledEvents(settledEvents, network) : [];
  const mineSettled = enriched.filter((t) => t.maker.toLowerCase() === targetLower);
  // 3. Cancelled events (touching maker's orders — we just look up by orderId)
  let cancelledCount = 0;
  try {
    const res = await fetch("/api/sui", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method: "suix_queryEvents",
        params: [
          { MoveEventType: `${SEALED_PAIR_PACKAGE_ID}::${MODULE}::OrderCancelled` },
          null, 100, true,
        ],
        network,
      }),
    });
    if (res.ok) {
      const json = (await res.json()) as { result?: QueryEventsResp };
      const cancelledIds = new Set(
        (json.result?.data ?? [])
          .map((evt) => (evt.parsedJson as { order_id?: string }).order_id)
          .filter(Boolean) as string[],
      );
      const myOrderIds = new Set(
        postedEvents
          .map((evt) => (evt.parsedJson as { order_id?: string }).order_id)
          .filter(Boolean) as string[],
      );
      for (const id of cancelledIds) if (myOrderIds.has(id)) cancelledCount += 1;
    }
  } catch {/* ignore */ }
  // 4. Last activity = max timestamp across all events for this maker
  let lastActivityMs: number | null = null;
  for (const evt of postedEvents) {
    if (evt.timestampMs) lastActivityMs = Math.max(lastActivityMs ?? 0, Number(evt.timestampMs));
  }
  // settledAtEpoch isn't a wall-clock; skip mineSettled here unless a
  // future change adds an event-level timestamp to OrderSettled.
  const recentPosted = postedEvents.slice(0, 6).map((evt) => {
    const p = evt.parsedJson as Partial<OrderPostedEvent>;
    return {
      orderId: p.order_id ?? "",
      pair: `${p.give_kind ?? "?"}/${p.get_kind ?? "?"}`,
      timestampMs: evt.timestampMs ? Number(evt.timestampMs) : 0,
      blobId: decodeBytesField((evt.parsedJson as { blob_id?: unknown }).blob_id),
    };
  });
  return {
    address,
    totalPosted: postedEvents.length,
    totalSettled: mineSettled.length,
    totalCancelled: cancelledCount,
    lastActivityMs,
    recentPosted,
  };
}

/* ============ Maker inbox — incoming activity on my orders ============ */

export type InboxItem = {
  kind: "locked" | "counter";
  orderId: string;
  blobId: string;
  pair: string;
  actor: string | null;     // taker for locked items, proposer for counters
  timestampMs: number;      // best-known timestamp
  txDigest: string | null;  // null for counter-offers (off-chain)
};

/** Aggregate maker-side incoming activity: who locked my orders + who
 *  sent counter-offers. Reads OrderPosted (filter by maker) → OrderLocked
 *  (filter by my orderIds) → localStorage counters per orderId. */
export async function fetchMakerInbox(
  makerAddr: string,
  network: "mainnet" | "testnet" | "devnet" = SUI_NETWORK_FOR_EVENTS,
): Promise<{ items: InboxItem[]; lockedCount: number; counterCount: number; orderCount: number }> {
  if (!SEALED_PAIR_PACKAGE_ID || !makerAddr) {
    return { items: [], lockedCount: 0, counterCount: 0, orderCount: 0 };
  }
  const target = makerAddr.toLowerCase();

  // 1. All OrderPosted events filtered by maker → my orderIds + blob/pair lookup.
  // Page size 250 gives ~3x headroom over the typical hackathon volume so a
  // judge testing aggressively doesn't silently truncate the inbox.
  const postedRes = await fetch("/api/sui", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      method: "suix_queryEvents",
      params: [
        { MoveEventType: `${SEALED_PAIR_PACKAGE_ID}::${MODULE}::OrderPosted` },
        null, 250, true,
      ],
      network,
    }),
  });
  if (!postedRes.ok) {
    return { items: [], lockedCount: 0, counterCount: 0, orderCount: 0 };
  }
  const postedJson = (await postedRes.json()) as { result?: QueryEventsResp };
  const myPosted = (postedJson.result?.data ?? []).filter((evt) => {
    const p = evt.parsedJson as Partial<OrderPostedEvent>;
    return p.maker?.toLowerCase() === target;
  });
  const myOrders = new Map<string, { blobId: string; pair: string }>();
  for (const evt of myPosted) {
    const p = evt.parsedJson as Partial<OrderPostedEvent>;
    if (!p.order_id) continue;
    myOrders.set(p.order_id, {
      blobId: decodeBytesField(p.blob_id),
      pair: `${p.give_kind ?? "?"}/${p.get_kind ?? "?"}`,
    });
  }
  const myOrderIds = new Set(myOrders.keys());

  // 2. OrderLocked events touching my orderIds — 250 page size to match.
  const lockedRes = await fetch("/api/sui", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      method: "suix_queryEvents",
      params: [
        { MoveEventType: `${SEALED_PAIR_PACKAGE_ID}::${MODULE}::OrderLocked` },
        null, 250, true,
      ],
      network,
    }),
  });
  const items: InboxItem[] = [];
  if (lockedRes.ok) {
    const lockedJson = (await lockedRes.json()) as { result?: QueryEventsResp };
    for (const evt of lockedJson.result?.data ?? []) {
      const p = evt.parsedJson as { order_id?: string; taker?: string };
      if (!p.order_id || !myOrderIds.has(p.order_id)) continue;
      const meta = myOrders.get(p.order_id)!;
      items.push({
        kind: "locked",
        orderId: p.order_id,
        blobId: meta.blobId,
        pair: meta.pair,
        actor: p.taker ?? null,
        timestampMs: evt.timestampMs ? Number(evt.timestampMs) : 0,
        txDigest: evt.id.txDigest,
      });
    }
  }

  // 3. Counter-offers from localStorage, one per orderId.
  let counterCount = 0;
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem("sealedpair:counters:index");
      const idx = raw ? (JSON.parse(raw) as string[]) : [];
      for (const oid of idx) {
        if (!myOrderIds.has(oid)) continue;
        const cRaw = window.localStorage.getItem(`sealedpair:counters:${oid}`);
        if (!cRaw) continue;
        const list = JSON.parse(cRaw) as Array<{ proposedBy: string; createdAt: number; status: string }>;
        for (const c of list) {
          if (c.status !== "pending") continue;
          counterCount += 1;
          const meta = myOrders.get(oid)!;
          items.push({
            kind: "counter",
            orderId: oid,
            blobId: meta.blobId,
            pair: meta.pair,
            actor: c.proposedBy,
            timestampMs: c.createdAt,
            txDigest: null,
          });
        }
      }
    } catch { /* localStorage may be unavailable */ }
  }

  items.sort((a, b) => b.timestampMs - a.timestampMs);
  return {
    items,
    lockedCount: items.filter((i) => i.kind === "locked").length,
    counterCount,
    orderCount: myOrders.size,
  };
}

/* ============ Wallet portfolio ============ */

export type CoinBalance = {
  coinType: string;
  symbol: string;          // best-effort short name derived from type
  totalBalance: string;    // raw u64 string
  display: string;         // human-readable with assumed decimals
  coinObjectCount: number;
};

/** Pretty-format a u64 balance string given an assumed decimals. */
function formatBalance(raw: string, decimals: number): string {
  const big = BigInt(raw);
  if (big === 0n) return "0";
  const divisor = 10n ** BigInt(decimals);
  const whole = big / divisor;
  const frac = big % divisor;
  if (frac === 0n) return whole.toLocaleString("en-US");
  const fracStr = frac.toString().padStart(decimals, "0").slice(0, 4).replace(/0+$/, "");
  return `${whole.toLocaleString("en-US")}${fracStr ? "." + fracStr : ""}`;
}

/** Best-effort symbol + decimals from a coinType. SUI is 9 decimals;
 *  USDC/USDT on Sui are 6; everything else is rendered raw with 0 decimals. */
function describeCoin(coinType: string): { symbol: string; decimals: number } {
  if (coinType === "0x2::sui::SUI" || coinType.endsWith("::sui::SUI")) return { symbol: "SUI", decimals: 9 };
  const last = coinType.split("::").pop() ?? coinType;
  const symbol = last.toUpperCase();
  if (symbol === "USDC" || symbol === "USDT") return { symbol, decimals: 6 };
  if (symbol === "WAL") return { symbol, decimals: 9 };
  if (symbol === "DEEP") return { symbol, decimals: 6 };
  return { symbol, decimals: 0 };
}

/** Fetch real wallet balances for the connected address. One RPC call. */
export async function fetchWalletBalances(
  address: string,
  network: "mainnet" | "testnet" | "devnet" = SUI_NETWORK_FOR_EVENTS,
): Promise<CoinBalance[]> {
  try {
    const res = await fetch("/api/sui", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method: "suix_getAllBalances",
        params: [address],
        network,
      }),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      result?: Array<{ coinType: string; totalBalance: string; coinObjectCount: number }>;
    };
    const items = json.result ?? [];
    return items
      .map<CoinBalance>((b) => {
        const { symbol, decimals } = describeCoin(b.coinType);
        // Guard malformed balance strings — BigInt("") throws.
        const balance = /^\d+$/.test(b.totalBalance) ? b.totalBalance : "0";
        return {
          coinType: b.coinType,
          symbol,
          totalBalance: balance,
          display: formatBalance(balance, decimals),
          coinObjectCount: b.coinObjectCount,
        };
      })
      .sort((a, b) => {
        // SUI first, then everything else by raw balance desc. Use BigInt
        // diff sign (not Number cast) — precision loss above 2^53 swaps
        // the comparator's sign and yields garbage ordering.
        if (a.symbol === "SUI") return -1;
        if (b.symbol === "SUI") return 1;
        const diff = BigInt(b.totalBalance) - BigInt(a.totalBalance);
        return diff < 0n ? -1 : diff > 0n ? 1 : 0;
      });
  } catch {
    return [];
  }
}

/* ============ Per-order event timeline ============ */

export type TimelineEvent = {
  kind: "posted" | "locked" | "revealed" | "settled" | "cancelled";
  txDigest: string;
  timestampMs: number;
};

/** Fetch every event from the deployed package, filter to those touching
 *  the given orderId, return chronologically. 5 RPC calls in parallel —
 *  one per event type — which is acceptable for a single-order detail
 *  view. Returns [] when the package isn't deployed. */
export async function fetchOrderTimeline(
  orderId: string,
  network: "mainnet" | "testnet" | "devnet" = SUI_NETWORK_FOR_EVENTS,
  limitPerType = 100,
): Promise<TimelineEvent[]> {
  if (!SEALED_PAIR_PACKAGE_ID || !orderId) return [];
  const idLower = orderId.toLowerCase();
  const kinds: Array<{ suffix: string; kind: TimelineEvent["kind"] }> = [
    { suffix: "OrderPosted", kind: "posted" },
    { suffix: "OrderLocked", kind: "locked" },
    { suffix: "OrderRevealed", kind: "revealed" },
    { suffix: "OrderSettled", kind: "settled" },
    { suffix: "OrderCancelled", kind: "cancelled" },
  ];
  const queryOne = async (k: typeof kinds[0]) => {
    try {
      const res = await fetch("/api/sui", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: "suix_queryEvents",
          params: [
            { MoveEventType: `${SEALED_PAIR_PACKAGE_ID}::${MODULE}::${k.suffix}` },
            null, limitPerType, true,
          ],
          network,
        }),
      });
      if (!res.ok) return [];
      const json = (await res.json()) as { result?: QueryEventsResp };
      const events = json.result?.data ?? [];
      const matches: TimelineEvent[] = [];
      for (const evt of events) {
        const p = evt.parsedJson as { order_id?: string };
        if (p.order_id?.toLowerCase() === idLower) {
          matches.push({
            kind: k.kind,
            txDigest: evt.id.txDigest,
            timestampMs: evt.timestampMs ? Number(evt.timestampMs) : 0,
          });
        }
      }
      return matches;
    } catch {
      return [];
    }
  };
  const all = (await Promise.all(kinds.map(queryOne))).flat();
  return all.sort((a, b) => a.timestampMs - b.timestampMs);
}

/* ============ Recent activity (multi-event merged feed) ============ */

export type ActivityKind = "posted" | "locked" | "revealed" | "settled" | "cancelled";

export type ActivityItem = {
  kind: ActivityKind;
  orderId: string;
  actor: string;          // maker for posted, taker for locked, otherwise orderId
  pair: string;           // e.g., "SUI/USDC" — only known for posted/locked
  txDigest: string;
  timestampMs: number;
};

/** Merge ALL 5 on-chain event types into one time-sorted feed for the live
 *  ticker. Each event type queried in parallel via Promise.all so the
 *  total latency is the slowest single call, not the sum. Pair data is
 *  available on Posted (full event payload) and Locked (taker + amount);
 *  other kinds carry just orderId so the ticker only shows IDs there. */
export async function listRecentActivity(
  network: "mainnet" | "testnet" | "devnet" = SUI_NETWORK_FOR_EVENTS,
  limit = 20,
): Promise<ActivityItem[]> {
  if (!SEALED_PAIR_PACKAGE_ID) return [];
  const queryEvent = async (suffix: string, n: number) => {
    try {
      const res = await fetch("/api/sui", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: "suix_queryEvents",
          params: [
            { MoveEventType: `${SEALED_PAIR_PACKAGE_ID}::${MODULE}::${suffix}` },
            null, n, true,
          ],
          network,
        }),
      });
      if (!res.ok) return [];
      const json = (await res.json()) as { result?: QueryEventsResp };
      return json.result?.data ?? [];
    } catch {
      return [];
    }
  };
  const [posted, locked, revealed, settled, cancelled] = await Promise.all([
    queryEvent("OrderPosted", limit),
    queryEvent("OrderLocked", limit),
    queryEvent("OrderRevealed", limit),
    queryEvent("OrderSettled", limit),
    queryEvent("OrderCancelled", limit),
  ]);
  const items: ActivityItem[] = [];
  for (const evt of posted) {
    const p = evt.parsedJson as Partial<OrderPostedEvent>;
    if (!p.order_id || !p.maker) continue;
    items.push({
      kind: "posted",
      orderId: p.order_id,
      actor: p.maker,
      pair: `${p.give_kind ?? "?"}/${p.get_kind ?? "?"}`,
      txDigest: evt.id.txDigest,
      timestampMs: evt.timestampMs ? Number(evt.timestampMs) : 0,
    });
  }
  for (const evt of locked) {
    const p = evt.parsedJson as { order_id?: string; taker?: string };
    if (!p.order_id) continue;
    items.push({
      kind: "locked",
      orderId: p.order_id,
      actor: p.taker ?? p.order_id,
      pair: "",
      txDigest: evt.id.txDigest,
      timestampMs: evt.timestampMs ? Number(evt.timestampMs) : 0,
    });
  }
  for (const evt of revealed) {
    const p = evt.parsedJson as { order_id?: string };
    if (!p.order_id) continue;
    items.push({
      kind: "revealed",
      orderId: p.order_id,
      actor: p.order_id,
      pair: "",
      txDigest: evt.id.txDigest,
      timestampMs: evt.timestampMs ? Number(evt.timestampMs) : 0,
    });
  }
  for (const evt of settled) {
    const p = evt.parsedJson as { order_id?: string };
    if (!p.order_id) continue;
    items.push({
      kind: "settled",
      orderId: p.order_id,
      actor: p.order_id,
      pair: "",
      txDigest: evt.id.txDigest,
      timestampMs: evt.timestampMs ? Number(evt.timestampMs) : 0,
    });
  }
  for (const evt of cancelled) {
    const p = evt.parsedJson as { order_id?: string };
    if (!p.order_id) continue;
    items.push({
      kind: "cancelled",
      orderId: p.order_id,
      actor: p.order_id,
      pair: "",
      txDigest: evt.id.txDigest,
      timestampMs: evt.timestampMs ? Number(evt.timestampMs) : 0,
    });
  }
  return items.sort((a, b) => b.timestampMs - a.timestampMs).slice(0, limit);
}

/* ============ Move module introspection ============ */

/** Shape of the slice we care about from `sui_getNormalizedMoveModule`. */
export type NormalizedModule = {
  exposedFunctions: Record<string, {
    visibility: string;
    isEntry: boolean;
    parameters: unknown[];
  }>;
  structs: Record<string, { abilities?: { abilities: string[] } }>;
  // The full event types live in `structs` with the `Copy + Drop` ability
  // set in Move 2024-edition; that's how the chain reports them.
};

/** Fetch the on-chain Move module structure for the deployed sealed_pair::order.
 *  Returns null when the package isn't deployed yet. Pure RPC read — no signing,
 *  works for any visitor. */
export async function fetchDeployedModule(
  network: "mainnet" | "testnet" | "devnet" = SUI_NETWORK_FOR_EVENTS,
): Promise<NormalizedModule | null> {
  if (!SEALED_PAIR_PACKAGE_ID) return null;
  try {
    const res = await fetch("/api/sui", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method: "sui_getNormalizedMoveModule",
        params: [SEALED_PAIR_PACKAGE_ID, MODULE],
        network,
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: NormalizedModule };
    return json.result ?? null;
  } catch {
    return null;
  }
}

// Side-effect: fmt is re-exported in case a caller wants synced formatting.
export { fmt };
