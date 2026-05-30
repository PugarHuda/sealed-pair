"use client";
import { CSSProperties, useEffect, useState } from "react";
import type { Order } from "@/lib/types";
import { PERSONAS, short, fmt } from "@/lib/data";
import { Badge, Btn, Card, Mono, Row } from "@/components/ui/primitives";
import { AssetIcon, Pair } from "@/components/ui/asset";
import Icon from "@/components/ui/icon";
import Mascot from "@/components/mascot";
import { MakerTag, lblS, valS } from "@/components/app/shared";
import { decryptText, loadKey } from "@/lib/crypto";

const useTimeout = (fn: () => void, ms: number | null) => {
  useEffect(() => {
    if (ms == null) return;
    const t = setTimeout(fn, ms);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};

function PolicyCheckLine({ ok, delay, children }: { ok?: boolean; delay: number; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  useTimeout(() => setShow(true), delay);
  if (!show) return null;
  return (
    <div
      className="fade-up"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        fontFamily: "var(--font-mono)",
        fontSize: 12.5,
        color: ok ? "var(--good)" : "var(--text-dim)",
      }}
    >
      {ok ? (
        <Icon name="check" size={14} sw={2.6} />
      ) : (
        <span
          className="spin"
          style={{
            width: 11, height: 11, border: "2px solid var(--accent)",
            borderTopColor: "transparent", borderRadius: "50%",
          }}
        />
      )}
      {children}
    </div>
  );
}

type RevealStyle = "decrypt" | "wave" | "pop";

function TermsPanel({
  order, revealed, revealing, revealStyle,
}: {
  order: Order;
  revealed: boolean;
  revealing: boolean;
  revealStyle: RevealStyle;
}) {
  const t = order.terms;
  const revealTransitions: Record<RevealStyle, CSSProperties> = {
    decrypt: { filter: revealed ? "blur(0)" : "blur(13px)", opacity: revealed ? 1 : 0.5, transition: "filter .9s var(--ease), opacity .9s" },
    wave:    { clipPath: revealed ? "inset(0 0 0 0)" : "inset(0 0 100% 0)", filter: revealed ? "none" : "blur(6px)", transition: "clip-path 1s var(--ease), filter 1s" },
    pop:     { transform: revealed ? "scale(1)" : "scale(.82)", opacity: revealed ? 1 : 0, filter: revealed ? "none" : "blur(8px)", transition: "all .8s var(--ease-back)" },
  };
  const revealTransition = revealTransitions[revealStyle];

  const big = (v: string, unit: string) => (
    <span>
      <b style={{ fontFamily: "var(--font-display)", fontSize: 34, letterSpacing: "-.02em" }}>{v}</b>{" "}
      <span style={{ color: "var(--text-faint)", fontSize: 16, fontWeight: 600 }}>{unit}</span>
    </span>
  );

  return (
    <Card pad={0} style={{ overflow: "hidden", position: "relative" }}>
      <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border-soft)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10, fontWeight: 800, fontFamily: "var(--font-display)", fontSize: 16 }}>
          {revealed ? <Icon name="unlock" size={18} style={{ color: "var(--good)" }} /> : <Icon name="lock" size={18} style={{ color: "var(--seal-glow)" }} />}
          {revealed ? "Terms revealed" : "Sealed terms"}
        </span>
        {revealed ? <Badge tone="good" icon="check">Decrypted by Seal</Badge> : <Badge tone="seal" icon="lock">Encrypted</Badge>}
      </div>

      {revealing && !revealed && (
        <div style={{ padding: "18px 24px", display: "flex", flexDirection: "column", gap: 9, background: "var(--deep)", borderBottom: "1px solid var(--border-soft)" }}>
          <PolicyCheckLine delay={0}>seal_approve(order, requester) — evaluating…</PolicyCheckLine>
          <PolicyCheckLine delay={500} ok>order.state == LOCKED</PolicyCheckLine>
          <PolicyCheckLine delay={850} ok>escrow.funded == true</PolicyCheckLine>
          <PolicyCheckLine delay={1150} ok>requester ∈ {"{maker, taker}"}</PolicyCheckLine>
          <PolicyCheckLine delay={1450} ok>epoch &lt; expiry_epoch</PolicyCheckLine>
          <PolicyCheckLine delay={1850}>assembling 2-of-3 key shares…</PolicyCheckLine>
          <PolicyCheckLine delay={2250} ok>decrypting {short(order.blobId, 9, 5)}</PolicyCheckLine>
        </div>
      )}

      <div style={{ position: "relative", padding: "26px 24px" }}>
        {!revealed && !revealing && (
          <div
            style={{
              position: "absolute", inset: 0, zIndex: 2,
              display: "grid", placeItems: "center",
              background: "color-mix(in oklab, var(--surface) 30%, transparent)",
            }}
          >
            <div style={{ textAlign: "center", color: "var(--text-dim)" }}>
              <div
                style={{
                  display: "inline-grid", placeItems: "center",
                  width: 54, height: 54, borderRadius: "50%",
                  background: "color-mix(in oklab, var(--seal) 22%, transparent)",
                  color: "var(--seal-glow)", marginBottom: 10,
                }}
              >
                <Icon name="lock" size={24} />
              </div>
              <div style={{ fontWeight: 700, color: "var(--text)" }}>Fund escrow to unlock</div>
              <div style={{ fontSize: 12.5, maxWidth: 230, marginTop: 4 }}>
                Seal releases the key automatically the moment the policy is satisfied.
              </div>
            </div>
          </div>
        )}
        <div style={{ ...revealTransition, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "22px 18px" }}>
          <div>
            <div style={lblS}>{order.side === "SELL" ? "Maker delivers" : "You deliver"}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
              <AssetIcon sym={t.give} size={30} />
              {big(fmt(t.amount), t.give)}
            </div>
          </div>
          <div>
            <div style={lblS}>Taker delivers</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
              <AssetIcon sym={t.get} size={30} />
              {big(fmt(t.counter), t.get)}
            </div>
          </div>
          <div style={{ gridColumn: "1 / -1", height: 1, background: "var(--border-soft)" }} />
          <div><div style={lblS}>Price</div><div style={valS}>{t.price} {t.get}/{t.give}</div></div>
          <div><div style={lblS}>Minimum fill</div><div style={valS}>{fmt(t.minFill)} {t.give}</div></div>
          {t.note && (
            <div style={{ gridColumn: "1 / -1" }}>
              <div style={lblS}>Memo</div>
              <div style={{ ...valS, fontWeight: 500, fontSize: 14 }}>{t.note}</div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function pipGuide(phase: string, isMine: boolean) {
  if (phase === "funding")   return "Locking your deposit into the Order object…";
  if (phase === "revealing") return "Policy satisfied! Pulling key shares from the Seal servers…";
  if (phase === "revealed")  return "Ta-da! The terms are out. Like what you see? Settle it.";
  if (phase === "settled")   return "Done and dusted — proof lives on-chain forever. 🐚";
  if (isMine)                return "Your quote is live and sealed. I’ll guard the terms until someone commits.";
  return "These terms are sealed tight. Fund escrow and I’ll have Seal pop them open for you.";
}

export default function DealScreen({
  order, role, isMine, revealStyle, onSettle, onBack, onUpdate, onRoleSwitch,
}: {
  order: Order;
  role: "marina" | "theo";
  isMine: boolean;
  revealStyle: RevealStyle;
  onSettle: (o: Order) => void;
  onBack: (to?: "board" | "vault") => void;
  onUpdate: (id: number, patch: Partial<Order>) => void;
  onRoleSwitch?: (r: "marina" | "theo") => void;
}) {
  type Phase = "sealed" | "funding" | "revealing" | "revealed" | "settled";
  const [phase, setPhase] = useState<Phase>(
    order.state === "SETTLED" ? "settled" : order.revealed ? "revealed" : "sealed",
  );
  const revealed = phase === "revealed" || phase === "settled";
  const revealing = phase === "revealing";

  const fund = async () => {
    setPhase("funding");
    // simulate escrow funding tx pacing (mock until Move package deployed)
    await new Promise((r) => setTimeout(r, 1300));
    onUpdate(order.id, {
      state: "LOCKED",
      escrow: { ...order.escrow, funded: true, by: PERSONAS[role].name, byAddr: PERSONAS[role].addr },
    });
    setPhase("revealing");

    // ---- Real Walrus fetch + AES-GCM decrypt (when key available) ----
    let revealPatch: Partial<Order> = { revealed: true, state: "REVEALED" };
    try {
      const key = await loadKey(order.blobId);
      if (key) {
        const res = await fetch(`/api/walrus/blob/${encodeURIComponent(order.blobId)}`, { cache: "force-cache" });
        if (res.ok) {
          const buf = await res.arrayBuffer();
          const plaintext = await decryptText(buf, key);
          const decoded = JSON.parse(plaintext) as {
            amount: number; price: number; counter: number; minFill: number; note?: string;
          };
          revealPatch = {
            ...revealPatch,
            terms: {
              ...order.terms,
              amount: decoded.amount,
              price: decoded.price,
              counter: decoded.counter,
              minFill: decoded.minFill,
              note: decoded.note ?? order.terms.note,
            },
          };
        }
      }
    } catch (e) {
      // Decrypt failed (corrupt key, bad blob) — keep mock terms so the UI still functions.
      console.warn("[reveal] decrypt skipped:", e);
    }

    // Match the existing policy-check animation runtime (~2.5s of streaming lines)
    await new Promise((r) => setTimeout(r, 2600));
    onUpdate(order.id, revealPatch);
    setPhase("revealed");
  };

  const pipPose =
    phase === "funding" ? "sealing" :
    revealing ? "thinking" :
    phase === "revealed" ? "reveal" :
    phase === "settled" ? "proud" : "idle";

  return (
    <div className="fade-up" style={{ maxWidth: 1080, margin: "0 auto" }}>
      <button
        onClick={() => onBack("board")}
        style={{
          background: "none", border: "none", color: "var(--text-dim)",
          display: "inline-flex", alignItems: "center", gap: 7,
          fontSize: 14, fontWeight: 600, marginBottom: 18, cursor: "pointer",
          transform: "scaleX(-1)",
        }}
      >
        <Icon name="chev" size={16} /> <span style={{ transform: "scaleX(-1)" }}>Back to board</span>
      </button>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <Pair give={order.give} get={order.get} size={42} />
          <div>
            <h1 style={{ fontSize: 26 }}>
              {order.give} → {order.get}{" "}
              <span style={{ color: "var(--text-faint)", fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 400 }}>
                {order.code}
              </span>
            </h1>
            <div style={{ marginTop: 6 }}><MakerTag maker={order.maker} size={24} /></div>
          </div>
        </div>
        <Badge
          tone={phase === "settled" ? "good" : revealed ? "seal" : phase === "sealed" ? "open" : "locked"}
          icon={phase === "settled" ? "check" : revealed ? "unlock" : "lock"}
          size="md"
        >
          {{ sealed: "Sealed", funding: "Funding escrow", revealing: "Revealing", revealed: "Revealed", settled: "Settled" }[phase]}
        </Badge>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.25fr .85fr", gap: 24, alignItems: "start" }}>
        <TermsPanel order={order} revealed={revealed} revealing={revealing} revealStyle={revealStyle} />

        <div style={{ display: "flex", flexDirection: "column", gap: 18, position: "sticky", top: 20 }}>
          <Card pad={20} glow>
            <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 14 }}>
              <div style={{ animation: revealing ? "sway 2s infinite" : "floaty 4s infinite" }}>
                <Mascot pose={pipPose} size={64} />
              </div>
              <div style={{ fontSize: 13.5, color: "var(--text-dim)", lineHeight: 1.4 }}>{pipGuide(phase, isMine)}</div>
            </div>

            {isMine && phase === "sealed" && (
              <>
                <div style={{ background: "var(--deep)", borderRadius: "var(--r-sm)", padding: 14, marginBottom: 14 }}>
                  <div style={lblS}>Status</div>
                  <div style={{ fontWeight: 700, marginTop: 4 }}>Posted · waiting for a taker</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-faint)", marginTop: 6 }}>
                    You can walk away — if a taker funds escrow, Seal reveals your terms without you. No ghosting possible, by either side.
                  </div>
                </div>
                <Btn full variant="primary" icon="user" onClick={() => onRoleSwitch?.("theo")}>
                  View as taker (Theo) →
                </Btn>
                <Btn full variant="quiet" style={{ marginTop: 8 }}>Cancel offer</Btn>
              </>
            )}

            {!isMine && (phase === "sealed" || phase === "funding") && (
              <>
                <div style={{ background: "var(--deep)", borderRadius: "var(--r-sm)", padding: 14, marginBottom: 14, display: "grid", gap: 10 }}>
                  <Row label="Good-faith escrow"><b>{fmt(order.escrow.amount)} {order.escrow.asset}</b></Row>
                  <Row label="Refundable"><Badge tone="good" size="sm">Yes, if maker bails</Badge></Row>
                  <div style={{ fontSize: 12, color: "var(--text-faint)", lineHeight: 1.5 }}>
                    Funding escrow is what satisfies the Seal policy — it’s the key that unlocks the terms. Cancel after reveal and you forfeit the fee.
                  </div>
                </div>
                <Btn full size="lg" variant="seal" icon="unlock" disabled={phase === "funding"} onClick={fund}>
                  {phase === "funding" ? "Funding…" : "Fund escrow & request reveal"}
                </Btn>
              </>
            )}

            {revealed && phase !== "settled" && (
              <>
                <div style={{ background: "var(--deep)", borderRadius: "var(--r-sm)", padding: 14, marginBottom: 14, display: "grid", gap: 10 }}>
                  <Row label="You receive">
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                      <AssetIcon sym={order.side === "SELL" ? order.give : order.get} size={20} />
                      <b>{fmt(order.side === "SELL" ? order.terms.amount : order.terms.counter)}</b>
                    </span>
                  </Row>
                  <Row label="You deliver">
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                      <AssetIcon sym={order.side === "SELL" ? order.get : order.give} size={20} />
                      <b>{fmt(order.side === "SELL" ? order.terms.counter : order.terms.amount)}</b>
                    </span>
                  </Row>
                </div>
                <Btn full size="lg" variant="primary" icon="bolt" onClick={() => onSettle(order)}>
                  Confirm &amp; settle atomically
                </Btn>
                <div style={{ fontSize: 12, color: "var(--text-faint)", textAlign: "center", marginTop: 8 }}>
                  One PTB · both legs · no MEV window
                </div>
              </>
            )}

            {phase === "settled" && (
              <div style={{ textAlign: "center", padding: "8px 0" }}>
                <Badge tone="good" icon="check">Settled on-chain</Badge>
                <div style={{ marginTop: 14 }}>
                  <Btn full variant="primary" icon="shield" onClick={() => onBack("vault")}>Open the Vault</Btn>
                </div>
              </div>
            )}
          </Card>

          <Card pad={18}>
            <div style={{ ...lblS, marginBottom: 12 }}>Cryptographic commitment</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Mono label="blobId" copyable>{short(order.blobId, 11, 6)}</Mono>
              <Mono label="order" copyable>{short(order.orderObj, 10, 6)}</Mono>
              <Mono label="policy" copyable>{short(order.policyId, 10, 6)}</Mono>
              {order.escrow.funded && (
                <Mono label="escrow by" copyable>{order.escrow.byAddr || PERSONAS[role].addr}</Mono>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
