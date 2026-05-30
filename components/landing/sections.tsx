"use client";
import Link from "next/link";
import Mascot from "@/components/mascot";
import Bubbles from "@/components/bubbles";
import Icon, { IconName } from "@/components/ui/icon";
import { Btn, Badge, Card } from "@/components/ui/primitives";
import type { Pose } from "@/lib/types";

/* ---------------- PROBLEM ---------------- */
export function Problem() {
  const items: { icon: IconName; t: string; d: string }[] = [
    { icon: "wave", t: "Trade it on a DEX",        d: "Your order moves the price before it fills, and the mempool sees it coming. Slippage takes the rest." },
    { icon: "user", t: "Call an OTC desk",         d: "Now you’re trusting a middleman, paying the spread, and hoping they don’t walk halfway through. Settlement drags for days." },
    { icon: "doc",  t: "And afterwards?",          d: "Good luck proving to your DAO what you actually agreed to. The paper trail sits off-chain — if it exists at all." },
  ];
  return (
    <section
      className="lp-section"
      style={{ background: "var(--bg-2)", borderTop: "1px solid var(--border-soft)", borderBottom: "1px solid var(--border-soft)" }}
    >
      <div className="lp-wrap">
        <div className="eyebrow"><Icon name="bolt" size={14} /> The problem</div>
        <h2 className="sec-title">Right now, a big trade means picking your poison.</h2>
        <div className="cards-3" style={{ marginTop: 40 }}>
          {items.map((it, i) => (
            <Card key={i} pad={24} style={{ height: "100%" }}>
              <span
                style={{
                  width: 46, height: 46, borderRadius: 13,
                  background: "color-mix(in oklab,var(--accent-2) 18%,transparent)",
                  color: "var(--accent-2)", display: "grid", placeItems: "center", marginBottom: 16,
                }}
              >
                <Icon name={it.icon} size={22} />
              </span>
              <h3 style={{ fontSize: 20 }}>{it.t}</h3>
              <p style={{ color: "var(--text-dim)", fontSize: 15, lineHeight: 1.6, marginTop: 10 }}>{it.d}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- HOW ---------------- */
export function How() {
  const steps: { n: string; pose: Pose; t: string; d: string; tag: string }[] = [
    { n: "01", pose: "sealing",  t: "Seal",     d: "The maker encrypts the terms locally and posts the ciphertext to Walrus. The blobId is the commitment.", tag: "Walrus blobId" },
    { n: "02", pose: "idle",     t: "Discover", d: "Sealed quotes hit the public RFQ board. Takers see only the size band — never the price.",               tag: "RFQ board" },
    { n: "03", pose: "thinking", t: "Escrow",   d: "A taker funds a refundable good-faith deposit. That deposit is what satisfies the Seal policy.",         tag: "Sui escrow" },
    { n: "04", pose: "reveal",   t: "Reveal",   d: "Seal auto-releases the key the instant the policy is met. Terms decrypt for both parties — no ghosting.", tag: "Seal policy" },
    { n: "05", pose: "proud",    t: "Settle",   d: "One atomic PTB moves both legs at once. A receipt is minted — provable on-chain forever.",                tag: "Atomic PTB" },
  ];
  return (
    <section id="how" className="lp-section">
      <div className="lp-wrap">
        <div className="eyebrow"><Icon name="layers" size={14} /> How it works</div>
        <h2 className="sec-title">How a sealed trade actually goes.</h2>
        <p className="lead" style={{ marginTop: 14 }}>
          Same five steps, every time. Pip handles the cryptography — the only thing either side has to trust is the chain.
        </p>
        <div className="steps-grid" style={{ marginTop: 44 }}>
          {steps.map((s, i) => (
            <Card key={i} pad={20} hover style={{ height: "100%", textAlign: "center" }}>
              <div className="mono" style={{ color: "var(--accent)", fontWeight: 700, fontSize: 14 }}>{s.n}</div>
              <div
                style={{
                  height: 108, display: "grid", placeItems: "center",
                  animation: `floaty ${4 + i * 0.3}s ease-in-out infinite`,
                }}
              >
                <Mascot pose={s.pose} size={96} />
              </div>
              <h3 style={{ fontSize: 21, marginTop: 4 }}>{s.t}</h3>
              <p style={{ color: "var(--text-dim)", fontSize: 14, lineHeight: 1.55, marginTop: 8 }}>{s.d}</p>
              <div style={{ marginTop: 14 }}>
                <Badge tone="seal" size="sm">{s.tag}</Badge>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- WHY ---------------- */
export function Why() {
  const combo = ["Commit-reveal", "Seal selective disclosure", "Walrus commitment", "Atomic PTB settle"];
  return (
    <section
      id="why"
      className="lp-section"
      style={{ background: "var(--bg-2)", borderTop: "1px solid var(--border-soft)", borderBottom: "1px solid var(--border-soft)" }}
    >
      <div className="lp-wrap" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 36 }}>
        <div style={{ textAlign: "center", maxWidth: 760, margin: "0 auto" }}>
          <div className="eyebrow" style={{ justifyContent: "center" }}>
            <Icon name="spark" size={14} /> Why it wins
          </div>
          <h2 className="sec-title" style={{ marginTop: 14 }}>
            Nobody has built this on&nbsp;Sui.
          </h2>
          <p className="lead" style={{ margin: "16px auto 0" }}>
            We went through 599 Sui Overflow projects and the whole Walrus showcase. Plenty use one of these pieces.
            Not one puts commit-reveal, Seal, Walrus, and atomic settlement together for OTC. So we did.
          </p>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
          {combo.map((c, i) => (
            <span
              key={i}
              style={{
                display: "inline-flex", alignItems: "center", gap: 9,
                background: "var(--surface)", border: "1px solid var(--accent)",
                borderRadius: 99, padding: "11px 18px", fontWeight: 700, fontSize: 14.5,
                boxShadow: "var(--glow)",
              }}
            >
              <Icon name="check" size={16} style={{ color: "var(--accent)" }} />
              {c}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- SECURITY ---------------- */
export function Security() {
  const cards: { icon: IconName; t: string; d: string }[] = [
    { icon: "shield", t: "No ghosting",         d: "Seal auto-releases on policy match. A maker can go offline — the trade still completes without them." },
    { icon: "bolt",   t: "No MEV window",       d: "Settlement is a single atomic PTB. There’s no public intent to front-run, no gap between legs." },
    { icon: "lock",   t: "Tamper-proof terms",  d: "The blobId is the hash of the ciphertext. Swap the terms and the commitment changes — provably." },
    { icon: "eye",    t: "Selective disclosure",d: "Seal’s Move policy decides exactly who decrypts, and only after escrow. Eavesdroppers get useless bytes." },
  ];
  return (
    <section id="security" className="lp-section">
      <div className="lp-wrap">
        <div className="eyebrow"><Icon name="shield" size={14} /> Threat model</div>
        <h2 className="sec-title">Built for adversaries, not demos.</h2>
        <div className="stack-4" style={{ marginTop: 40 }}>
          {cards.map((c, i) => (
            <Card key={i} pad={22} style={{ height: "100%" }}>
              <span
                style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: "color-mix(in oklab,var(--seal) 20%,transparent)",
                  color: "var(--seal-glow)", display: "grid", placeItems: "center", marginBottom: 14,
                }}
              >
                <Icon name={c.icon} size={21} />
              </span>
              <h3 style={{ fontSize: 18 }}>{c.t}</h3>
              <p style={{ color: "var(--text-dim)", fontSize: 14, lineHeight: 1.55, marginTop: 9 }}>{c.d}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- STACK ---------------- */
export function Stack() {
  const s: { c: string; ic: IconName; t: string; d: string }[] = [
    { c: "#28c2b8", ic: "layers", t: "Walrus", d: "Content-addressed storage. The ciphertext lives here; its blobId is the cryptographic commitment." },
    { c: "#7b8cff", ic: "lock",   t: "Seal",   d: "Threshold encryption with Move-defined access policies. Releases keys only when conditions are met." },
    { c: "#4da2ff", ic: "drop",   t: "Sui PTB",d: "Programmable Transaction Blocks settle both legs of the trade atomically, with sub-3s finality." },
    { c: "#ffb24a", ic: "bolt",   t: "Tatum",  d: "RPC for every on-chain call and Data API for the live audit dashboard and volume analytics." },
  ];
  return (
    <section id="stack" className="lp-section" style={{ background: "var(--bg-2)", borderTop: "1px solid var(--border-soft)" }}>
      <div className="lp-wrap">
        <div className="eyebrow"><Icon name="anchor" size={14} /> The stack</div>
        <h2 className="sec-title">Four tools, doing one job.</h2>
        <div className="stack-4" style={{ marginTop: 40 }}>
          {s.map((x, i) => (
            <Card key={i} pad={22} style={{ height: "100%" }}>
              <span
                style={{
                  width: 46, height: 46, borderRadius: "50%",
                  background: x.c, color: "#06121f", display: "grid", placeItems: "center", marginBottom: 14,
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,.4)",
                }}
              >
                <Icon name={x.ic} size={23} sw={2.2} />
              </span>
              <h3 style={{ fontSize: 19 }}>{x.t}</h3>
              <p style={{ color: "var(--text-dim)", fontSize: 14, lineHeight: 1.55, marginTop: 9 }}>{x.d}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- FOOTER + final CTA ---------------- */
export function Footer() {
  return (
    <section className="lp-section" style={{ paddingBottom: 0 }}>
      <div className="lp-wrap">
        <div
          style={{
            position: "relative", overflow: "hidden",
            background: "linear-gradient(135deg,var(--surface-2),var(--surface))",
            border: "1px solid var(--accent)", borderRadius: "var(--r-xl)",
            padding: "56px 40px", textAlign: "center", boxShadow: "var(--glow)",
          }}
        >
          <Bubbles n={10} absolute />
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ display: "grid", placeItems: "center", marginBottom: 8, animation: "sway 4s ease-in-out infinite" }}>
              <Mascot pose="reveal" size={120} />
            </div>
            <h2 style={{ fontSize: "clamp(28px,4vw,42px)" }}>Stop trusting the desk.</h2>
            <p className="lead" style={{ margin: "14px auto 0" }}>
              Seal a quote, fund the escrow, and watch the price crack open on-chain. The whole thing runs in your browser
              — go break it.
            </p>
            <div style={{ display: "flex", gap: 14, justifyContent: "center", marginTop: 28, flexWrap: "wrap" }}>
              <Link href="/app"><Btn variant="primary" size="lg" iconRight="chev">Try the demo</Btn></Link>
              <Link href="/app"><Btn variant="outline" size="lg" icon="search">Browse the board</Btn></Link>
            </div>
          </div>
        </div>
      </div>
      <footer
        className="lp-wrap"
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "40px 24px 48px", flexWrap: "wrap", gap: 16, marginTop: 40,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <div
            style={{
              width: 38, height: 38, borderRadius: 11,
              background: "var(--surface)", border: "1px solid var(--border)",
              display: "grid", placeItems: "center", overflow: "hidden",
            }}
          >
            <div style={{ transform: "translateY(5px)" }}>
              <Mascot pose="idle" size={32} />
            </div>
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}>Sealed Pair</div>
            <div className="mono" style={{ fontSize: 11, color: "var(--text-faint)" }}>sea-horse · sealed pair</div>
          </div>
        </div>
        <div style={{ color: "var(--text-faint)", fontSize: 13 }}>Private quotes, public settlement — peer to peer on Sui.</div>
      </footer>
    </section>
  );
}
