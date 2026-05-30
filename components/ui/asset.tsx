// AssetIcon + Pair — token glyphs, ported from components.jsx
"use client";
import { ASSETS } from "@/lib/data";
import type { AssetSym } from "@/lib/types";
import Icon from "./icon";

export function AssetIcon({ sym, size = 26 }: { sym: AssetSym; size?: number }) {
  const a = ASSETS[sym] || { color: "#888", glyph: "?" };
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: a.color,
        color: "#fff",
        display: "inline-grid",
        placeItems: "center",
        fontWeight: 700,
        fontSize: size * 0.5,
        flex: "0 0 auto",
        boxShadow: "0 2px 8px -2px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.4)",
      }}
    >
      {a.glyph}
    </span>
  );
}

export function Pair({ give, get, size = 26, gap = 6 }: { give: AssetSym; get: AssetSym; size?: number; gap?: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center" }}>
      <AssetIcon sym={give} size={size} />
      <span style={{ margin: `0 ${gap}px`, color: "var(--text-faint)", display: "inline-flex" }}>
        <Icon name="arrows" size={size * 0.7} />
      </span>
      <AssetIcon sym={get} size={size} />
    </span>
  );
}
