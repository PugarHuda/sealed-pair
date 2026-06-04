"use client";
// Integration health panel — real probes of Tatum Sui RPC + every Walrus
// publisher and aggregator we use. Makes the integration depth visible:
// not just "we use Tatum" in the README, but live latency numbers
// rendered from a parallel-fan-out backend probe.

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/primitives";
import Icon from "@/components/ui/icon";
import { lblS } from "@/components/app/shared";
import { SUI_NETWORK_FOR_EVENTS } from "@/lib/sui-orders";

type Probe = { url: string; latencyMs: number; ok: boolean; error: string | null };
type TatumProbe = Probe & { network: string; chainId: string | null };
type WalrusProbe = Probe & { kind: "publisher" | "aggregator"; status: number | null };
type HealthResponse = {
  timestamp: number;
  tatum: TatumProbe;
  walrus: { publishers: WalrusProbe[]; aggregators: WalrusProbe[] };
};

function shortHost(url: string) {
  try {
    const h = new URL(url).host;
    return h.length > 32 ? h.slice(0, 30) + "…" : h;
  } catch {
    return url;
  }
}

function latencyColor(ms: number, ok: boolean) {
  if (!ok) return "var(--bad)";
  if (ms < 200) return "var(--good)";
  if (ms < 800) return "var(--warn)";
  return "var(--bad)";
}

export default function IntegrationHealth() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();
    const tick = async () => {
      try {
        const res = await fetch(`/api/integration-health?network=${SUI_NETWORK_FOR_EVENTS}`, {
          cache: "no-store",
          signal: ac.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as HealthResponse;
        if (!cancelled) { setData(json); setLoading(false); setError(null); }
      } catch (e) {
        if (cancelled) return;
        if (e instanceof Error && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "probe failed");
        setLoading(false);
      }
    };
    tick();
    const t = setInterval(tick, 30_000);
    return () => { cancelled = true; ac.abort(); clearInterval(t); };
  }, []);

  return (
    <Card pad={20} style={{ marginBottom: 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
        <Icon name="wave" size={15} style={{ color: "var(--accent-2)" }} />
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 14 }}>
          Integration health · Tatum + Walrus
        </div>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-faint)" }}>
          live probes every 30s
        </span>
      </div>
      {loading && (
        <div style={{ color: "var(--text-faint)", fontSize: 13 }}>Pinging endpoints…</div>
      )}
      {error && (
        <div style={{ color: "var(--bad)", fontSize: 13, fontWeight: 600 }}>{error}</div>
      )}
      {data && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          <Section title="Tatum Sui RPC">
            <Row
              host={shortHost(data.tatum.url)}
              ms={data.tatum.latencyMs}
              ok={data.tatum.ok}
              tag={data.tatum.network}
              sub={data.tatum.chainId ? `chainId ${data.tatum.chainId.slice(0, 8)}` : data.tatum.error || "no chainId"}
            />
            <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 8, lineHeight: 1.5 }}>
              All on-chain reads (events, objects, modules, balances) route through
              this Tatum gateway. Server-side proxy holds the API key.
            </div>
          </Section>
          <Section title="Walrus storage">
            <div style={{ ...lblS, fontSize: 10.5, marginTop: 4, marginBottom: 6 }}>Publishers ({data.walrus.publishers.length})</div>
            {data.walrus.publishers.map((p) => (
              <Row key={p.url} host={shortHost(p.url)} ms={p.latencyMs} ok={p.ok} sub={p.status ? `HTTP ${p.status}` : p.error || ""} compact />
            ))}
            <div style={{ ...lblS, fontSize: 10.5, marginTop: 10, marginBottom: 6 }}>Aggregators ({data.walrus.aggregators.length})</div>
            {data.walrus.aggregators.map((p) => (
              <Row key={p.url} host={shortHost(p.url)} ms={p.latencyMs} ok={p.ok} sub={p.status ? `HTTP ${p.status}` : p.error || ""} compact />
            ))}
          </Section>
        </div>
      )}
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ ...lblS, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

function Row({ host, ms, ok, tag, sub, compact }: { host: string; ms: number; ok: boolean; tag?: string; sub?: string; compact?: boolean }) {
  const tone = latencyColor(ms, ok);
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 8,
        padding: compact ? "6px 8px" : "8px 12px",
        marginBottom: 4,
        background: "var(--deep)",
        border: "1px solid var(--border-soft)",
        borderRadius: "var(--r-sm)",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div className="mono" style={{ fontSize: 11.5, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {host}
        </div>
        {sub && <div style={{ fontSize: 10.5, color: "var(--text-faint)", marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
        {tag && (
          <span style={{ fontSize: 9.5, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: ".05em", fontWeight: 700 }}>
            {tag}
          </span>
        )}
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: tone, boxShadow: `0 0 6px ${tone}` }} />
        <span style={{ fontSize: 11.5, fontWeight: 700, color: tone, fontVariantNumeric: "tabular-nums", minWidth: 40, textAlign: "right" }}>
          {ms}ms
        </span>
      </div>
    </div>
  );
}
