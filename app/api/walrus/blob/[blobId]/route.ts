// GET /api/walrus/blob/<blobId>
// Returns the raw blob bytes (Content-Type: application/octet-stream).
import { NextRequest, NextResponse } from "next/server";
import { walrusRead } from "@/lib/walrus";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { blobId: string } },
) {
  const { blobId } = params;
  if (!blobId || blobId.length < 10) {
    return NextResponse.json({ error: "Invalid blobId" }, { status: 400 });
  }
  try {
    const { bytes, aggregator } = await walrusRead(blobId);
    // Hardening — Walrus blobs are arbitrary user-uploaded bytes. Force
    // every defensive header so a malicious uploader can't ship HTML / JS
    // / SVG that browsers would execute on our first-party origin (and
    // exfiltrate localStorage hints, cookies, etc.).
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="blob-${blobId.slice(0, 16)}.bin"`,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Content-Length": String(bytes.byteLength),
        "X-Walrus-Aggregator": aggregator,
        // Walrus is content-addressed — safe to cache forever.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (e) {
    console.warn("[walrus-read] upstream error", { blobId, error: e instanceof Error ? e.message : e });
    return NextResponse.json(
      { error: "Upstream Walrus error — blob not retrievable" },
      { status: 502 },
    );
  }
}
