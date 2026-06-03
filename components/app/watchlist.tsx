"use client";
// Watchlist drawer + toast surface. Lets the user define (pair, side)
// criteria, lists active watches with delete buttons, and renders ephemeral
// match toasts in the top-right corner.

import { useEffect, useState } from "react";
import type { AssetSym } from "@/lib/types";
import {
  Watch,
  addWatch,
  ensureNotifyPermission,
  listWatches,
  removeWatch,
} from "@/lib/watchlist";
import { Btn, Card, Segmented } from "@/components/ui/primitives";
import { AssetIcon } from "@/components/ui/asset";
import Icon from "@/components/ui/icon";

const ASSETS: AssetSym[] = ["SUI", "USDC", "WAL", "USDT", "DEEP"];

export function WatchlistButton({ onOpen }: { onOpen: () => void }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const tick = () => setCount(listWatches().length);
    tick();
    const t = setInterval(tick, 5000);
    return () => clearInterval(t);
  }, []);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Watchlist"
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 36, height: 36,
        background: "var(--deep)",
        border: "1px solid var(--border)",
        borderRadius: 99,
        cursor: "pointer",
        color: "var(--text-dim)",
      }}
      title={count > 0 ? `${count} active watch${count === 1 ? "" : "es"}` : "Watchlist"}
    >
      <Icon name="bell" size={16} />
      {count > 0 && (
        <span
          style={{
            position: "absolute", top: -3, right: -3,
            background: "var(--accent-2)", color: "var(--accent-ink)",
            fontSize: 10, fontWeight: 800,
            minWidth: 17, height: 17, padding: "0 5px",
            borderRadius: 99,
            display: "grid", placeItems: "center",
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

export function WatchlistDrawer({ onClose }: { onClose: () => void }) {
  const [watches, setWatches] = useState<Watch[]>(() => listWatches());
  const [give, setGive] = useState<AssetSym>("SUI");
  const [get, setGet] = useState<AssetSym>("USDC");
  const [side, setSide] = useState<"ANY" | "SELL" | "BUY">("ANY");
  const [permission, setPermission] = useState<NotificationPermission | null>(null);

  useEffect(() => {
    if (typeof Notification !== "undefined") setPermission(Notification.permission);
  }, []);

  const refresh = () => setWatches(listWatches());

  const onAdd = async () => {
    if (give === get) return;
    addWatch({ give, get, side: side === "ANY" ? undefined : side });
    refresh();
    // Lazily request notification permission the first time the user adds a
    // watch — feels less aggressive than asking on app boot.
    if (permission === "default") {
      const p = await ensureNotifyPermission();
      setPermission(p);
    }
  };

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
      <div
        onClick={(e) => e.stopPropagation()}
        className="fade-up"
        style={{
          width: "min(94vw, 560px)",
          maxHeight: "85vh", overflow: "auto",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-xl)",
          boxShadow: "0 40px 100px -30px #000",
        }}
      >
        <div style={{ padding: "22px 26px", borderBottom: "1px solid var(--border-soft)" }}>
          <h2 style={{ fontSize: 20, margin: 0 }}>Watchlist</h2>
          <div style={{ color: "var(--text-dim)", fontSize: 13.5, marginTop: 6 }}>
            Get pinged the moment a new sealed quote matches your criteria.
            Stays on this device only.
          </div>
        </div>

        <div style={{ padding: "22px 26px", borderBottom: "1px solid var(--border-soft)" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
            <Pair label="Give" value={give} onChange={setGive} />
            <span style={{ color: "var(--text-faint)", padding: "10px 0" }}>→</span>
            <Pair label="Get" value={get} onChange={setGet} />
            <div style={{ minWidth: 180 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--text-faint)", marginBottom: 6 }}>
                Side
              </div>
              <Segmented
                value={side}
                onChange={(v) => setSide(v as "ANY" | "SELL" | "BUY")}
                options={[
                  { value: "ANY", label: "Any" },
                  { value: "SELL", label: "Sell" },
                  { value: "BUY", label: "Buy" },
                ]}
              />
            </div>
            <Btn icon="bolt" onClick={onAdd} disabled={give === get}>
              Add watch
            </Btn>
          </div>
          {permission === "denied" && (
            <div style={{ marginTop: 10, fontSize: 12, color: "var(--warn)" }}>
              Browser notifications blocked. In-app toasts will still fire.
            </div>
          )}
        </div>

        <div style={{ padding: "18px 26px 24px" }}>
          {watches.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--text-faint)", padding: "20px 0", fontSize: 13 }}>
              No active watches. Add one above.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {watches.map((w) => (
                <Card key={w.id} pad={12}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <AssetIcon sym={w.give} size={22} />
                    <span style={{ color: "var(--text-faint)" }}>→</span>
                    <AssetIcon sym={w.get} size={22} />
                    <span style={{ fontWeight: 700, marginLeft: 4 }}>{w.give} → {w.get}</span>
                    {w.side && (
                      <span
                        style={{
                          fontSize: 10.5, fontWeight: 800,
                          padding: "2px 7px", borderRadius: 99,
                          background: "var(--surface-3)",
                          color: "var(--text-dim)",
                          marginLeft: 4,
                        }}
                      >
                        {w.side}
                      </span>
                    )}
                    <button
                      onClick={() => { removeWatch(w.id); refresh(); }}
                      title="Remove"
                      style={{
                        marginLeft: "auto",
                        background: "transparent",
                        border: "none",
                        color: "var(--text-faint)",
                        cursor: "pointer",
                        fontSize: 18,
                        padding: "0 6px",
                      }}
                    >
                      ×
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Pair({ label, value, onChange }: { label: string; value: AssetSym; onChange: (v: AssetSym) => void }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--text-faint)", marginBottom: 6 }}>
        {label}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as AssetSym)}
        style={{
          background: "var(--deep)",
          border: "1px solid var(--border)",
          color: "var(--text)",
          borderRadius: "var(--r-sm)",
          padding: "10px 12px",
          fontSize: 14,
          minWidth: 100,
        }}
      >
        {ASSETS.map((a) => <option key={a} value={a}>{a}</option>)}
      </select>
    </div>
  );
}

/* ------------------------------- Toasts ------------------------------- */

export type ToastItem = { id: string; title: string; body: string; createdAt: number };

export function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: string) => void }) {
  return (
    <div
      style={{
        position: "fixed",
        top: 80, right: 20,
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        maxWidth: 340,
        pointerEvents: "none",
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="fade-up"
          onClick={() => onDismiss(t.id)}
          style={{
            pointerEvents: "auto",
            background: "var(--surface)",
            border: "1px solid var(--accent)",
            borderRadius: "var(--r-md)",
            padding: "12px 14px",
            boxShadow: "0 20px 50px -20px #000",
            cursor: "pointer",
            color: "var(--text)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Icon name="bell" size={14} sw={2.4} style={{ color: "var(--accent)" }} />
            <b style={{ fontSize: 13.5 }}>{t.title}</b>
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text-dim)", lineHeight: 1.45 }}>{t.body}</div>
        </div>
      ))}
    </div>
  );
}
