// Reverse lookup: given a Walrus blob's Sui storage object id, fetch the
// blob bytes through the aggregator's /v1/blobs/by-object-id/{objId}
// endpoint. Same multi-aggregator failover as the regular blob route.

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const AGGREGATORS = [
  "https://aggregator.walrus-testnet.walrus.space",
  "https://wal-aggregator-testnet.staketab.org",
  "https://walrus-testnet-aggregator.trusted-point.com",
];

const OBJECT_ID_RE = /^0x[0-9a-fA-F]{64}$/;

export async function GET(
  _req: NextRequest,
  { params }: { params: { objectId: string } },
) {
  const objectId = params.objectId?.trim() ?? "";
  if (!OBJECT_ID_RE.test(objectId)) {
    return NextResponse.json(
      { ok: false, error: "objectId must be a Sui 0x + 64 hex address" },
      { status: 400 },
    );
  }
  const errors: string[] = [];
  for (const base of AGGREGATORS) {
    try {
      const res = await fetch(`${base}/v1/blobs/by-object-id/${objectId}`, {
        method: "GET",
        signal: AbortSignal.timeout(12_000),
      });
      if (res.ok) {
        // Re-stream the body to the client, preserving content-type.
        const buf = Buffer.from(await res.arrayBuffer());
        return new NextResponse(buf, {
          status: 200,
          headers: {
            "Content-Type": res.headers.get("content-type") ?? "application/octet-stream",
            "X-Walrus-Aggregator": new URL(base).host,
            "X-Walrus-Storage-Object": objectId,
            "Access-Control-Allow-Origin": "*",
          },
        });
      }
      errors.push(`${new URL(base).host} → ${res.status}`);
    } catch (e) {
      errors.push(`${new URL(base).host} → ${e instanceof Error ? e.message : "err"}`);
    }
  }
  return NextResponse.json(
    { ok: false, error: "All Walrus aggregators failed", attempts: errors },
    { status: 502 },
  );
}
