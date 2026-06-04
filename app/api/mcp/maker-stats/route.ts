// MCP tool: maker_stats
//
// Server-side wrapper around fetchMakerProfile — aggregates OrderPosted +
// OrderSettled + OrderCancelled events for a specific maker address.

import { NextRequest, NextResponse } from "next/server";
import { fetchMakerProfile, SUI_NETWORK_FOR_EVENTS } from "@/lib/sui-orders";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const address = url.searchParams.get("address")?.trim() ?? "";
  if (!/^0x[0-9a-fA-F]{64}$/.test(address)) {
    return NextResponse.json({ ok: false, error: "invalid address" }, { status: 400 });
  }
  try {
    const profile = await fetchMakerProfile(address, SUI_NETWORK_FOR_EVENTS);
    const successRate = profile.totalPosted > 0
      ? Math.round((profile.totalSettled / profile.totalPosted) * 100)
      : null;
    const tier =
      profile.totalSettled >= 10 ? "gold" :
      profile.totalSettled >= 3 ? "silver" :
      profile.totalSettled >= 1 ? "bronze" :
      "unrated";
    return NextResponse.json({
      ok: true,
      address: profile.address,
      tier,
      counts: {
        posted: profile.totalPosted,
        settled: profile.totalSettled,
        cancelled: profile.totalCancelled,
      },
      successRatePercent: successRate,
      lastActivityMs: profile.lastActivityMs,
      recentPosted: profile.recentPosted,
      sourcedFrom: "Tatum Sui RPC · suix_queryEvents (Posted + Settled + Cancelled)",
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "aggregation failed" },
      { status: 502 },
    );
  }
}
