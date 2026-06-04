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
        const buf = Buffer.from(await res.arrayBuffer());
        // Walrus blobs are arbitrary user-uploaded bytes. We never want
        // them rendered on our first-party origin — a malicious uploader
        // could ship HTML / JS / SVG and pivot via XSS to drain
        // localStorage (sealedpair:* hints) or hijack the session.
        // Defense in depth:
        //  - Pin Content-Type to application/octet-stream (ignore upstream)
        //  - Force download with Content-Disposition: attachment
        //  - Block MIME sniffing
        //  - Sandbox via CSP (default-src 'none')
        return new NextResponse(buf, {
          status: 200,
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Disposition": `attachment; filename="blob-${objectId.slice(2, 14)}.bin"`,
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; sandbox",
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
