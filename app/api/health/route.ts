// GET /api/health?network=mainnet|testnet|devnet
// Returns: { network, chainId, checkpoint, latencyMs, ok: true }  (or { ok: false, error })
// Uses two cheap reads to prove the gateway is alive AND advancing.
import { NextRequest, NextResponse } from "next/server";
import { suiRpc } from "@/lib/sui-rpc";
import { parseNetwork, NETWORKS } from "@/lib/networks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // never cache liveness

export async function GET(req: NextRequest) {
  const network = parseNetwork(req.nextUrl.searchParams.get("network"));
  const t0 = Date.now();
  try {
    const [chainId, checkpoint] = await Promise.all([
      suiRpc<string>("sui_getChainIdentifier", [], network),
      suiRpc<string>("sui_getLatestCheckpointSequenceNumber", [], network),
    ]);
    const latencyMs = Date.now() - t0;
    return NextResponse.json({
      ok: true,
      network,
      networkName: NETWORKS[network].name,
      chainId,
      checkpoint,
      latencyMs,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { ok: false, network, error: msg, latencyMs: Date.now() - t0 },
      { status: 502 },
    );
  }
}
