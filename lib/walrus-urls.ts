// Client-safe Walrus URL builders. Kept separate from lib/walrus.ts
// (which is server-only) so React components can import the URL helpers
// without dragging the publisher/aggregator client into the browser bundle.

export type WalrusNetwork = "testnet" | "mainnet";

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
  (process.env.NEXT_PUBLIC_WALRUS_NETWORK as WalrusNetwork) || "testnet";

/** Primary aggregator base URL for the active Walrus network. */
export function walrusAggregatorBase(network: WalrusNetwork = DEFAULT_WALRUS_NETWORK): string {
  return AGGREGATORS[network][0];
}

/** Full URL to fetch a blob by id. */
export function walrusBlobUrl(blobId: string, network: WalrusNetwork = DEFAULT_WALRUS_NETWORK): string {
  return `${walrusAggregatorBase(network)}/v1/blobs/${blobId}`;
}
