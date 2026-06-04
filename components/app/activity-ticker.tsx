"use client";
// Live activity ticker — scrolling marquee of recent on-chain events.
// Real data via suix_queryEvents (OrderPosted + OrderSettled merged by
// timestamp). Renders nothing when there's no activity yet.

import { useEffect, useState } from "react";
import { ActivityItem, listRecentActivity, SUI_NETWORK_FOR_EVENTS, SUISCAN_HOST } from "@/lib/sui-orders";
import { short } from "@/lib/data";
import Icon from "@/components/ui/icon";

function timeAgo(ms: number): string {
  const delta = Math.max(0, Date.now() - ms);
  const s = Math.floor(delta / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function ActivityTicker() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const next = await listRecentActivity(SUI_NETWORK_FOR_EVENTS, 12);
      if (!cancelled) setItems(next);
    };
    tick();
    const t = setInterval(tick, 30_000);
    const clockT = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
      clearInterval(clockT);
    };
  }, []);

  if (items.length === 0) return null;
  // Void-reference now so the timeAgo strings re-render every clock tick.
  void now;

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-soft)",
        borderRadius: "var(--r-md)",
        padding: "10px 14px",
        marginBottom: 18,
        display: "flex",
        alignItems: "center",
        gap: 14,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: 12.5,
          color: "var(--accent-2)",
          letterSpacing: ".06em",
          textTransform: "uppercase",
          flex: "0 0 auto",
        }}
      >
        <span
          style={{
            width: 7, height: 7, borderRadius: "50%",
            background: "var(--accent-2)",
            boxShadow: "0 0 8px var(--accent-2)",
          }}
        />
        Live tape
      </div>
      <div
        style={{
          flex: 1, minWidth: 0,
          overflowX: "auto", overflowY: "hidden",
          whiteSpace: "nowrap",
          display: "flex",
          gap: 18,
          scrollbarWidth: "none",
        }}
      >
        {items.map((item) => {
          const tone = item.kind === "settled" ? "var(--good)" : "var(--accent)";
          const labelKind = item.kind === "settled" ? "SETTLED" : "POSTED";
          return (
            <a
              key={`${item.txDigest}:${item.kind}`}
              href={`${SUISCAN_HOST}/tx/${item.txDigest}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12.5,
                color: "var(--text-dim)",
                textDecoration: "none",
                flex: "0 0 auto",
              }}
              title={`tx ${item.txDigest.slice(0, 12)}…`}
            >
              <span style={{ color: tone, fontWeight: 800, letterSpacing: ".05em" }}>
                {labelKind}
              </span>
              {item.pair && (
                <span style={{ fontWeight: 700, color: "var(--text)" }}>{item.pair}</span>
              )}
              <span className="mono" style={{ color: "var(--text-faint)", fontSize: 11.5 }}>
                {short(item.kind === "posted" ? item.actor : item.orderId, 6, 4)}
              </span>
              <span style={{ color: "var(--text-faint)", fontSize: 11 }}>·</span>
              <span style={{ color: "var(--text-faint)", fontSize: 11 }}>
                {timeAgo(item.timestampMs)}
              </span>
              <Icon name="ext" size={11} style={{ color: "var(--text-faint)" }} />
            </a>
          );
        })}
      </div>
    </div>
  );
}
