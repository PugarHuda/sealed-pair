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
  const amt = Number(amount) || 0;
  const prc = Number(price) || 0;
  const counter = Math.round(amt * prc);

  const draft: CreateDraft = {
    maker: role,
    side, give, get,
    terms: { amount: amt, price: prc, counter, give, get, minFill: Math.round(amt * 0.25), note },
    sizeBand: bandFor(amt),
    expiry,
  };

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
          <Btn size="lg" variant="seal" icon="lock" full onClick={() => onSeal(draft)}>
            Seal &amp; post to Walrus
          </Btn>
          <div style={{ fontSize: 12.5, color: "var(--text-faint)", textAlign: "center", lineHeight: 1.5 }}>
            Encrypt → Walrus blobId (commitment) → Seal policy → Order object on Sui. ~4s, ~$0.02 in gas.
          </div>
        </div>
      </div>
    </div>
  );
}
