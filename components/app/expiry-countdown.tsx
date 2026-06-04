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
  // Re-evaluate tick interval whenever crossing the 1-hour boundary so a
  // long-running card that just slipped under 1h starts ticking by second.
  // (The previous one-shot interval at mount stayed at 60s forever once
  // chosen, missing the urgency switch entirely.)
  const [urgentMode, setUrgentMode] = useState<boolean>(() => targetMs - Date.now() < HOUR_MS);
  useEffect(() => {
    setNow(Date.now());
    const interval = urgentMode ? 1_000 : 60_000;
    const t = setInterval(() => {
      const next = Date.now();
      setNow(next);
      const shouldBeUrgent = targetMs - next < HOUR_MS;
      if (shouldBeUrgent !== urgentMode) setUrgentMode(shouldBeUrgent);
    }, interval);
    return () => clearInterval(t);
  }, [targetMs, urgentMode]);

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
