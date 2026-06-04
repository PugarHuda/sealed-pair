// PUT /api/walrus/store?epochs=5&deletable=true
// Raw body = the bytes to store. Forwards to a public Walrus publisher.
import { NextRequest, NextResponse } from "next/server";
import { walrusStore } from "@/lib/walrus";

export const runtime = "nodejs";
// Walrus's public publishers cap at 10 MiB.
export const maxDuration = 30;

const MAX_BYTES = 10 * 1024 * 1024; // public publisher cap
// Cap epochs to keep a single user from burning the publisher's WAL budget
// with `?epochs=999999`. 20 epochs ≈ 20 weeks on testnet — far more than
// any demo needs.
const MAX_EPOCHS = 20;

export async function PUT(req: NextRequest) {
  const url = req.nextUrl;
  const epochs = numParam(url.searchParams.get("epochs"));
  const deletable = url.searchParams.get("deletable") === "true";
  const sendObjectTo = url.searchParams.get("send_object_to") || undefined;

  if (epochs !== undefined && epochs > MAX_EPOCHS) {
    return NextResponse.json(
      { error: `epochs must be ≤ ${MAX_EPOCHS}` },
      { status: 400 },
    );
  }
  if (sendObjectTo && !/^0x[0-9a-fA-F]{64}$/.test(sendObjectTo)) {
    return NextResponse.json(
      { error: "send_object_to must be a 0x… Sui address (32 bytes)" },
      { status: 400 },
    );
  }

  // Reject oversized payloads *before* reading the body into memory.
  const lenHeader = req.headers.get("content-length");
  if (lenHeader && Number(lenHeader) > MAX_BYTES) {
    return NextResponse.json(
      { error: "Body exceeds public publisher limit (10 MiB)" },
      { status: 413 },
    );
  }

  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.byteLength === 0) {
    return NextResponse.json({ error: "Empty body" }, { status: 400 });
  }
  if (buf.byteLength > MAX_BYTES) {
    return NextResponse.json(
      { error: "Body exceeds public publisher limit (10 MiB)" },
      { status: 413 },
    );
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
    // Log full message server-side; return a generic one to the client so we
    // don't leak the list of upstream publisher URLs.
    console.warn("[walrus-store] upstream error:", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { ok: false, error: "Upstream Walrus error — all publishers failed" },
      { status: 502 },
    );
  }
}

function numParam(s: string | null) {
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
}
