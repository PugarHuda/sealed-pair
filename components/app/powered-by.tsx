"use client";
// Small attribution footer that surfaces the hackathon-relevant integrations:
// Tatum (Sui RPC gateway), Walrus (decentralized storage), and Sui (chain).
// Visible at the bottom of every /app screen so judges immediately see
// which sponsor surfaces are actually wired.

import Icon from "@/components/ui/icon";

const ITEMS = [
  {
    label: "Powered by",
    name: "Tatum",
    sub: "Sui RPC gateway",
    href: "https://tatum.io",
    color: "var(--accent)",
  },
  {
    label: "Storage by",
    name: "Walrus",
    sub: "decentralized blob commitments",
    href: "https://walrus.xyz",
    color: "var(--accent-2)",
  },
  {
    label: "Built on",
    name: "Sui",
    sub: "Programmable Transaction Blocks",
    href: "https://sui.io",
    color: "var(--seal-glow)",
  },
];

export default function PoweredBy() {
  return (
    <div
      style={{
        maxWidth: 1280,
        margin: "32px auto 14px",
        padding: "16px 22px",
        background: "var(--surface)",
        border: "1px solid var(--border-soft)",
        borderRadius: "var(--r-md)",
        display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap",
      }}
    >
      <div style={{ fontSize: 11.5, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 800, flex: "0 0 auto" }}>
        Sponsor stack
      </div>
      {ITEMS.map((it) => (
        <a
          key={it.name}
          href={it.href}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            textDecoration: "none",
            color: "inherit",
            padding: "4px 10px",
            borderRadius: "var(--r-sm)",
            transition: "background .15s",
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: it.color, boxShadow: `0 0 6px ${it.color}`, flex: "0 0 auto" }} />
          <span>
            <span style={{ fontSize: 10.5, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 700, marginRight: 5 }}>
              {it.label}
            </span>
            <b style={{ color: it.color, fontSize: 13.5 }}>{it.name}</b>
            <span style={{ fontSize: 11.5, color: "var(--text-dim)", marginLeft: 6 }}>· {it.sub}</span>
          </span>
          <Icon name="ext" size={10} sw={2.2} style={{ color: "var(--text-faint)" }} />
        </a>
      ))}
    </div>
  );
}
