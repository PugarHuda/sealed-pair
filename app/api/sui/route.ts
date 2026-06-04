// POST /api/sui — JSON-RPC proxy with method allowlist + body cap.
// Body shape:
//   { method: string, params?: unknown[], network?: "mainnet"|"testnet"|"devnet" }
import { NextRequest, NextResponse } from "next/server";
import { suiRpc, RpcError } from "@/lib/sui-rpc";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 32 * 1024; // 32 KB — way more than any legit RPC call

/**
 * Allowlist of Sui RPC methods we expose through this proxy. Anything off
 * the list is rejected so an unauthenticated client can't burn the
 * server-side Tatum quota through expensive or write-side endpoints.
 *
 * Writes (sui_executeTransactionBlock + dryRun) flow through the user's
 * wallet via dApp Kit, NOT this proxy — keeping them off the list is
 * intentional.
 */
const METHOD_ALLOWLIST = new Set<string>([
  // chain info
  "sui_getChainIdentifier",
  "sui_getLatestCheckpointSequenceNumber",
  "sui_getCheckpoint",
  "sui_getTotalTransactionBlocks",
  "sui_getProtocolConfig",
  // object reads
  "sui_getObject",
  "sui_multiGetObjects",
  "sui_tryGetPastObject",
  // event + tx history (powers the live RFQ board + Vault)
  "suix_queryEvents",
  "suix_queryTransactionBlocks",
  // tx-digest lookup (powers the digest verifier — confirms OrderSettled emitted)
  "sui_getEvents",
  // Move module introspection (powers the live deployed-contract panel)
  "sui_getNormalizedMoveModule",
  // dry-run / dev-inspect — pre-flight a tx without burning gas, used by
  // DealScreen's Fund button to confirm lock_with_escrow will succeed.
  "sui_dryRunTransactionBlock",
  "sui_devInspectTransactionBlock",
  // dynamic fields — Sui storage exposes Walrus's storage_node + system
  // state as dynamic children; needed for Walrus subsystem health reads.
  "suix_getDynamicFields",
  "suix_getDynamicFieldObject",
  // gas + system state (needed by frontend for expiry epoch calc)
  "suix_getReferenceGasPrice",
  "sui_getLatestSuiSystemState",
  // owned objects + balances (read-only)
  "suix_getOwnedObjects",
  "suix_getBalance",
  "suix_getAllBalances",
  "suix_getCoins",
]);

type Body = { method?: unknown; params?: unknown; network?: unknown };

export async function POST(req: NextRequest) {
  // Reject oversized bodies before allocating the buffer.
  const lenHeader = req.headers.get("content-length");
  if (lenHeader && Number(lenHeader) > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: `Body exceeds ${MAX_BODY_BYTES} byte cap` },
      { status: 413 },
    );
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const method = typeof body.method === "string" ? body.method : null;
  if (!method) {
    return NextResponse.json({ error: "Body must include `method: string`" }, { status: 400 });
  }
  if (!METHOD_ALLOWLIST.has(method)) {
    return NextResponse.json(
      { error: `Method '${method}' not permitted through proxy. Use a wallet for writes.` },
      { status: 403 },
    );
  }

  const params = Array.isArray(body.params) ? body.params : [];
  const network =
    body.network === "mainnet" || body.network === "testnet" || body.network === "devnet"
      ? body.network
      : undefined;

  try {
    const result = await suiRpc(method, params, network);
    return NextResponse.json({ result });
  } catch (e) {
    if (e instanceof RpcError) {
      // Don't leak upstream gateway internals; log server-side, return generic.
      console.warn("[sui-rpc] upstream error", { method, code: e.code, message: e.message });
      return NextResponse.json(
        { error: `Upstream RPC error (code ${e.code})` },
        { status: 502 },
      );
    }
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.warn("[sui-rpc] proxy error", { method, message: msg });
    return NextResponse.json({ error: "Proxy error" }, { status: 500 });
  }
}
