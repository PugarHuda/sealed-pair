"use client";
// Counter-offer flow ported from Diam: the taker can propose alternate terms
// instead of accepting the maker's quote outright. The proposal is encrypted
// + uploaded to Walrus (so it inherits the same content-addressed commitment
// guarantee as the parent order) and indexed via localStorage so the maker
// can see it next time they open the order.

import { useEffect, useState } from "react";
import type { Order } from "@/lib/types";
import { Btn, Card, Mono } from "@/components/ui/primitives";
import { fmt, short } from "@/lib/data";
import Icon from "@/components/ui/icon";
import {
  CounterOffer,
  decryptCounter,
  listCounterOffers,
  setCounterStatus,
  submitCounterOffer,
} from "@/lib/counter-offers";

/* ---------- modal: taker proposes a counter-offer ---------- */

export function CounterOfferModal({
  order, proposerAddr, onClose, onDone,
}: {
  order: Order;
  proposerAddr: string;
  onClose: () => void;
  onDone: (counter: CounterOffer) => void;
}) {
  const [amount, setAmount] = useState(order.terms.amount);
  const [price, setPrice] = useState(order.terms.price);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const counter = Math.round(amount * price);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await submitCounterOffer({
        orderId: order.orderObj,
        proposer: proposerAddr,
        proposerShort: short(proposerAddr, 6, 4),
        terms: { amount, price, counter, note: note || undefined },
      });
      // Reset busy BEFORE calling onDone so even if the parent keeps the
      // modal mounted the Submit button isn't permanently disabled.
      setBusy(false);
      onDone(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit");
      setBusy(false);
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
          width: "min(94vw, 520px)",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-xl)",
          boxShadow: "0 40px 100px -30px #000",
        }}
      >
        <div style={{ padding: "22px 26px", borderBottom: "1px solid var(--border-soft)" }}>
          <h2 style={{ fontSize: 20, margin: 0 }}>Counter-offer</h2>
          <div style={{ color: "var(--text-dim)", fontSize: 13.5, marginTop: 6 }}>
            Propose alternate terms. They&apos;re encrypted and sent to the
            maker via Walrus — the maker decides whether to accept or reject.
          </div>
        </div>
        <div style={{ padding: "22px 26px", display: "grid", gap: 14 }}>
          <Field label={`Amount (${order.give})`}>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value) || 0)}
              style={inputStyle}
            />
          </Field>
          <Field label={`Price (${order.get}/${order.give})`}>
            <input
              type="number"
              value={price}
              step="0.0001"
              onChange={(e) => setPrice(Number(e.target.value) || 0)}
              style={inputStyle}
            />
          </Field>
          <div
            style={{
              background: "var(--deep)",
              borderRadius: "var(--r-sm)",
              padding: "12px 14px",
              fontSize: 13,
              color: "var(--text-dim)",
            }}
          >
            You deliver: <b style={{ color: "var(--text)" }}>{fmt(counter)} {order.get}</b>
            {" → "} you receive: <b style={{ color: "var(--text)" }}>{fmt(amount)} {order.give}</b>
          </div>
          <Field label="Memo (optional, encrypted)">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g., can do 0.045 if you settle today"
              style={inputStyle}
            />
          </Field>
          {error && (
            <div
              style={{
                padding: "10px 12px",
                background: "color-mix(in oklab, var(--bad) 14%, transparent)",
                border: "1px solid var(--bad)",
                borderRadius: "var(--r-sm)",
                color: "var(--bad)",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {error}
            </div>
          )}
        </div>
        <div style={{ padding: "16px 26px 22px", display: "flex", gap: 10 }}>
          <Btn variant="outline" onClick={onClose}>Cancel</Btn>
          <Btn variant="seal" icon="lock" full onClick={submit} disabled={busy || amount <= 0 || price <= 0}>
            {busy ? "Encrypting + uploading…" : "Seal & send counter-offer"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

/* ---------- panel: maker reviews counter-offers on their order ---------- */

export function CounterOffersPanel({
  orderId, isMaker, onAccept,
}: {
  orderId: string;
  isMaker: boolean;
  onAccept?: (c: CounterOffer) => void;
}) {
  const [offers, setOffers] = useState<CounterOffer[]>([]);
  // Decoded preview per blob — populated lazily as we try to decrypt each.
  const [decoded, setDecoded] = useState<Record<string, { amount: number; price: number; counter: number; note?: string }>>({});

  // Re-read from localStorage when the panel mounts AND whenever the orderId
  // changes — keeps the count accurate across navigations.
  useEffect(() => {
    setOffers(listCounterOffers(orderId));
  }, [orderId]);

  // Try to decrypt each blob (only succeeds for the proposer's own session OR
  // when the maker happens to have the key — a future Seal-policy hookup
  // would let any party-of-record decrypt).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const out: typeof decoded = {};
      for (const o of offers) {
        if (o.termsPreview) {
          out[o.blobId] = o.termsPreview;
          continue;
        }
        const t = await decryptCounter(o.blobId);
        if (t) out[o.blobId] = t;
        if (cancelled) return;
      }
      if (!cancelled) setDecoded(out);
    })();
    return () => { cancelled = true; };
  }, [offers]);

  if (offers.length === 0) return null;

  const refresh = () => setOffers(listCounterOffers(orderId));

  return (
    <Card pad={18} style={{ borderColor: "var(--accent-2)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
        <Icon name="bolt" size={16} style={{ color: "var(--accent-2)" }} />
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 15 }}>
          {isMaker ? "Counter-offers received" : "Your counter-offers"}
        </div>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-faint)" }}>
          {offers.length}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {offers.map((o) => {
          const t = decoded[o.blobId];
          const statusTone =
            o.status === "accepted" ? "var(--good)" :
            o.status === "rejected" ? "var(--bad)" : "var(--accent-2)";
          return (
            <div
              key={o.id}
              style={{
                padding: "12px 14px",
                background: "var(--deep)",
                border: "1px solid var(--border-soft)",
                borderRadius: "var(--r-sm)",
                display: "grid", gap: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div className="mono" style={{ fontSize: 12, color: "var(--text-dim)" }}>
                  from {o.proposedByShort}
                </div>
                <span
                  style={{
                    fontSize: 10.5, fontWeight: 800, letterSpacing: ".06em",
                    textTransform: "uppercase",
                    color: statusTone,
                    padding: "2px 8px",
                    borderRadius: 99,
                    background: `color-mix(in oklab, ${statusTone} 14%, transparent)`,
                  }}
                >
                  {o.status}
                </span>
              </div>
              {t ? (
                <div style={{ fontSize: 13.5, color: "var(--text)" }}>
                  <b>{fmt(t.amount)}</b> @ <b>{t.price}</b> ⇒ <b>{fmt(t.counter)}</b>
                  {t.note && (
                    <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4, fontStyle: "italic" }}>
                      &ldquo;{t.note}&rdquo;
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: 12.5, color: "var(--text-faint)" }}>
                  <Icon name="lock" size={12} /> encrypted — decrypt key not in this session
                </div>
              )}
              <Mono label="counter-blob" copyable>{short(o.blobId, 10, 5)}</Mono>
              {isMaker && o.status === "pending" && (
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <Btn
                    variant="primary"
                    icon="check"
                    onClick={() => {
                      setCounterStatus(orderId, o.id, "accepted");
                      refresh();
                      onAccept?.(o);
                    }}
                  >
                    Accept
                  </Btn>
                  <Btn
                    variant="outline"
                    onClick={() => {
                      setCounterStatus(orderId, o.id, "rejected");
                      refresh();
                    }}
                  >
                    Reject
                  </Btn>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ---------- shared field/input styles, local to this module ---------- */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--text-faint)" }}>
        {label}
      </span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  background: "var(--deep)",
  border: "1px solid var(--border)",
  borderRadius: "var(--r-sm)",
  color: "var(--text)",
  fontFamily: "var(--font-mono)",
  fontSize: 14,
  padding: "10px 12px",
  outline: "none",
};
