"use client";
// Maker profile modal — aggregates real on-chain stats for a single
// address by querying OrderPosted + OrderSettled + OrderCancelled events.
// Surfaces the full address, lifetime counts, last activity time, and a
// short list of recent posts. No mocks — empty fields render as "—".

import { useEffect, useState } from "react";
import { fetchMakerProfile, MakerProfile, SUI_NETWORK_FOR_EVENTS, SUISCAN_HOST } from "@/lib/sui-orders";
import { short } from "@/lib/data";
import { Btn, Card, Mono } from "@/components/ui/primitives";
import Icon from "@/components/ui/icon";

function timeAgo(ms: number | null): string {
  if (ms === null || ms === 0) return "—";
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

export default function MakerProfileModal({
  address, onClose,
}: {
  address: string;
  onClose: () => void;
}) {
  const [profile, setProfile] = useState<MakerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchMakerProfile(address, SUI_NETWORK_FOR_EVENTS)
      .then((p) => { if (!cancelled) { setProfile(p); setLoading(false); } })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load profile");
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [address]);

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
      <Card pad={0} style={{ width: "min(96vw, 560px)", maxHeight: "88vh", overflow: "auto" }}>
        <div onClick={(e) => e.stopPropagation()}>
          <div style={{ padding: "22px 26px", borderBottom: "1px solid var(--border-soft)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <Icon name="user" size={16} style={{ color: "var(--accent)" }} />
              <h2 style={{ fontSize: 18, margin: 0 }}>Maker profile</h2>
              <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-faint)" }}>
                live aggregation
              </span>
            </div>
            <Mono label="address" copyable>{address}</Mono>
          </div>

          <div style={{ padding: "20px 26px", display: "flex", flexDirection: "column", gap: 16 }}>
            {loading && (
              <div style={{ color: "var(--text-faint)", fontSize: 13 }}>
                Aggregating on-chain events…
              </div>
            )}
            {error && (
              <div style={{ color: "var(--bad)", fontSize: 13, fontWeight: 600 }}>
                {error}
              </div>
            )}
            {profile && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  <Stat label="Posted" value={profile.totalPosted} tone="var(--accent)" />
                  <Stat label="Settled" value={profile.totalSettled} tone="var(--good)" />
                  <Stat label="Cancelled" value={profile.totalCancelled} tone="var(--bad)" />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <Stat label="Last activity" valueText={timeAgo(profile.lastActivityMs)} />
                  <Stat
                    label="Success rate"
                    valueText={
                      profile.totalPosted > 0
                        ? `${Math.round((profile.totalSettled / profile.totalPosted) * 100)}%`
                        : "—"
                    }
                  />
                </div>

                {profile.recentPosted.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 700, marginBottom: 8 }}>
                      Recent posts
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {profile.recentPosted.map((p) => (
                        <div
                          key={p.orderId}
                          style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                            padding: "8px 12px",
                            background: "var(--deep)",
                            border: "1px solid var(--border-soft)",
                            borderRadius: "var(--r-sm)",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                            <span style={{ fontSize: 13, fontWeight: 700 }}>{p.pair}</span>
                            <span className="mono" style={{ fontSize: 11.5, color: "var(--text-faint)" }}>
                              {short(p.orderId, 8, 4)}
                            </span>
                          </div>
                          <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>
                            {timeAgo(p.timestampMs)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div style={{ padding: "14px 26px 22px", display: "flex", gap: 10, borderTop: "1px solid var(--border-soft)" }}>
            <a
              href={`${SUISCAN_HOST}/account/${address}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: 1,
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
                background: "var(--accent)", color: "var(--accent-ink)",
                borderRadius: 99,
                padding: "10px 16px",
                fontSize: 13, fontWeight: 700,
                textDecoration: "none",
              }}
            >
              <Icon name="ext" size={13} sw={2.4} /> View on SuiScan
            </a>
            <Btn variant="outline" onClick={onClose}>Close</Btn>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, valueText, tone }: { label: string; value?: number; valueText?: string; tone?: string }) {
  return (
    <div
      style={{
        padding: "10px 12px",
        background: "var(--deep)",
        border: "1px solid var(--border-soft)",
        borderRadius: "var(--r-sm)",
      }}
    >
      <div style={{ fontSize: 10.5, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 700 }}>
        {label}
      </div>
      <div style={{ fontSize: 17, fontWeight: 800, marginTop: 4, color: tone ?? "var(--text)", fontVariantNumeric: "tabular-nums" }}>
        {valueText ?? (value !== undefined ? String(value) : "—")}
      </div>
    </div>
  );
}
