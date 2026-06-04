"use client";
// Maker inbox — who locked my orders, who sent counter-offers.
// Aggregates real on-chain OrderLocked events filtered to the user's
// orderIds + localStorage counter-offers. One screen, one glance.

import { useEffect, useState } from "react";
import { fetchMakerInbox, InboxItem, SUI_NETWORK_FOR_EVENTS } from "@/lib/sui-orders";
import { short } from "@/lib/data";
import { Btn, Card } from "@/components/ui/primitives";
import Icon from "@/components/ui/icon";

function timeAgo(ms: number): string {
  if (!ms) return "—";
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function MakerInbox({
  walletAddr, onClose, onOpenOrder,
}: {
  walletAddr: string;
  onClose: () => void;
  onOpenOrder: (orderId: string) => void;
}) {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [stats, setStats] = useState({ lockedCount: 0, counterCount: 0, orderCount: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchMakerInbox(walletAddr, SUI_NETWORK_FOR_EVENTS)
      .then((r) => {
        if (cancelled) return;
        setItems(r.items);
        setStats({ lockedCount: r.lockedCount, counterCount: r.counterCount, orderCount: r.orderCount });
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "fetch failed");
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [walletAddr]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 90,
        display: "grid", placeItems: "center", padding: 24,
        background: "color-mix(in oklab, var(--deep) 78%, transparent)",
        backdropFilter: "blur(8px)", animation: "popIn .25s ease",
      }}
    >
      <Card pad={0} style={{ width: "min(96vw, 620px)", maxHeight: "88vh", overflow: "auto" }}>
        <div onClick={(e) => e.stopPropagation()}>
          <div style={{ padding: "22px 26px", borderBottom: "1px solid var(--border-soft)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <Icon name="bell" size={16} style={{ color: "var(--accent)" }} />
              <h2 style={{ fontSize: 18, margin: 0 }}>Inbox · activity on your orders</h2>
              <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-faint)" }}>
                {stats.orderCount} order{stats.orderCount === 1 ? "" : "s"} you've posted
              </span>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--text-dim)" }}>
              Real-time view of takers locking your offers + counter-offers from buyers.
            </div>
          </div>

          <div style={{ padding: "16px 26px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, borderBottom: "1px solid var(--border-soft)" }}>
            <Stat label="Locked by takers" value={stats.lockedCount} tone="var(--seal-glow)" icon="lock" />
            <Stat label="Counter-offers" value={stats.counterCount} tone="var(--accent-2)" icon="bolt" />
          </div>

          <div style={{ padding: "16px 26px", display: "flex", flexDirection: "column", gap: 8 }}>
            {loading && (
              <div style={{ color: "var(--text-faint)", fontSize: 13 }}>Aggregating events…</div>
            )}
            {error && (
              <div style={{ color: "var(--bad)", fontSize: 13, fontWeight: 600 }}>{error}</div>
            )}
            {!loading && !error && items.length === 0 && (
              <div style={{ color: "var(--text-faint)", fontSize: 13, padding: "20px 0", textAlign: "center" }}>
                No incoming activity yet. Post a sealed quote and you&apos;ll see takers
                land here when they lock escrow on your offer.
              </div>
            )}
            {!loading && items.map((item) => {
              const tone = item.kind === "locked" ? "var(--seal-glow)" : "var(--accent-2)";
              const label = item.kind === "locked" ? "LOCKED ESCROW" : "COUNTER-OFFER";
              return (
                <div
                  key={`${item.kind}:${item.orderId}:${item.timestampMs}`}
                  onClick={() => { onClose(); onOpenOrder(item.orderId); }}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr auto",
                    gap: 12,
                    padding: "12px 14px",
                    background: "var(--deep)",
                    border: "1px solid var(--border-soft)",
                    borderRadius: "var(--r-sm)",
                    cursor: "pointer",
                  }}
                >
                  <span
                    style={{
                      width: 32, height: 32, borderRadius: "50%",
                      background: `color-mix(in oklab, ${tone} 18%, transparent)`,
                      border: `1px solid ${tone}`,
                      color: tone,
                      display: "grid", placeItems: "center",
                    }}
                  >
                    <Icon name={item.kind === "locked" ? "lock" : "bolt"} size={15} sw={2.4} />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 10.5, fontWeight: 800, color: tone, letterSpacing: ".06em" }}>
                        {label}
                      </span>
                      <span style={{ fontSize: 12.5, fontWeight: 700 }}>{item.pair}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
                      {item.kind === "locked" ? "from taker " : "from "}
                      <span className="mono">{item.actor ? short(item.actor, 6, 4) : "—"}</span>
                      {" · "}
                      {timeAgo(item.timestampMs)}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--accent)", fontWeight: 700 }}>
                    Open <Icon name="chev" size={12} sw={2.4} />
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ padding: "14px 26px 22px", borderTop: "1px solid var(--border-soft)" }}>
            <Btn variant="outline" full onClick={onClose}>Close</Btn>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone, icon }: { label: string; value: number; tone: string; icon: "lock" | "bolt" }) {
  return (
    <div
      style={{
        padding: "10px 12px",
        background: "var(--deep)",
        border: `1px solid ${value > 0 ? tone : "var(--border-soft)"}`,
        borderRadius: "var(--r-sm)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Icon name={icon} size={13} sw={2.4} style={{ color: tone }} />
        <span style={{ fontSize: 10.5, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 700 }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4, color: value > 0 ? tone : "var(--text)", fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
    </div>
  );
}
