// Tatum Data API surface — wallet transaction history.
//
// Uses suix_queryTransactionBlocks through the same Tatum Sui gateway the
// rest of the app talks to, but filtered by FromAddress to give a clean
// "wallet activity" feed. This is the Sui equivalent of Tatum's Data API
// transactions endpoint (which is EVM-only at the time of writing).
//
// Returns the most recent N transaction blocks for the address, normalised
// to a small shape the UI can render: digest, timestamp, kind, gas used.

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const TATUM_URLS = {
  mainnet: "https://sui-mainnet.gateway.tatum.io",
  testnet: "https://sui-testnet.gateway.tatum.io",
  devnet:  "https://sui-devnet.gateway.tatum.io",
} as const;
type Network = keyof typeof TATUM_URLS;

const KEYS: Record<Network, string | undefined> = {
  mainnet: process.env.TATUM_API_KEY_MAINNET,
  testnet: process.env.TATUM_API_KEY_TESTNET,
  devnet:  process.env.TATUM_API_KEY_DEVNET,
};

type WalletTx = {
  digest: string;
  timestampMs: number | null;
  kind: string | null;          // "ProgrammableTransaction" / "Genesis" / etc
  gasUsedMist: string | null;
  status: "success" | "failure" | "unknown";
};

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const address = url.searchParams.get("address");
  const network = (url.searchParams.get("network") || "devnet") as Network;
  const limit = Math.min(Number(url.searchParams.get("limit")) || 10, 25);

  if (!address || !/^0x[0-9a-fA-F]{64}$/.test(address)) {
    return NextResponse.json({ error: "invalid address" }, { status: 400 });
  }
  if (!(network in TATUM_URLS)) {
    return NextResponse.json({ error: "invalid network" }, { status: 400 });
  }

  const upstream = TATUM_URLS[network];
  const apiKey = KEYS[network];
  const start = Date.now();

  try {
    const res = await fetch(upstream, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { "x-api-key": apiKey } : {}),
      },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "suix_queryTransactionBlocks",
        params: [
          { filter: { FromAddress: address }, options: { showInput: true, showEffects: true } },
          null,
          limit,
          true,        // descending order — newest first
        ],
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Tatum upstream ${res.status}`, latencyMs: Date.now() - start },
        { status: 502 },
      );
    }
    const json = (await res.json()) as {
      result?: { data?: Array<{
        digest: string;
        timestampMs?: string;
        transaction?: { data?: { transaction?: { kind?: string } } };
        effects?: { status?: { status?: string }; gasUsed?: { computationCost?: string; storageCost?: string; storageRebate?: string } };
      }> };
      error?: { message: string };
    };
    if (json.error) {
      return NextResponse.json({ error: json.error.message, latencyMs: Date.now() - start }, { status: 502 });
    }
    const txs: WalletTx[] = (json.result?.data ?? []).map((tx) => {
      const gas = tx.effects?.gasUsed;
      let used: string | null = null;
      if (gas) {
        try {
          const compute = BigInt(gas.computationCost ?? "0");
          const storage = BigInt(gas.storageCost ?? "0");
          const rebate = BigInt(gas.storageRebate ?? "0");
          used = (compute + storage - rebate).toString();
        } catch { used = null; }
      }
      const statusRaw = tx.effects?.status?.status;
      return {
        digest: tx.digest,
        timestampMs: tx.timestampMs ? Number(tx.timestampMs) : null,
        kind: tx.transaction?.data?.transaction?.kind ?? null,
        gasUsedMist: used,
        status: statusRaw === "success" ? "success" : statusRaw === "failure" ? "failure" : "unknown",
      };
    });
    return NextResponse.json({
      ok: true,
      network,
      address,
      count: txs.length,
      latencyMs: Date.now() - start,
      transactions: txs,
      sourcedFrom: "Tatum Data API · suix_queryTransactionBlocks",
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "fetch failed",
        latencyMs: Date.now() - start,
      },
      { status: 502 },
    );
  }
}
