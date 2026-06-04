"use client";
// Per-order event timeline. Queries every event type emitted by the
// deployed Move module, filters for matches on this orderId, and renders
// chronologically with SuiScan links. Pure RPC reads — no localStorage.

import { useEffect, useState } from "react";
import { fetchOrderTimeline, SUI_NETWORK_FOR_EVENTS, SUISCAN_HOST, TimelineEvent } from "@/lib/sui-orders";
import { Card } from "@/components/ui/primitives";
import Icon, { IconName } from "@/components/ui/icon";
import { lblS } from "@/components/app/shared";
import { short } from "@/lib/data";

const KIND_META: Record<TimelineEvent["kind"], { label: string; icon: IconName; tone: string }> = {
  posted:    { label: "Posted",    icon: "lock",   tone: "var(--accent)" },
  locked:    { label: "Locked",    icon: "shield", tone: "var(--seal-glow)" },
  revealed:  { label: "Revealed",  icon: "unlock", tone: "var(--seal-glow)" },
  settled:   { label: "Settled",   icon: "check",  tone: "var(--good)" },
  cancelled: { label: "Cancelled", icon: "bolt",   tone: "var(--bad)" },
};

function formatStamp(ms: number) {
  if (!ms) return "—";
  const d = new Date(ms);
  return d.toLocaleString(undefined, {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function OrderTimeline({ orderId }: { orderId: string }) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId.startsWith("0x")) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchOrderTimeline(orderId, SUI_NETWORK_FOR_EVENTS)
      .then((e) => { if (!cancelled) { setEvents(e); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [orderId]);

  if (!orderId.startsWith("0x")) return null;
  if (loading) return null;
  if (events.length === 0) return null;

  return (
    <Card pad={18}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Icon name="clock" size={15} style={{ color: "var(--accent)" }} />
        <div style={{ ...lblS, fontSize: 11.5 }}>On-chain lifetime</div>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-faint)" }}>
          {events.length} event{events.length === 1 ? "" : "s"}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {events.map((e, i) => {
          const meta = KIND_META[e.kind];
          const last = i === events.length - 1;
          return (
            <div key={`${e.txDigest}:${e.kind}`} style={{ display: "flex", gap: 12, position: "relative" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "0 0 auto" }}>
                <span
                  style={{
                    width: 24, height: 24, borderRadius: "50%",
                    background: `color-mix(in oklab, ${meta.tone} 18%, transparent)`,
                    border: `1px solid ${meta.tone}`,
                    color: meta.tone,
                    display: "grid", placeItems: "center",
                    flex: "0 0 auto",
                  }}
                >
                  <Icon name={meta.icon} size={12} sw={2.4} />
                </span>
                {!last && (
                  <span
                    style={{
                      width: 1, flex: 1, background: "var(--border-soft)",
                      minHeight: 14,
                    }}
                  />
                )}
              </div>
              <div style={{ flex: 1, paddingBottom: last ? 0 : 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 800, color: meta.tone, fontSize: 12.5, letterSpacing: ".04em" }}>
                    {meta.label.toUpperCase()}
                  </span>
                  <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>
                    {formatStamp(e.timestampMs)}
                  </span>
                </div>
                <a
                  href={`${SUISCAN_HOST}/tx/${e.txDigest}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mono"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    fontSize: 11.5, color: "var(--text-dim)", textDecoration: "none",
                    marginTop: 2,
                  }}
                >
                  {short(e.txDigest, 10, 6)} <Icon name="ext" size={10} />
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
