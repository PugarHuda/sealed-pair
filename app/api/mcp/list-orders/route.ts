// MCP tool: list_open_orders
//
// Returns the most recent sealed RFQ orders posted on Sui, zombie-filtered
// to state=OPEN. Same code path the Board uses, exposed as a clean JSON
// endpoint for AI agents and other consumers.

import { NextRequest, NextResponse } from "next/server";
import { listOpenOrders, SUI_NETWORK_FOR_EVENTS } from "@/lib/sui-orders";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  // Defensive bounds: zero/negative/NaN all snap to default 20; max 50.
  const rawLimit = parseInt(url.searchParams.get("limit") ?? "", 10);
  const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 20, 1), 50);
  try {
    const orders = await listOpenOrders({ network: SUI_NETWORK_FOR_EVENTS, limit });
    return NextResponse.json({
      ok: true,
      network: SUI_NETWORK_FOR_EVENTS,
      count: orders.length,
      orders: orders.map((o) => ({
        orderId: o.orderObj,
        blobId: o.blobId,
        give: o.give,
        get: o.get,
        side: o.side,
        sizeBand: o.sizeBand,
        maker: typeof o.maker === "string" ? null : (o.maker as { addr?: string }).addr ?? null,
        expiresAtMs: o.expiresAtMs ?? null,
        escrowRequiredMist: o.escrowRequiredMist ?? null,
      })),
      sourcedFrom: "Tatum Sui RPC · suix_queryEvents + sui_multiGetObjects",
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "fetch failed" },
      { status: 502 },
    );
  }
}
