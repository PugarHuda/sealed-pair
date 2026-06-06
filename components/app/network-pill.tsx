// Live network status pill — polls /api/health on mount, with adaptive cadence:
// 15s on success, 30s after a transient failure (back-off). Sticky checkpoint:
// when a single poll fails (esp. 429 rate-limit from Tatum free tier), we keep
// the last known good chainId/checkpoint visible and degrade the dot to yellow
// instead of red — judges still see "Sui devnet · #1,063,330" with a small
// "stale 7s" hint, not a scary red "Gateway error" banner.
"use client";
import { useEffect, useRef, useState } from "react";
import { SUI_NETWORK_FOR_EVENTS } from "@/lib/sui-orders";

type HealthOk = { ok: true; networkName: string; chainId: string; checkpoint: string; latencyMs: number };
type HealthErr = { ok: false; error: string; upstreamStatus?: number };
type Health = HealthOk | HealthErr;

type NetworkName = "mainnet" | "testnet" | "devnet";
type Phase = "loading" | "ok" | "stale" | "error";

const POLL_OK_MS = 15_000;
const POLL_BACKOFF_MS = 30_000;

// Default the pill to the same network the rest of the app talks to. Showing
// mainnet checkpoint while every actual interaction is on devnet was confusing.
export default function NetworkPill({
  network = SUI_NETWORK_FOR_EVENTS as NetworkName,
}: { network?: NetworkName } = {}) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [last, setLast] = useState<HealthOk | null>(null);
  const [lastErr, setLastErr] = useState<HealthErr | null>(null);
  const [lastOkAt, setLastOkAt] = useState<number | null>(null);
  // Refs let the tick() closure read "have we ever succeeded?" without
  // resubscribing the whole effect when `last` changes (which would restart
  // the polling chain on every successful poll).
  const lastRef = useRef<HealthOk | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const schedule = (ms: number, fn: () => void) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(fn, ms);
    };

    const tick = async () => {
      let nextDelay = POLL_OK_MS;
      try {
        const res = await fetch(`/api/health?network=${network}`, { cache: "no-store" });
        const json = (await res.json()) as Health;
        if (cancelled) return;
        if (json.ok) {
          lastRef.current = json;
          setLast(json);
          setLastOkAt(Date.now());
          setLastErr(null);
          setPhase("ok");
        } else {
          setLastErr(json);
          // If we have a previous-good snapshot, stay "stale" (yellow). Otherwise show error.
          setPhase(lastRef.current ? "stale" : "error");
          nextDelay = POLL_BACKOFF_MS;
        }
      } catch (e) {
        if (cancelled) return;
        setLastErr({ ok: false, error: e instanceof Error ? e.message : "fetch failed" });
        setPhase(lastRef.current ? "stale" : "error");
        nextDelay = POLL_BACKOFF_MS;
      } finally {
        if (!cancelled) schedule(nextDelay, tick);
      }
    };
    tick();
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [network]);

  const dotColor =
    phase === "ok" ? "var(--good)" :
    phase === "stale" ? "var(--warn)" :
    phase === "error" ? "var(--bad)" :
    "var(--warn)";

  // Friendlier error copy for 429 specifically (the common one during demos).
  const errReason =
    lastErr?.upstreamStatus === 429 ? "Rate-limited · retrying" :
    lastErr?.upstreamStatus && lastErr.upstreamStatus >= 500 ? "Gateway 5xx · retrying" :
    lastErr?.error ? truncate(lastErr.error, 36) :
    "retrying";

  const staleAgeSec = lastOkAt ? Math.max(0, Math.round((Date.now() - lastOkAt) / 1000)) : 0;

  const labelMain =
    phase === "loading" ? "Connecting…" :
    last ? last.networkName :
    "Tatum RPC";

  const tail =
    phase === "ok" && last
      ? `· #${formatCheckpoint(last.checkpoint)} · ${last.latencyMs}ms`
      : phase === "stale" && last
      ? `· #${formatCheckpoint(last.checkpoint)} · stale ${staleAgeSec}s`
      : phase === "error"
      ? `· ${errReason}`
      : "· Tatum RPC";

  return (
    <div
      title={last ? `chainId ${last.chainId}${phase === "stale" ? ` · last ok ${staleAgeSec}s ago` : ""}` : undefined}
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
