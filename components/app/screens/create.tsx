"use client";
import { useState } from "react";
import { ASSETS, bandFor } from "@/lib/data";
import type { AssetSym, Side } from "@/lib/types";
import { Badge, Btn, Card, Field, Input, Segmented, inputStyle, Row } from "@/components/ui/primitives";
import { AssetIcon, Pair } from "@/components/ui/asset";
import Icon from "@/components/ui/icon";
import Mascot from "@/components/mascot";
import { PageHead, Ghost } from "@/components/app/shared";

function AssetSelect({
  value, onChange, label,
}: {
  value: AssetSym;
  onChange: (v: AssetSym) => void;
  label: string;
}) {
  return (
    <Field label={label}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {(Object.keys(ASSETS) as AssetSym[]).map((s) => {
          const on = s === value;
          return (
            <button
              key={s}
              onClick={() => onChange(s)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: on ? "color-mix(in oklab, var(--accent) 16%, transparent)" : "var(--deep)",
                cursor: "pointer",
                border: `1.5px solid ${on ? "var(--accent)" : "var(--border)"}`,
                color: "var(--text)", borderRadius: "var(--r-sm)",
                padding: "9px 13px", fontWeight: 700, fontSize: 14, transition: "all .15s",
              }}
            >
              <AssetIcon sym={s} size={20} /> {s}
            </button>
          );
        })}
      </div>
    </Field>
  );
}

export type CreateDraft = {
  maker: "marina" | "theo";
  side: Side;
  give: AssetSym;
  get: AssetSym;
  terms: { amount: number; price: number; counter: number; give: AssetSym; get: AssetSym; minFill: number; note: string };
  sizeBand: string;
  expiry: string;
  /** Optional Sui address. When set, only this wallet can fund/settle the
   *  order. When omitted (empty), the offer is open to anyone. */
  targetTaker?: string;
};

export default function CreateScreen({
  role, onSeal,
}: {
  role: "marina" | "theo";
  onSeal: (d: CreateDraft) => void;
}) {
  const [side, setSide] = useState<Side>("SELL");
  const [give, setGive] = useState<AssetSym>("SUI");
  const [get, setGet] = useState<AssetSym>("USDC");
  const [amount, setAmount] = useState<number | string>(50000);
  const [price, setPrice] = useState<number | string>(3.92);
  const [expiry, setExpiry] = useState("12h");
  const [note, setNote] = useState("");
  const [audience, setAudience] = useState<"ALL" | "PRIVATE">("ALL");
  const [targetTaker, setTargetTaker] = useState("");
  const amt = Number(amount) || 0;
  const prc = Number(price) || 0;
  const counter = Math.round(amt * prc);

  // Sui addresses are 32 raw bytes → "0x" + 64 hex chars. We're tolerant and
  // just check the prefix + a reasonable hex length so paste-with-trailing-
  // whitespace doesn't block the user; downstream code lower-cases for match.
  const targetClean = targetTaker.trim().toLowerCase();
  // Sui addresses are exactly 32 bytes → "0x" + 64 hex chars. Ethereum's
  // 42-char addresses must NOT pass — they'd be stored, then never match
  // any Sui wallet, making the order invisible to everyone.
  const targetLooksValid =
    audience === "ALL" || (targetClean.startsWith("0x") && /^0x[0-9a-f]{64}$/.test(targetClean));
  const targetError = audience === "PRIVATE" && targetTaker.length > 0 && !targetLooksValid;

  const draft: CreateDraft = {
    maker: role,
    side, give, get,
    terms: { amount: amt, price: prc, counter, give, get, minFill: Math.round(amt * 0.25), note },
    sizeBand: bandFor(amt),
    expiry,
    targetTaker: audience === "PRIVATE" && targetLooksValid ? targetClean : undefined,
  };
  const canSeal = audience === "ALL" || (targetLooksValid && targetClean.length > 0);

  return (
    <div className="fade-up">
      <PageHead
        kicker={<><Icon name="lock" size={14} /> Maker desk</>}
        title="Seal a quote"
        sub="Fill the terms, then seal. Everything below the line gets encrypted before it ever touches the wire — takers only see the size band until they fund escrow."
      />
      <div className="create-grid">
        {/* form */}
        <Card pad={26} style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <Field label="Direction">
            <Segmented
              full
              value={side}
              onChange={(v) => setSide(v as Side)}
              options={[
                { value: "SELL", label: "I’m selling", icon: "arrows" },
                { value: "BUY",  label: "I’m buying",  icon: "arrows" },
              ]}
            />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
            <AssetSelect label={side === "SELL" ? "I give" : "I pay with"} value={give} onChange={setGive} />
            <AssetSelect label={"I want"} value={get} onChange={setGet} />
          </div>
          <div style={{ height: 1, background: "var(--border-soft)" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--seal-glow)", fontSize: 13, fontWeight: 700 }}>
            <Icon name="lock" size={15} /> Sealed terms — encrypted from here down
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
            <Field label={`Amount (${give})`}><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
            <Field label={`Price (${get} per ${give})`}><Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
          </div>
          <Field label="Counter-value" hint="What the taker delivers at settlement.">
            <div style={{ ...inputStyle, display: "flex", alignItems: "center", gap: 10, color: "var(--text)" }}>
              <AssetIcon sym={get} size={22} />
              <b style={{ fontFamily: "var(--font-display)", fontSize: 18 }}>{counter.toLocaleString("en-US")}</b>
              <span style={{ color: "var(--text-faint)" }}>{get}</span>
            </div>
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
            <Field label="Expiry window">
              <Segmented full value={expiry} onChange={setExpiry} options={["6h", "12h", "24h", "48h"]} />
            </Field>
            <Field label="Private note (optional)">
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="settlement memo…" />
            </Field>
          </div>
          {/* Audience picker — empty = public RFQ board, address = private 1-to-1 deal.
              Frontend-only enforcement for the hackathon; V2 will move the
              allowlist into the Order shared object so fund-checks happen
              inside `lock_with_escrow` itself. */}
          <Field label="Audience" hint="Empty = anyone can fund. Address = only that wallet.">
            <Segmented
              full
              value={audience}
              onChange={(v) => setAudience(v as "ALL" | "PRIVATE")}
              options={[
                { value: "ALL", label: "Open to everyone" },
                { value: "PRIVATE", label: "Private — specific address" },
              ]}
            />
          </Field>
          {audience === "PRIVATE" && (
            <Field label="Sell to (Sui address)">
              <Input
                value={targetTaker}
                onChange={(e) => setTargetTaker(e.target.value)}
                placeholder="0x…"
                style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}
              />
              {targetError && (
                <div style={{ fontSize: 12, color: "var(--bad)", marginTop: 6 }}>
                  Doesn&apos;t look like a Sui address (expected 0x + 40–64 hex chars).
                </div>
              )}
              {!targetError && targetClean.length > 0 && (
                <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 6 }}>
                  Only <span className="mono">{targetClean.slice(0, 10)}…{targetClean.slice(-6)}</span> will be able to fund this order.
                </div>
              )}
            </Field>
          )}
        </Card>

        {/* preview */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20, position: "sticky", top: 24 }}>
          <Card pad={22} glow>
            <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 16 }}>
              <Mascot pose="thinking" size={66} />
              <div>
                <div style={{ fontWeight: 800, fontFamily: "var(--font-display)", fontSize: 16 }}>What goes public</div>
                <div style={{ fontSize: 13, color: "var(--text-dim)" }}>Pip only gossips this much.</div>
              </div>
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              <Row label="Pair"><Pair give={give} get={get} size={22} /></Row>
              <Row label="Direction"><b>{side}</b></Row>
              <Row label="Size band"><Badge tone="open">{draft.sizeBand} {give}</Badge></Row>
              <div style={{ height: 1, background: "var(--border-soft)", margin: "2px 0" }} />
              <Row label={<span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--seal-glow)" }}><Icon name="lock" size={13} /> Exact amount</span>}><Ghost w={70} /></Row>
              <Row label={<span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--seal-glow)" }}><Icon name="lock" size={13} /> Price</span>}><Ghost w={50} /></Row>
              <Row label={<span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--seal-glow)" }}><Icon name="lock" size={13} /> Counter-value</span>}><Ghost w={80} /></Row>
            </div>
          </Card>
          <Btn size="lg" variant="seal" icon="lock" full disabled={!canSeal} onClick={() => onSeal(draft)}>
            {audience === "PRIVATE" && !targetLooksValid ? "Enter recipient address" : "Seal & post to Walrus"}
          </Btn>
          <div style={{ fontSize: 12.5, color: "var(--text-faint)", textAlign: "center", lineHeight: 1.5 }}>
            Encrypt → Walrus blobId (commitment) → Seal policy → Order object on Sui. ~4s, ~$0.02 in gas.
          </div>
        </div>
      </div>
    </div>
  );
}
