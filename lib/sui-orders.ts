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

import type { AssetSym, Order } from "./types";
import { bandFor, fmt, makeOrder } from "./data";

/* ============ env resolution ============ */

/** The deployed Sealed Pair Move package ID (0x… form). null until deploy lands. */
export const SEALED_PAIR_PACKAGE_ID: string | null =
  (process.env.NEXT_PUBLIC_SEALED_PAIR_PACKAGE_ID || "").trim() || null;

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

  // blob_id arrives as either a number[] or a string we can decode.
  const blobIdRaw = (evt.parsedJson as { blob_id?: unknown }).blob_id;
  const blobId = decodeBytesField(blobIdRaw);

  const give = (p.give_kind ?? "SUI") as AssetSym;
  const get = (p.get_kind ?? "USDC") as AssetSym;
  // Amount/price are sealed off-chain — board only knows the size band, which
  // we approximate from the escrow size until reveal.
  const escrowAmount = Number(p.escrow_required ?? 0);

  const base = makeOrder({
    maker: { name: shortAddr(p.maker), handle: p.maker.slice(0, 10), color: "#7b8cff" },
    side: "SELL",
    give,
    get,
    amount: escrowAmount > 0 ? Math.max(10_000, Math.floor(escrowAmount / 100)) : 10_000,
    price: 0,
    createdAgo: evt.timestampMs ? timeAgo(Number(evt.timestampMs)) : "live",
    expiresIn: `epoch ${p.expiry_epoch ?? "?"}`,
  });

  return {
    ...base,
    blobId,
    orderObj: String(p.order_id),
    sizeBand: bandFor(escrowAmount > 0 ? escrowAmount : 10_000),
  };
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
