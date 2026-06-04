// MCP tool: maker_stats
//
// Server-side aggregation of OrderPosted + OrderSettled + OrderCancelled
// events for a maker. Uses suiRpc directly so it works in the route
// runtime (the client-side fetchMakerProfile relies on /api/sui which
// is a relative URL).

import { NextRequest, NextResponse } from "next/server";
import { suiRpc } from "@/lib/sui-rpc";
import { SEALED_PAIR_PACKAGE_ID, SUI_NETWORK_FOR_EVENTS } from "@/lib/sui-orders";

export const runtime = "nodejs";

type RpcEvent = {
  id: { txDigest: string; eventSeq: string };
  type: string;
  parsedJson: Record<string, unknown>;
  timestampMs?: string;
};

type QueryEventsResp = {
  data: RpcEvent[];
  hasNextPage: boolean;
  nextCursor: unknown;
};

function tier(settles: number) {
  if (settles >= 10) return "gold";
  if (settles >= 3) return "silver";
  if (settles >= 1) return "bronze";
  return "unrated";
}

export async function GET(req: NextRequest) {
  if (!SEALED_PAIR_PACKAGE_ID) {
    return NextResponse.json({ ok: false, error: "package not deployed" }, { status: 503 });
  }
  const url = new URL(req.url);
  const address = url.searchParams.get("address")?.trim() ?? "";
  if (!/^0x[0-9a-fA-F]{64}$/.test(address)) {
    return NextResponse.json({ ok: false, error: "invalid address" }, { status: 400 });
  }
  const target = address.toLowerCase();

  try {
    // Posted events — filter by maker client-side.
    const postedResp = await suiRpc<QueryEventsResp>(
      "suix_queryEvents",
      [
        { MoveEventType: `${SEALED_PAIR_PACKAGE_ID}::order::OrderPosted` },
        null, 100, true,
      ],
      SUI_NETWORK_FOR_EVENTS,
    );
    const postedAll = postedResp.data ?? [];
    const posted = postedAll.filter((evt) => {
      const p = evt.parsedJson as { maker?: string };
      return p.maker?.toLowerCase() === target;
    });
    const myOrderIds = new Set(
      posted.map((e) => (e.parsedJson as { order_id?: string }).order_id).filter(Boolean) as string[],
    );

    // Settled — count intersection with my orders.
    const settledResp = await suiRpc<QueryEventsResp>(
      "suix_queryEvents",
      [
        { MoveEventType: `${SEALED_PAIR_PACKAGE_ID}::order::OrderSettled` },
        null, 100, true,
      ],
      SUI_NETWORK_FOR_EVENTS,
    );
    const settled = (settledResp.data ?? []).filter((evt) => {
      const p = evt.parsedJson as { order_id?: string };
      return p.order_id ? myOrderIds.has(p.order_id) : false;
    });

    // Cancelled — same intersection.
    const cancelledResp = await suiRpc<QueryEventsResp>(
      "suix_queryEvents",
      [
        { MoveEventType: `${SEALED_PAIR_PACKAGE_ID}::order::OrderCancelled` },
        null, 100, true,
      ],
      SUI_NETWORK_FOR_EVENTS,
    );
    const cancelled = (cancelledResp.data ?? []).filter((evt) => {
      const p = evt.parsedJson as { order_id?: string };
      return p.order_id ? myOrderIds.has(p.order_id) : false;
    });

    // Last activity = max timestamp across all event types we filtered.
    let lastActivityMs: number | null = null;
    for (const e of [...posted, ...settled, ...cancelled]) {
      if (e.timestampMs) {
        const t = Number(e.timestampMs);
        if (Number.isFinite(t)) lastActivityMs = Math.max(lastActivityMs ?? 0, t);
      }
    }
    const successRate = posted.length > 0
      ? Math.round((settled.length / posted.length) * 100)
      : null;

    return NextResponse.json({
      ok: true,
      address,
      tier: tier(settled.length),
      counts: {
        posted: posted.length,
        settled: settled.length,
        cancelled: cancelled.length,
      },
      successRatePercent: successRate,
      lastActivityMs,
      sourcedFrom: "Tatum Sui RPC · suix_queryEvents (Posted + Settled + Cancelled)",
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "aggregation failed" },
      { status: 502 },
    );
  }
}
