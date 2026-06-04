"use client";
// Live ticking countdown for an order's expiry. Ticks every minute when
// >1 hour is left, every second when <1 hour, and stops ticking once the
// deadline passes. Color shifts to yellow under 1h and red on expiry so the
// board reads like a live exchange instead of a static table.

import { useEffect, useState } from "react";

const HOUR_MS = 3_600_000;

export function formatRemaining(ms: number): string {
  if (ms <= 0) return "Expired";
  const sec = Math.floor(ms / 1000);
  const days = Math.floor(sec / 86_400);
  const hours = Math.floor((sec % 86_400) / 3_600);
  const mins = Math.floor((sec % 3_600) / 60);
  const secs = sec % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs.toString().padStart(2, "0")}s`;
  return `${secs}s`;
}

export default function ExpiryCountdown({ targetMs }: { targetMs: number }) {
  const [now, setNow] = useState<number>(() => targetMs);
  // Initial sync with real clock — split from useState so SSR + first paint
  // match (avoids hydration mismatch).
  useEffect(() => {
    setNow(Date.now());
    const interval = targetMs - Date.now() < HOUR_MS ? 1_000 : 60_000;
    const t = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(t);
  }, [targetMs]);

  const remaining = targetMs - now;
  const urgent = remaining < HOUR_MS && remaining > 0;
  const expired = remaining <= 0;
  return (
    <span
      style={{
        color: expired ? "var(--bad)" : urgent ? "var(--warn)" : "inherit",
        fontWeight: urgent || expired ? 700 : 500,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {formatRemaining(remaining)}
    </span>
  );
}
