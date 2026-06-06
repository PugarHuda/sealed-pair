"use client";
// Slide deck for live pitching. Keyboard-driven (←/→/Space/Home/End),
// full-bleed slides, brand-aligned. Same visual language as the landing
// page so judges who hit /slide first don't see a disconnected look.

import { CSSProperties, useEffect, useState } from "react";
import Link from "next/link";
import Mascot from "@/components/mascot";
import Icon from "@/components/ui/icon";

type Slide = {
  kicker?: string;
  title?: string;
  body: React.ReactNode;
  /** Optional layout override (default: vertical centered). */
  layout?: "center" | "split" | "stat-grid" | "title";
};

/* style atoms — declared above SLIDES so module-level JSX literals can reference them */

const kickerStyle: CSSProperties = {
  fontSize: 11,
  color: "var(--text-faint)",
  textTransform: "uppercase",
  letterSpacing: ".08em",
  fontWeight: 800,
  marginBottom: 10,
};

const listStyle: CSSProperties = {
  margin: 0,
  paddingLeft: 18,
  fontSize: 14.5,
  color: "var(--text-dim)",
  lineHeight: 1.7,
};

const mono: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "0.92em",
  color: "var(--text)",
  background: "var(--deep)",
  padding: "1px 6px",
  borderRadius: 4,
};

const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  fontWeight: 700,
  borderBottom: "1px solid var(--border)",
};

const tdStyle: CSSProperties = {
  padding: "14px 12px",
  verticalAlign: "top",
};

const statBig: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontWeight: 800,
  fontSize: 34,
  letterSpacing: "-.02em",
  color: "var(--accent)",
};

const statLabel: CSSProperties = {
  fontSize: 12,
  color: "var(--text-faint)",
  marginTop: 4,
};

const navBtn = (disabled: boolean): CSSProperties => ({
  display: "inline-grid",
  placeItems: "center",
  width: 28,
  height: 28,
  borderRadius: "50%",
  background: "var(--surface)",
  border: "1px solid var(--border)",
  color: disabled ? "var(--text-faint)" : "var(--text)",
  cursor: disabled ? "default" : "pointer",
  opacity: disabled ? 0.4 : 1,
});

const SLIDES: Slide[] = [
  // 1 — cover
  {
    layout: "title",
    body: (
      <div style={{ textAlign: "center" }}>
        <div style={{ display: "inline-grid", placeItems: "center", marginBottom: 26 }}>
          <Mascot pose="sealed" size={120} />
        </div>
        <div
          style={{
            fontSize: 13,
            color: "var(--text-faint)",
            fontFamily: "var(--font-mono)",
            letterSpacing: ".18em",
            textTransform: "uppercase",
            marginBottom: 10,
          }}
        >
          Tatum × Walrus · Build on Sui · June 2026
        </div>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: "clamp(56px, 9vw, 110px)",
            letterSpacing: "-.04em",
            lineHeight: 1,
            margin: 0,
          }}
        >
          Sealed Pair
        </h1>
        <div
          style={{
            marginTop: 22,
            fontSize: "clamp(18px, 2vw, 24px)",
            color: "var(--text-dim)",
            fontWeight: 500,
            maxWidth: 720,
            margin: "22px auto 0",
            lineHeight: 1.4,
          }}
        >
          Sealed peer-to-peer OTC trading on Sui.
          <br />
          <span style={{ color: "var(--seal-glow)" }}>Negotiate in the dark.</span>{" "}
          <span style={{ color: "var(--accent)" }}>Settle in the open.</span>
        </div>
        <div style={{ marginTop: 36, fontSize: 13, color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
          @PugarHuda · sealed-pair.vercel.app
        </div>
      </div>
    ),
  },
  // 2 — problem
  {
    kicker: "The problem",
    title: "OTC trading today is a brutal trade-off",
    body: (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 28, marginTop: 36 }}>
        <ProblemCard
          icon="bolt"
          tone="var(--bad)"
          name="Trade it on a DEX"
          punchline="The mempool front-runs you."
          detail="Your order moves the price before it fills. Slippage takes the rest."
        />
        <ProblemCard
          icon="user"
          tone="var(--warn)"
          name="Call an OTC desk"
          punchline="Now you trust a middleman."
          detail="They see the spread. They can ghost. Settlement drags for days."
        />
        <ProblemCard
          icon="doc"
          tone="var(--text-faint)"
          name="And afterwards?"
          punchline="No audit trail."
          detail="Try proving to your DAO what you agreed to. The paper trail sits off-chain — if it exists at all."
        />
      </div>
    ),
  },
  // 3 — solution
  {
    kicker: "The shape",
    title: "Sealed Pair: a third option",
    body: (
      <div style={{ marginTop: 30, display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16 }}>
        {[
          { n: "01", name: "Seal",     desc: "Maker encrypts terms locally → Walrus blob",       tone: "var(--accent)" },
          { n: "02", name: "Discover", desc: "Sealed quote hits the public RFQ board",            tone: "var(--accent-2)" },
          { n: "03", name: "Escrow",   desc: "Taker funds refundable deposit on Sui",             tone: "var(--seal-glow)" },
          { n: "04", name: "Reveal",   desc: "Seal auto-releases key — terms decrypt for both", tone: "var(--seal-glow)" },
          { n: "05", name: "Settle",   desc: "One atomic PTB moves both legs. Receipt minted.",   tone: "var(--good)" },
        ].map((s) => (
          <div
            key={s.n}
            style={{
              background: "var(--surface)",
              border: `1px solid color-mix(in oklab, ${s.tone} 28%, var(--border))`,
              borderRadius: "var(--r-md)",
              padding: "24px 18px",
            }}
          >
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: s.tone, marginBottom: 14, fontWeight: 800 }}>
              {s.n}
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22, marginBottom: 8 }}>
              {s.name}
            </div>
            <div style={{ fontSize: 14, color: "var(--text-dim)", lineHeight: 1.5 }}>{s.desc}</div>
          </div>
        ))}
      </div>
    ),
  },
  // 4 — why it wins
  {
    kicker: "Why it wins",
    title: "Nobody else built this combination on Sui",
    body: (
      <div style={{ marginTop: 30 }}>
        <div style={{ fontSize: 18, color: "var(--text-dim)", lineHeight: 1.55, maxWidth: 880 }}>
          We surveyed all <b style={{ color: "var(--text)" }}>599 Sui Overflow 2025</b> submissions and the full Walrus showcase.
          Plenty use one piece. Nobody combines:
        </div>
        <div style={{ marginTop: 28, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {[
            ["Commit-reveal", "blobId IS the commitment"],
            ["Seal-style selective disclosure", "key releases on policy match"],
            ["Walrus content addressing", "ciphertext provably immutable"],
            ["Atomic PTB settlement", "both legs in one tx, no MEV window"],
          ].map(([k, v]) => (
            <div
              key={k}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "16px 18px",
                background: "color-mix(in oklab, var(--accent) 8%, var(--surface))",
                border: "1px solid color-mix(in oklab, var(--accent) 25%, transparent)",
                borderRadius: "var(--r-sm)",
              }}
            >
              <span style={{ color: "var(--accent)" }}>
                <Icon name="check" size={20} sw={2.6} />
              </span>
              <span>
                <b style={{ fontSize: 17 }}>{k}</b>
                <span style={{ color: "var(--text-dim)", fontSize: 14, marginLeft: 10 }}>· {v}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  // 5 — integration depth Tatum
  {
    kicker: "Tatum integration",
    title: "14 Sui RPC methods · 4 product surfaces",
    layout: "stat-grid",
    body: (
      <div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginTop: 32 }}>
          <Stat n="14" label="distinct Sui RPC methods" tone="var(--accent)" />
          <Stat n="3" label="networks · dev / test / main" tone="var(--accent-2)" />
          <Stat n="4" label="Tatum products wired" tone="var(--seal-glow)" />
          <Stat n="69ms" label="median Tatum gateway latency" tone="var(--good)" />
        </div>
        <div style={{ marginTop: 28, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <div>
            <div style={kickerStyle}>Tatum surfaces wired</div>
            <ul style={listStyle}>
              <li><b>RPC Nodes</b> — 14 methods incl. events, objects, modules, balances, dry-run, dynamic fields</li>
              <li><b>RPC Gateway</b> — x-api-key custody, multi-network, latency probed every 30s</li>
              <li><b>Data API</b> — wallet-history surface via <span style={mono}>suix_queryTransactionBlocks</span></li>
              <li><b>MCP</b> — composed with Tatum&apos;s official MCP for full Sui RPC from any AI agent</li>
            </ul>
          </div>
          <div>
            <div style={kickerStyle}>Live evidence</div>
            <ul style={listStyle}>
              <li><span style={mono}>/api/integration-health</span> probes 7 endpoints every 30s</li>
              <li>Vault → live <span style={mono}>sui_getNormalizedMoveModule</span> introspection</li>
              <li>Settle digest verifier hits <span style={mono}>sui_getEvents</span> to prove emission</li>
              <li>Multi-network: instant switch between devnet / testnet / mainnet</li>
            </ul>
          </div>
        </div>
      </div>
    ),
  },
  // 6 — integration depth Walrus
  {
    kicker: "Walrus integration",
    title: "Walrus as cryptographic commitment, not just storage",
    body: (
      <div style={{ marginTop: 30 }}>
        <div
          style={{
            padding: "22px 28px",
            background: "color-mix(in oklab, var(--accent-2) 10%, var(--surface))",
            border: "1px solid var(--accent-2)",
            borderRadius: "var(--r-md)",
            fontSize: 18,
            lineHeight: 1.55,
            color: "var(--text)",
          }}
        >
          <b style={{ color: "var(--accent-2)" }}>The insight:</b> blobId is the BLAKE2b hash of the
          ciphertext. Storing it on-chain in <span style={mono}>Order.blob_id</span> turns Walrus from a CDN
          into <b>a content-addressed cryptographic commitment</b>. Swap the bytes anywhere and the commitment
          provably breaks.
        </div>
        <div style={{ marginTop: 28, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", padding: "20px 22px" }}>
            <div style={kickerStyle}>What we ship</div>
            <ul style={listStyle}>
              <li>3 publishers + 3 aggregators with HTTP failover</li>
              <li>Counter-offers upload their own encrypted blob — same commitment property</li>
              <li>Walrus blob inspector: real bytes, real headers, real fetch latency</li>
              <li>Reverse lookup via <span style={mono}>/v1/blobs/by-object-id/&lt;objId&gt;</span></li>
              <li>XSS-hardened proxy: <span style={mono}>Content-Disposition: attachment</span> + sandbox CSP</li>
            </ul>
          </div>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", padding: "20px 22px" }}>
            <div style={kickerStyle}>Anti-mock discipline</div>
            <ul style={listStyle}>
              <li>Every seal ceremony uploads to real Walrus testnet</li>
              <li>BlobInspector renders bytes that came over the wire, not fixtures</li>
              <li>Integration health probes the actual publishers / aggregators we use</li>
              <li>3 settlements landed — receipts traceable on SuiScan</li>
            </ul>
          </div>
        </div>
      </div>
    ),
  },
  // 7 — feature surface
  {
    kicker: "What we shipped",
    title: "40 features, 14 days, one solo build",
    body: (
      <div style={{ marginTop: 28 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16 }}>
          <FeatureBucket
            title="Discovery"
            items={["Mine filter", "Reputation tiers", "Pair depth", "Activity ticker", "Expiry countdown", "Watchlist"]}
            tone="var(--accent)"
          />
          <FeatureBucket
            title="Negotiation"
            items={["Sealed quote (AES + Walrus)", "Counter-offer flow", "Private/targeted orders", "Share-link deep-links"]}
            tone="var(--accent-2)"
          />
          <FeatureBucket
            title="Settlement"
            items={["Atomic lock + reveal PTB", "Pre-flight state + balance check", "cancel_open PTB", "cancel_expired reaper"]}
            tone="var(--seal-glow)"
          />
          <FeatureBucket
            title="Audit + AI"
            items={["Live contract introspection", "Digest verifier", "Walrus blob inspector", "Maker leaderboard", "Maker inbox", "MCP tools catalog"]}
            tone="var(--good)"
          />
        </div>
        <div
          style={{
            marginTop: 26,
            padding: "18px 22px",
            background: "var(--deep)",
            border: "1px solid var(--border-soft)",
            borderRadius: "var(--r-sm)",
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 20,
            textAlign: "center",
          }}
        >
          <div>
            <div style={statBig}>70+</div>
            <div style={statLabel}>QA findings · 11 rounds · all patched</div>
          </div>
          <div>
            <div style={statBig}>5</div>
            <div style={statLabel}>Move PTBs wired live · 2 settled on-chain</div>
          </div>
          <div>
            <div style={statBig}>13</div>
            <div style={statLabel}>seed archetypes · 25+ OPEN orders live</div>
          </div>
          <div>
            <div style={statBig}>15</div>
            <div style={statLabel}>backend routes · all green</div>
          </div>
        </div>
      </div>
    ),
  },
  // 8 — AI-ready
  {
    kicker: "AI surface",
    title: "Sui-native MCP — filling a real gap",
    body: (
      <div style={{ marginTop: 30 }}>
        <div
          style={{
            padding: "16px 22px",
            background: "color-mix(in oklab, var(--seal-glow) 10%, var(--surface))",
            border: "1px solid var(--seal-glow)",
            borderRadius: "var(--r-md)",
            fontSize: 16,
            lineHeight: 1.55,
            color: "var(--text)",
            marginBottom: 22,
          }}
        >
          <b style={{ color: "var(--seal-glow)" }}>The gap:</b> Tatum&apos;s official MCP ships
          10 Blockchain Data tools across 22+ chains (EVM family, BTC family, Solana, Cardano, …) —
          <b style={{ color: "var(--text)" }}> but Sui isn&apos;t one of them.</b> Sui only via
          raw <span style={mono}>gateway_execute_rpc</span>. We ship the Sui-native layer
          neither side delivers alone.
        </div>
        <div style={{ fontSize: 17, color: "var(--text-dim)", lineHeight: 1.5, maxWidth: 880, marginBottom: 22 }}>
          Any AI agent (Claude Desktop, Cursor, custom orchestrator) can query the live RFQ board,
          verify settlement digests, and read maker reputation — without wiring Sui RPC plumbing.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {[
            ["list_open_orders", "Zombie-filtered RFQ board"],
            ["wallet_history", "Tatum Data API · txs by address"],
            ["verify_settle_digest", "Proves OrderSettled emitted from this package"],
            ["maker_stats", "Tier · success rate · last activity"],
          ].map(([n, d]) => (
            <div
              key={n}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-sm)",
                padding: "16px 18px",
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <span
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "color-mix(in oklab, var(--seal) 22%, transparent)",
                  color: "var(--seal-glow)",
                  display: "grid",
                  placeItems: "center",
                  flex: "0 0 auto",
                }}
              >
                <Icon name="spark" size={18} sw={2.4} />
              </span>
              <div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700 }}>{n}</div>
                <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 2 }}>{d}</div>
              </div>
            </div>
          ))}
        </div>
        <div
          style={{
            marginTop: 24,
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            color: "var(--text-dim)",
            background: "var(--deep)",
            border: "1px solid var(--border-soft)",
            borderRadius: "var(--r-sm)",
            padding: "16px 18px",
          }}
        >
          $ curl https://sealed-pair.vercel.app/api/mcp
          <br />
          <span style={{ color: "var(--text-faint)" }}>{"// returns 4-tool catalog with full JSON schemas"}</span>
        </div>
      </div>
    ),
  },
  // 9 — judging fit
  {
    kicker: "Judging criteria",
    title: "Mapped to every weight",
    body: (
      <div style={{ marginTop: 28 }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 16 }}>
          <thead>
            <tr style={{ color: "var(--text-faint)", fontSize: 12, textTransform: "uppercase", letterSpacing: ".06em" }}>
              <th style={{ ...thStyle, width: "30%" }}>Criterion</th>
              <th style={{ ...thStyle, width: "10%", textAlign: "center" }}>Weight</th>
              <th style={thStyle}>How we score</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Walrus + Tatum Integration", "30%", "14 RPC methods · Walrus commitment + multi-publisher failover · live IntegrationHealth panel"],
              ["Technical Quality", "30%", "Strict TS · 5 atomic PTBs · 70+ QA fixes · server-side secret custody · XSS-hardened proxies"],
              ["Creativity", "20%", "Unique combo (commit-reveal + Seal + Walrus + atomic PTB for OTC) · MCP tools for AI agents"],
              ["Presentation", "20%", "Live demo · landing page · README · SUBMISSION.md · this deck"],
            ].map(([crit, w, how]) => (
              <tr key={crit} style={{ borderTop: "1px solid var(--border-soft)" }}>
                <td style={tdStyle}><b>{crit}</b></td>
                <td style={{ ...tdStyle, textAlign: "center", color: "var(--accent)", fontWeight: 800 }}>{w}</td>
                <td style={{ ...tdStyle, color: "var(--text-dim)" }}>{how}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div
          style={{
            marginTop: 28,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 14,
          }}
        >
          <div
            style={{
              padding: "18px 20px",
              background: "color-mix(in oklab, var(--accent) 12%, var(--surface))",
              border: "1px solid var(--accent)",
              borderRadius: "var(--r-sm)",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 800, color: "var(--accent)", marginBottom: 4 }}>
              🌟 Best Walrus Integration
            </div>
            <div style={{ fontSize: 14, color: "var(--text-dim)" }}>
              blobId as on-chain commitment + counter-offer side-blobs
            </div>
          </div>
          <div
            style={{
              padding: "18px 20px",
              background: "color-mix(in oklab, var(--accent-2) 12%, var(--surface))",
              border: "1px solid var(--accent-2)",
              borderRadius: "var(--r-sm)",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 800, color: "var(--accent-2)", marginBottom: 4 }}>
              ⚡ Best Use of Tatum Tools
            </div>
            <div style={{ fontSize: 14, color: "var(--text-dim)" }}>
              14 RPC methods · Data API · MCP compose
            </div>
          </div>
        </div>
      </div>
    ),
  },
  // 10 — CTA
  {
    layout: "title",
    body: (
      <div style={{ textAlign: "center" }}>
        <div style={{ display: "inline-grid", placeItems: "center", marginBottom: 30 }}>
          <Mascot pose="proud" size={120} />
        </div>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: "clamp(40px, 6vw, 76px)",
            letterSpacing: "-.03em",
            lineHeight: 1.05,
            margin: 0,
            maxWidth: 980,
          }}
        >
          Stop trusting the desk.
        </h1>
        <div style={{ marginTop: 26, fontSize: "clamp(16px, 1.6vw, 20px)", color: "var(--text-dim)", maxWidth: 660, margin: "26px auto 0" }}>
          Seal a quote, fund escrow, watch the price crack open on-chain. The whole thing runs in your
          browser — go break it.
        </div>
        <div style={{ marginTop: 40, display: "inline-flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
          <Link
            href="/app"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              background: "var(--accent)",
              color: "var(--accent-ink)",
              padding: "14px 26px",
              borderRadius: 99,
              fontWeight: 800,
              fontSize: 15,
              textDecoration: "none",
              boxShadow: "0 14px 30px -10px var(--accent)",
            }}
          >
            Try the live demo <Icon name="ext" size={16} sw={2.4} />
          </Link>
          <a
            href="https://github.com/PugarHuda/sealed-pair"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              background: "var(--surface)",
              color: "var(--text)",
              border: "1px solid var(--border)",
              padding: "14px 26px",
              borderRadius: 99,
              fontWeight: 700,
              fontSize: 15,
              textDecoration: "none",
            }}
          >
            <Icon name="doc" size={14} /> GitHub
          </a>
        </div>
        <div
          style={{
            marginTop: 50,
            fontSize: 13,
            color: "var(--text-faint)",
            fontFamily: "var(--font-mono)",
            letterSpacing: ".06em",
          }}
        >
          sealed-pair.vercel.app · @PugarHuda · Tatum × Walrus · Build on Sui
        </div>
      </div>
    ),
  },
];

export default function SlidePage() {
  const [idx, setIdx] = useState(0);

  // Read ?n=N for direct deep-links to a specific slide.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const n = Number(params.get("n"));
    if (Number.isFinite(n) && n >= 1 && n <= SLIDES.length) setIdx(n - 1);
  }, []);

  // Keep URL in sync so slide refs are shareable.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const u = new URL(window.location.href);
    u.searchParams.set("n", String(idx + 1));
    window.history.replaceState({}, "", u.toString());
  }, [idx]);

  // Keyboard nav.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName ?? "";
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        setIdx((i) => Math.min(i + 1, SLIDES.length - 1));
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        setIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Home") {
        e.preventDefault();
        setIdx(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setIdx(SLIDES.length - 1);
      } else if (e.key === "f" && (e.metaKey || e.ctrlKey === false) && document.fullscreenEnabled) {
        e.preventDefault();
        if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
        else document.exitFullscreen?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const slide = SLIDES[idx];
  const isTitleLayout = slide.layout === "title";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        color: "var(--text)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Subtle ambient gradient — matches the landing's lagoon. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 80% 60% at 50% -10%, color-mix(in oklab, var(--accent) 8%, transparent), transparent), radial-gradient(ellipse 60% 50% at 80% 110%, color-mix(in oklab, var(--seal) 10%, transparent), transparent)",
          pointerEvents: "none",
        }}
      />

      {/* Slide canvas */}
      <main
        style={{
          position: "relative",
          maxWidth: 1240,
          margin: "0 auto",
          padding: isTitleLayout ? "10vh 48px 80px" : "10vh 48px 110px",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: isTitleLayout ? "center" : "flex-start",
        }}
      >
        {slide.kicker && (
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              color: "var(--seal-glow)",
              letterSpacing: ".14em",
              textTransform: "uppercase",
              fontWeight: 700,
              marginBottom: 14,
            }}
          >
            {slide.kicker}
          </div>
        )}
        {slide.title && (
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: "clamp(36px, 5vw, 56px)",
              letterSpacing: "-.02em",
              lineHeight: 1.05,
              margin: 0,
              maxWidth: 1080,
            }}
          >
            {slide.title}
          </h2>
        )}
        <div style={{ flex: 1 }}>{slide.body}</div>
      </main>

      {/* Footer controls */}
      <footer
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "14px 24px",
          background: "color-mix(in oklab, var(--bg) 85%, transparent)",
          backdropFilter: "blur(10px)",
          borderTop: "1px solid var(--border-soft)",
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            color: "var(--text-faint)",
            fontSize: 12.5,
            fontWeight: 700,
            textDecoration: "none",
            letterSpacing: ".02em",
          }}
        >
          ← Sealed Pair
        </Link>
        <div style={{ flex: 1, display: "flex", justifyContent: "center", gap: 6 }}>
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              aria-label={`Go to slide ${i + 1}`}
              style={{
                width: i === idx ? 28 : 8,
                height: 8,
                borderRadius: 99,
                background: i === idx ? "var(--accent)" : "var(--surface-3)",
                border: "none",
                cursor: "pointer",
                transition: "all .2s",
                padding: 0,
              }}
            />
          ))}
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, fontSize: 12.5, color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
          <button
            onClick={() => setIdx((i) => Math.max(i - 1, 0))}
            disabled={idx === 0}
            style={navBtn(idx === 0)}
            aria-label="Previous slide"
          >
            <Icon name="chev" size={14} style={{ transform: "rotate(180deg)" }} />
          </button>
          <span style={{ fontVariantNumeric: "tabular-nums", minWidth: 50, textAlign: "center" }}>
            {idx + 1} / {SLIDES.length}
          </span>
          <button
            onClick={() => setIdx((i) => Math.min(i + 1, SLIDES.length - 1))}
            disabled={idx === SLIDES.length - 1}
            style={navBtn(idx === SLIDES.length - 1)}
            aria-label="Next slide"
          >
            <Icon name="chev" size={14} />
          </button>
        </div>
      </footer>

      {/* First-load hint */}
      {idx === 0 && (
        <div
          style={{
            position: "fixed",
            top: 24,
            right: 24,
            fontSize: 11.5,
            color: "var(--text-faint)",
            fontFamily: "var(--font-mono)",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 99,
            padding: "6px 12px",
            letterSpacing: ".02em",
          }}
        >
          ← → to navigate · F for fullscreen
        </div>
      )}
    </div>
  );
}

/* ============== inline sub-components ============== */

function ProblemCard({
  name, punchline, detail, icon, tone,
}: {
  name: string;
  punchline: string;
  detail: string;
  icon: "bolt" | "user" | "doc";
  tone: string;
}) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        padding: "26px 22px",
      }}
    >
      <span
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: `color-mix(in oklab, ${tone} 16%, transparent)`,
          color: tone,
          display: "grid",
          placeItems: "center",
          marginBottom: 16,
        }}
      >
        <Icon name={icon} size={18} sw={2.4} />
      </span>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 19, marginBottom: 6 }}>{name}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: tone, marginBottom: 10 }}>{punchline}</div>
      <div style={{ fontSize: 13.5, color: "var(--text-dim)", lineHeight: 1.5 }}>{detail}</div>
    </div>
  );
}

function Stat({ n, label, tone }: { n: string; label: string; tone: string }) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: `1px solid color-mix(in oklab, ${tone} 30%, var(--border))`,
        borderRadius: "var(--r-sm)",
        padding: "22px 18px",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: 44,
          letterSpacing: "-.02em",
          color: tone,
          lineHeight: 1,
        }}
      >
        {n}
      </div>
      <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 10, lineHeight: 1.4 }}>{label}</div>
    </div>
  );
}

function FeatureBucket({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: `1px solid color-mix(in oklab, ${tone} 26%, var(--border))`,
        borderRadius: "var(--r-sm)",
        padding: "18px 18px 16px",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: 16,
          color: tone,
          marginBottom: 12,
          letterSpacing: ".01em",
        }}
      >
        {title}
      </div>
      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13, color: "var(--text-dim)", lineHeight: 1.7 }}>
        {items.map((it) => (
          <li key={it}>{it}</li>
        ))}
      </ul>
    </div>
  );
}
