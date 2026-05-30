// Live network status pill — polls /api/health on mount + 15s interval.
// Shows the current Sui checkpoint number so judges can see the gateway is live.
"use client";
import { useEffect, useState } from "react";

type Health =
  | { ok: true; networkName: string; chainId: string; checkpoint: string; latencyMs: number }
  | { ok: false; error: string };

export default function NetworkPill({ network = "mainnet" as "mainnet" | "testnet" | "devnet" }) {
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [data, setData] = useState<Health | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/health?network=${network}`, { cache: "no-store" });
        const json = (await res.json()) as Health;
        if (cancelled) return;
        setData(json);
        setState(json.ok ? "ok" : "error");
      } catch (e) {
        if (cancelled) return;
        setData({ ok: false, error: e instanceof Error ? e.message : "fetch failed" });
        setState("error");
      }
    };
    tick();
    const t = setInterval(tick, 15_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [network]);

  const dotColor =
    state === "ok" ? "var(--good)" :
    state === "error" ? "var(--bad)" :
    "var(--warn)";

  const labelMain =
    state === "ok" && data?.ok ? data.networkName :
    state === "error" ? "Gateway error" :
    "Connecting…";

  const tail =
    state === "ok" && data?.ok
      ? `· #${formatCheckpoint(data.checkpoint)} · ${data.latencyMs}ms`
      : state === "error" && data && !data.ok
      ? `· ${truncate(data.error, 36)}`
      : "· Tatum RPC";

  return (
    <div
      title={state === "ok" && data?.ok ? `chainId ${data.chainId}` : undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        background: "var(--deep)",
        border: "1px solid var(--border)",
        borderRadius: 99,
        padding: "7px 13px",
        fontSize: 12.5,
        fontWeight: 600,
        color: "var(--text-dim)",
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: dotColor,
          boxShadow: `0 0 7px ${dotColor}`,
          transition: "background .25s",
        }}
      />
      {labelMain} <span style={{ color: "var(--text-faint)" }}>{tail}</span>
    </div>
  );
}

function formatCheckpoint(s: string) {
  // checkpoint can be a giant int string — group thousands so it's readable
  const n = Number(s);
  if (Number.isFinite(n)) return n.toLocaleString("en-US");
  return s;
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
