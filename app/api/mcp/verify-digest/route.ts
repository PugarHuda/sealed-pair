// MCP tool: verify_settle_digest
//
// Server-side mirror of components/app/digest-verifier.tsx — given a
// transaction digest, calls sui_getEvents and confirms it emitted
// OrderSettled from the deployed sealed_pair::order package.

import { NextRequest, NextResponse } from "next/server";
import { SEALED_PAIR_PACKAGE_ID, SUI_NETWORK_FOR_EVENTS } from "@/lib/sui-orders";

export const runtime = "nodejs";

const TATUM_URLS = {
  mainnet: "https://sui-mainnet.gateway.tatum.io",
  testnet: "https://sui-testnet.gateway.tatum.io",
  devnet:  "https://sui-devnet.gateway.tatum.io",
} as const;

const KEYS = {
  mainnet: process.env.TATUM_API_KEY_MAINNET,
  testnet: process.env.TATUM_API_KEY_TESTNET,
  devnet:  process.env.TATUM_API_KEY_DEVNET,
};

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const digest = url.searchParams.get("digest")?.trim() ?? "";
  if (!/^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(digest)) {
    return NextResponse.json({ ok: false, error: "invalid digest" }, { status: 400 });
  }
  if (!SEALED_PAIR_PACKAGE_ID) {
    return NextResponse.json({ ok: false, error: "package not deployed" }, { status: 503 });
  }
  const upstream = TATUM_URLS[SUI_NETWORK_FOR_EVENTS];
  const key = KEYS[SUI_NETWORK_FOR_EVENTS];
  try {
    const res = await fetch(upstream, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(key ? { "x-api-key": key } : {}),
      },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "sui_getEvents",
        params: [digest],
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return NextResponse.json({ ok: false, error: `upstream ${res.status}` }, { status: 502 });
    const json = (await res.json()) as {
      result?: Array<{ type: string; parsedJson?: { order_id?: string; settled_at_epoch?: string } }>;
      error?: { message: string };
    };
    if (json.error) return NextResponse.json({ ok: false, error: json.error.message }, { status: 502 });
    const events = json.result ?? [];
    const settledType = `${SEALED_PAIR_PACKAGE_ID}::order::OrderSettled`;
    const match = events.find((e) => e.type === settledType);
    if (match) {
      return NextResponse.json({
        ok: true,
        verified: true,
        digest,
        orderId: match.parsedJson?.order_id ?? null,
        settledAtEpoch: match.parsedJson?.settled_at_epoch ?? null,
        emittedFrom: settledType,
        suiScanUrl: `https://suiscan.xyz/${SUI_NETWORK_FOR_EVENTS}/tx/${digest}`,
      });
    }
    return NextResponse.json({
      ok: true,
      verified: false,
      reason: events.length > 0
        ? `tx exists but emitted: ${events.map((e) => e.type.split("::").pop()).join(", ")}`
        : "tx emitted no events from this package",
      otherEventTypes: events.map((e) => e.type),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "lookup failed" },
      { status: 502 },
    );
  }
}
