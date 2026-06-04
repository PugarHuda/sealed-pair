// Integration health probe — pings Tatum RPC + Walrus publisher/aggregator
// in parallel and returns real latency + status for each. Used by the
// Vault's "Integration health" card so judges can see the integration is
// genuinely live.

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const TATUM_URLS = {
  mainnet: "https://sui-mainnet.gateway.tatum.io",
  testnet: "https://sui-testnet.gateway.tatum.io",
  devnet:  "https://sui-devnet.gateway.tatum.io",
} as const;

type Network = keyof typeof TATUM_URLS;

const WALRUS_PUBLISHERS = [
  "https://publisher.walrus-testnet.walrus.space",
  "https://wal-publisher-testnet.staketab.org",
  "https://walrus-testnet-publisher.trusted-point.com",
];
const WALRUS_AGGREGATORS = [
  "https://aggregator.walrus-testnet.walrus.space",
  "https://wal-aggregator-testnet.staketab.org",
  "https://walrus-testnet-aggregator.trusted-point.com",
];

async function timed<T>(fn: () => Promise<T>): Promise<{ ms: number; result: T | null; err?: string }> {
  const start = Date.now();
  try {
    const result = await fn();
    return { ms: Date.now() - start, result };
  } catch (e) {
    return { ms: Date.now() - start, result: null, err: e instanceof Error ? e.message : "fetch failed" };
  }
}

async function probeTatum(network: Network) {
  const key =
    network === "mainnet" ? process.env.TATUM_API_KEY_MAINNET :
    network === "testnet" ? process.env.TATUM_API_KEY_TESTNET :
    process.env.TATUM_API_KEY_DEVNET;
  const url = TATUM_URLS[network];
  const probe = await timed(async () => {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(key ? { "x-api-key": key } : {}),
      },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "sui_getChainIdentifier",
        params: [],
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as { result?: string };
    return json.result ?? null;
  });
  return {
    url,
    network,
    latencyMs: probe.ms,
    chainId: probe.result ?? null,
    ok: probe.result !== null,
    error: probe.err ?? null,
  };
}

async function probeWalrusEndpoint(url: string, kind: "publisher" | "aggregator") {
  // HEAD against the root — Walrus returns 404 for /, but the round-trip
  // still measures real network reachability. We treat any HTTP response
  // (200, 404, 405) as "endpoint alive"; only network errors are failures.
  const probe = await timed(async () => {
    const res = await fetch(url + "/", {
      method: "HEAD",
      signal: AbortSignal.timeout(8000),
    });
    return res.status;
  });
  return {
    url,
    kind,
    latencyMs: probe.ms,
    status: probe.result,
    ok: probe.result !== null,
    error: probe.err ?? null,
  };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const network = (url.searchParams.get("network") || "devnet") as Network;
  if (!(network in TATUM_URLS)) {
    return NextResponse.json({ ok: false, error: "invalid network" }, { status: 400 });
  }
  // Cap the whole probe at 4.5s so we never bump into Vercel's 5s free-tier
  // function deadline. Beats waiting on a single hung publisher.
  const overallTimeout = new Promise<never>((_, rej) =>
    setTimeout(() => rej(new Error("integration-health overall timeout")), 4_500),
  );
  try {
    const [tatum, ...walrus] = await Promise.race([
      Promise.all([
        probeTatum(network),
        ...WALRUS_PUBLISHERS.map((u) => probeWalrusEndpoint(u, "publisher")),
        ...WALRUS_AGGREGATORS.map((u) => probeWalrusEndpoint(u, "aggregator")),
      ]),
      overallTimeout,
    ]);
    const publishers = walrus.slice(0, WALRUS_PUBLISHERS.length);
    const aggregators = walrus.slice(WALRUS_PUBLISHERS.length);
    return NextResponse.json({
      ok: true,
      timestamp: Date.now(),
      tatum,
      walrus: { publishers, aggregators },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "probe failed" },
      { status: 502 },
    );
  }
}
