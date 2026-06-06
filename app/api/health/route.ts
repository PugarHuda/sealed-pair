// GET /api/health?network=mainnet|testnet|devnet
// Returns: { network, chainId, checkpoint, latencyMs, ok: true }  (or { ok: false, error })
// Uses two cheap reads to prove the gateway is alive AND advancing.
import { NextRequest, NextResponse } from "next/server";
import { suiRpc, RpcError } from "@/lib/sui-rpc";
import { parseNetwork, NETWORKS, SuiNetwork } from "@/lib/networks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // never cache liveness

// In-memory micro-cache. Multiple poll sources (NetworkPill, IntegrationHealth,
// duplicate browser tabs) frequently hit /api/health within a few seconds of
// each other — without this, every poll burns 2 Tatum credits and we hit the
// free-tier rate limit during demos. 8s is short enough that the checkpoint
// counter still appears "live" (Sui checkpoints land every ~3s).
type CacheEntry = { expires: number; payload: unknown; status: number };
const CACHE_MS = 8_000;
const cache = new Map<SuiNetwork, CacheEntry>();

export async function GET(req: NextRequest) {
  const network = parseNetwork(req.nextUrl.searchParams.get("network"));
  const now = Date.now();

  const cached = cache.get(network);
  if (cached && cached.expires > now) {
    return NextResponse.json(cached.payload, {
      status: cached.status,
      headers: { "x-health-cache": "hit" },
    });
  }

  const t0 = now;
  try {
    const [chainId, checkpoint] = await Promise.all([
      suiRpc<string>("sui_getChainIdentifier", [], network),
      suiRpc<string>("sui_getLatestCheckpointSequenceNumber", [], network),
    ]);
    const latencyMs = Date.now() - t0;
    const payload = {
      ok: true,
      network,
      networkName: NETWORKS[network].name,
      chainId,
      checkpoint,
      latencyMs,
    };
    cache.set(network, { expires: Date.now() + CACHE_MS, payload, status: 200 });
    return NextResponse.json(payload, { headers: { "x-health-cache": "miss" } });
  } catch (e) {
    // Surface upstream status (esp. 429) verbatim so the client can choose
    // a friendlier degraded UI rather than a generic red error pill.
    const upstreamStatus =
      e instanceof RpcError && e.code >= 400 && e.code < 600 ? e.code : 502;
    const msg = e instanceof Error ? e.message : "Unknown error";
    const payload = {
      ok: false as const,
      network,
      error: msg,
      upstreamStatus,
      latencyMs: Date.now() - t0,
    };
    // Cache errors for HALF the success TTL so we recover fast once the
    // upstream lets up, but still don't hammer Tatum during a 429 storm.
    cache.set(network, { expires: Date.now() + CACHE_MS / 2, payload, status: upstreamStatus });
    return NextResponse.json(payload, { status: upstreamStatus });
  }
}
