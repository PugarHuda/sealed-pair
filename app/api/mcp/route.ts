// MCP-compatible tool catalog for Sealed Pair.
//
// Returns a JSON manifest describing the public tools an AI agent can call
// against the Sealed Pair Sui dApp. Each tool is documented with name,
// description, JSON-schema input, and endpoint URL.
//
// This is a "lite" MCP server — it doesn't speak the full MCP transport
// (SSE streams, JSON-RPC server framing), but it exposes the same shape so
// an MCP bridge (e.g., a tiny stdio→HTTP adapter) can wrap it for Claude
// Desktop / Cursor / any other MCP client. The .mcp.json snippet in the
// repo root shows the canonical wiring.

import { NextResponse } from "next/server";
import { SEALED_PAIR_PACKAGE_ID, SUI_NETWORK_FOR_EVENTS } from "@/lib/sui-orders";

export const runtime = "nodejs";

export async function GET() {
  const base = `/api/mcp`;
  return NextResponse.json({
    name: "sealed-pair",
    version: "0.1.0",
    description:
      "Read-only MCP tools exposing the live Sealed Pair OTC board, maker reputation, and on-chain settlement verifier. " +
      "All endpoints proxy through the Tatum Sui RPC gateway.",
    network: SUI_NETWORK_FOR_EVENTS,
    deployedPackage: SEALED_PAIR_PACKAGE_ID,
    tools: [
      {
        name: "list_open_orders",
        description:
          "Return the most recent sealed RFQ orders posted on Sui — pair, size band, blobId, expiry. " +
          "Zombie-filtered (only state=OPEN passes).",
        endpoint: `${base}/list-orders`,
        method: "GET",
        inputSchema: {
          type: "object",
          properties: {
            limit: { type: "integer", default: 20, maximum: 50 },
          },
        },
      },
      {
        name: "verify_settle_digest",
        description:
          "Verify a Sui transaction digest emitted OrderSettled from the deployed sealed_pair::order package. " +
          "Useful for cross-checking shared settlement receipts before treating them as authoritative.",
        endpoint: `${base}/verify-digest`,
        method: "GET",
        inputSchema: {
          type: "object",
          properties: {
            digest: { type: "string", description: "Base58-encoded Sui tx digest (43-44 chars)" },
          },
          required: ["digest"],
        },
      },
      {
        name: "wallet_history",
        description:
          "Recent transaction blocks for a Sui address via Tatum Data API " +
          "(suix_queryTransactionBlocks filtered FromAddress). Returns digest, " +
          "timestamp, status, gas used per tx.",
        endpoint: `/api/tatum-data/wallet-history`,
        method: "GET",
        inputSchema: {
          type: "object",
          properties: {
            address: { type: "string", description: "0x + 64 hex Sui address" },
            network: { type: "string", enum: ["mainnet", "testnet", "devnet"], default: "devnet" },
            limit: { type: "integer", default: 10, maximum: 25 },
          },
          required: ["address"],
        },
      },
      {
        name: "maker_stats",
        description:
          "Aggregate on-chain stats for a specific maker address: posted / settled / cancelled counts, " +
          "success rate, last activity. Derived from OrderPosted + OrderSettled + OrderCancelled events.",
        endpoint: `${base}/maker-stats`,
        method: "GET",
        inputSchema: {
          type: "object",
          properties: {
            address: { type: "string", description: "Sui address (0x + 64 hex)" },
          },
          required: ["address"],
        },
      },
    ],
    notes: [
      "Read-only. Mutations (create_offer, lock_with_escrow, settle, cancel_open, cancel_expired) require wallet signing and are not exposed via MCP.",
      "Powered by Tatum's Sui RPC gateway — every tool ultimately hits sui-*.gateway.tatum.io with server-side API key custody.",
      "See .mcp.json in the repo root for a canonical client config.",
    ],
  });
}
