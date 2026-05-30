// PUT /api/walrus/store?epochs=5&deletable=true
// Raw body = the bytes to store. Forwards to a public Walrus publisher.
import { NextRequest, NextResponse } from "next/server";
import { walrusStore } from "@/lib/walrus";

export const runtime = "nodejs";
// Walrus's public publishers cap at 10 MiB.
export const maxDuration = 30;

export async function PUT(req: NextRequest) {
  const url = req.nextUrl;
  const epochs = numParam(url.searchParams.get("epochs"));
  const deletable = url.searchParams.get("deletable") === "true";
  const sendObjectTo = url.searchParams.get("send_object_to") || undefined;

  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.byteLength === 0) {
    return NextResponse.json({ error: "Empty body" }, { status: 400 });
  }
  if (buf.byteLength > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Body exceeds public publisher limit (10 MiB)" }, { status: 413 });
  }

  try {
    const result = await walrusStore(buf, { epochs, deletable, sendObjectTo });
    return NextResponse.json({
      ok: true,
      blobId: result.blobId,
      publisher: result.publisher,
      raw: result.raw,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}

function numParam(s: string | null) {
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
}
