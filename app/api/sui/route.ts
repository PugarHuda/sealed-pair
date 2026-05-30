// POST /api/sui — generic JSON-RPC proxy.
// Body: { method: string, params?: unknown[], network?: "mainnet"|"testnet"|"devnet" }
import { NextRequest, NextResponse } from "next/server";
import { suiRpc, RpcError } from "@/lib/sui-rpc";

export const runtime = "nodejs";

type Body = { method?: unknown; params?: unknown; network?: unknown };

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const method = typeof body.method === "string" ? body.method : null;
  if (!method) {
    return NextResponse.json({ error: "Body must include `method: string`" }, { status: 400 });
  }
  const params = Array.isArray(body.params) ? body.params : [];
  const network =
    body.network === "mainnet" || body.network === "testnet" || body.network === "devnet"
      ? body.network
      : undefined;

  try {
    const result = await suiRpc(method, params, network);
    return NextResponse.json({ result });
  } catch (e) {
    if (e instanceof RpcError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 502 });
    }
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
