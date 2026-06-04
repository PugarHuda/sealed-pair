// Walrus client (server-side). Talks to the public testnet publisher + aggregator.
// Docs: https://docs.wal.app  •  HTTP API: PUT /v1/blobs (publisher), GET /v1/blobs/<id> (aggregator)
import "server-only";

export type WalrusNetwork = "testnet" | "mainnet";

const PUBLISHERS: Record<WalrusNetwork, string[]> = {
  testnet: [
    "https://publisher.walrus-testnet.walrus.space",
    "https://wal-publisher-testnet.staketab.org",
    "https://walrus-testnet-publisher.trusted-point.com",
  ],
  mainnet: [
    "https://publisher.walrus-mainnet.walrus.space",
  ],
};

const AGGREGATORS: Record<WalrusNetwork, string[]> = {
  testnet: [
    "https://aggregator.walrus-testnet.walrus.space",
    "https://wal-aggregator-testnet.staketab.org",
    "https://walrus-testnet-aggregator.trusted-point.com",
  ],
  mainnet: [
    "https://aggregator.walrus-mainnet.walrus.space",
  ],
};

export const DEFAULT_WALRUS_NETWORK: WalrusNetwork =
  (process.env.WALRUS_NETWORK as WalrusNetwork) || "testnet";

// Client-safe URL helpers live in `lib/walrus-urls.ts` so React components
// can import them without dragging this server-only module into the
// browser bundle.

/** Response shape from publisher when storing a blob. */
export type StoreResponse = {
  newlyCreated?: {
    blobObject: {
      id: string;
      blobId: string;
      size: number;
      encodingType: string;
      storage: { startEpoch: number; endEpoch: number };
    };
    resourceOperation: unknown;
    cost: number;
  };
  alreadyCertified?: {
    blobId: string;
    event: { txDigest: string; eventSeq: string };
    endEpoch: number;
  };
};

/** Extract the blob ID from either response shape. */
export function extractBlobId(r: StoreResponse): string | null {
  return r.newlyCreated?.blobObject.blobId ?? r.alreadyCertified?.blobId ?? null;
}

export type StoreOptions = {
  epochs?: number; // storage duration in Walrus epochs (default 1)
  deletable?: boolean;
  sendObjectTo?: string; // Sui address to send the blob Sui object to
  network?: WalrusNetwork;
};

/** Upload bytes to a Walrus publisher. Tries each publisher in turn on failure. */
export async function walrusStore(
  bytes: ArrayBuffer | Uint8Array,
  opts: StoreOptions = {},
): Promise<{ blobId: string; raw: StoreResponse; publisher: string }> {
  const network = opts.network || DEFAULT_WALRUS_NETWORK;
  const params = new URLSearchParams();
  if (opts.epochs && opts.epochs > 0) params.set("epochs", String(opts.epochs));
  if (opts.deletable) params.set("deletable", "true");
  if (opts.sendObjectTo) params.set("send_object_to", opts.sendObjectTo);
  const qs = params.toString() ? `?${params.toString()}` : "";

  // fetch() body wants BodyInit. Convert to a fresh plain ArrayBuffer so
  // TypeScript treats it as ArrayBuffer (not ArrayBufferLike) — Web/Node fetch both accept Blob.
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const ab = new ArrayBuffer(view.byteLength);
  new Uint8Array(ab).set(view);
  const body = new Blob([ab]);
  const errors: string[] = [];

  for (const base of PUBLISHERS[network]) {
    try {
      const res = await fetch(`${base}/v1/blobs${qs}`, {
        method: "PUT",
        body,
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        errors.push(`${base}: HTTP ${res.status} ${text.slice(0, 120)}`);
        continue;
      }
      const json = (await res.json()) as StoreResponse;
      const blobId = extractBlobId(json);
      if (!blobId) {
        errors.push(`${base}: response had no blobId`);
        continue;
      }
      return { blobId, raw: json, publisher: base };
    } catch (e) {
      errors.push(`${base}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  throw new Error(`All Walrus publishers failed:\n${errors.join("\n")}`);
}

/** Download a blob by ID from a Walrus aggregator. Tries each in turn on failure. */
export async function walrusRead(
  blobId: string,
  network: WalrusNetwork = DEFAULT_WALRUS_NETWORK,
): Promise<{ bytes: ArrayBuffer; aggregator: string }> {
  const errors: string[] = [];
  for (const base of AGGREGATORS[network]) {
    try {
      const res = await fetch(`${base}/v1/blobs/${encodeURIComponent(blobId)}`, {
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        errors.push(`${base}: HTTP ${res.status}`);
        continue;
      }
      return { bytes: await res.arrayBuffer(), aggregator: base };
    } catch (e) {
      errors.push(`${base}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  throw new Error(`All Walrus aggregators failed:\n${errors.join("\n")}`);
}
