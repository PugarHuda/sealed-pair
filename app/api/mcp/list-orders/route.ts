// MCP tool: list_open_orders
//
// Returns the most recent sealed RFQ orders posted on Sui. Server-side
// it calls suiRpc directly (the lib/sui-orders.ts helpers are designed
// for client-side use through /api/sui which doesn't work with relative
// URLs in server runtime).

import { NextRequest, NextResponse } from "next/server";
import { suiRpc } from "@/lib/sui-rpc";
import { SEALED_PAIR_PACKAGE_ID, SUI_NETWORK_FOR_EVENTS } from "@/lib/sui-orders";

export const runtime = "nodejs";

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

function decodeBytesField(raw: unknown): string {
  if (Array.isArray(raw)) return new TextDecoder().decode(new Uint8Array(raw));
  if (typeof raw === "string") return raw;
  return "";
}

export async function GET(req: NextRequest) {
  if (!SEALED_PAIR_PACKAGE_ID) {
    return NextResponse.json({ ok: false, error: "package not deployed" }, { status: 503 });
  }
  const url = new URL(req.url);
  const rawLimit = parseInt(url.searchParams.get("limit") ?? "", 10);
  const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 20, 1), 50);

  try {
    // 1. Query OrderPosted events.
    const eventType = `${SEALED_PAIR_PACKAGE_ID}::order::OrderPosted`;
    const events = await suiRpc<QueryEventsResp>(
      "suix_queryEvents",
      [{ MoveEventType: eventType }, null, limit, true],
      SUI_NETWORK_FOR_EVENTS,
    );
    const candidates = (events.data ?? []).map((evt) => {
      const p = evt.parsedJson as {
        order_id?: string; maker?: string; blob_id?: unknown;
        give_kind?: string; get_kind?: string; escrow_required?: string;
        expiry_epoch?: string;
      };
      if (!p.order_id || !p.maker) return null;
      return {
        orderId: p.order_id,
        maker: p.maker,
        blobId: decodeBytesField(p.blob_id),
        give: p.give_kind ?? "?",
        get: p.get_kind ?? "?",
        escrowRequiredMist: String(p.escrow_required ?? "0"),
        expiryEpoch: p.expiry_epoch ?? null,
        timestampMs: evt.timestampMs ? Number(evt.timestampMs) : null,
      };
    }).filter((o): o is NonNullable<typeof o> => o !== null);

    if (candidates.length === 0) {
      return NextResponse.json({
        ok: true, network: SUI_NETWORK_FOR_EVENTS, count: 0, orders: [],
        sourcedFrom: "Tatum Sui RPC · suix_queryEvents",
      });
    }

    // 2. Zombie filter — batched object state read, drop non-OPEN.
    const objs = await suiRpc<Array<{ data?: { content?: { fields?: { state?: unknown } } } }>>(
      "sui_multiGetObjects",
      [candidates.map((c) => c.orderId), { showContent: true }],
      SUI_NETWORK_FOR_EVENTS,
    );

    const openOnly = candidates.filter((_, i) => {
      const fields = objs[i]?.data?.content?.fields;
      if (!fields) return false;
      const state = Number(fields.state ?? -1);
      return state === 0;
    });

    return NextResponse.json({
      ok: true,
      network: SUI_NETWORK_FOR_EVENTS,
      count: openOnly.length,
      orders: openOnly,
      sourcedFrom: "Tatum Sui RPC · suix_queryEvents + sui_multiGetObjects",
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "fetch failed" },
      { status: 502 },
    );
  }
}
