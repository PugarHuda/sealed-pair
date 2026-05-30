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
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(bytes.byteLength),
        "X-Walrus-Aggregator": aggregator,
        // Walrus is content-addressed — safe to cache forever.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
