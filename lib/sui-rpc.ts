// Server-side Sui JSON-RPC client (uses Tatum gateway + API key from env).
// NEVER import this from a client component — the key would leak into the bundle.
import "server-only";
import { NETWORKS, parseNetwork, SuiNetwork } from "./networks";

type Json = unknown;
type RpcResponse<T> =
  | { jsonrpc: "2.0"; id: number | string; result: T }
  | { jsonrpc: "2.0"; id: number | string; error: { code: number; message: string } };

const KEY_FOR: Record<SuiNetwork, string | undefined> = {
  mainnet: process.env.TATUM_API_KEY_MAINNET,
  testnet: process.env.TATUM_API_KEY_TESTNET,
  devnet:  process.env.TATUM_API_KEY_TESTNET, // Tatum's testnet key works for devnet too
};

export class RpcError extends Error {
  constructor(public code: number, message: string) {
    super(message);
    this.name = "RpcError";
  }
}

let _id = 0;
const nextId = () => ++_id;

/**
 * Call a Sui JSON-RPC method through Tatum.
 * Pass `network` to target a specific chain; defaults to env SUI_NETWORK.
 */
export async function suiRpc<T = Json>(
  method: string,
  params: Json[] = [],
  network?: SuiNetwork,
): Promise<T> {
  const net = parseNetwork(network);
  const apiKey = KEY_FOR[net];
  if (!apiKey) {
    throw new RpcError(-1, `Missing TATUM_API_KEY for network "${net}". Set it in .env.local.`);
  }
  const url = NETWORKS[net].rpcUrl;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: nextId(),
      method,
      params,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new RpcError(res.status, `Tatum gateway returned HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const body = (await res.json()) as RpcResponse<T>;
  if ("error" in body) {
    throw new RpcError(body.error.code, body.error.message);
  }
  return body.result;
}
