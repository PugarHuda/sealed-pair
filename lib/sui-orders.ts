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
 * Fetch the most recent `OrderPosted` events for the deployed package.
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
  return events.map(eventToOrder).filter((o): o is Order => o !== null);
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

  const base = makeOrder({
    maker: { name: makerName, handle: shortAddr(p.maker), color: addrColor(p.maker) },
    side: "SELL",
    give,
    get,
    amount: Math.max(1_000, approxGiveAmount),
    price: 0,
    createdAgo: evt.timestampMs ? timeAgo(Number(evt.timestampMs)) : "live",
    expiresIn: humanExpiry(p.expiry_epoch),
  });

  return {
    ...base,
    blobId,
    orderObj: String(p.order_id),
    sizeBand: bandFor(approxGiveAmount),
    escrowRequiredMist: escrowMistStr,
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

// Side-effect: fmt is re-exported in case a caller wants synced formatting.
export { fmt };
