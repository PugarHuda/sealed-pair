"use client";
import { CSSProperties, ReactNode } from "react";
import type { Order } from "@/lib/types";
import { PERSONAS } from "@/lib/data";

export const lblS: CSSProperties = {
  fontSize: 11.5,
  color: "var(--text-faint)",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: ".05em",
};

export const valS: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontWeight: 800,
  fontSize: 20,
  marginTop: 4,
};

export function PageHead({
  kicker, title, sub, right,
}: {
  kicker?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        gap: 20,
        flexWrap: "wrap",
        marginBottom: 24,
      }}
    >
      <div>
        {kicker && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: "var(--accent)",
              fontWeight: 700,
              fontSize: 13,
              letterSpacing: ".08em",
              textTransform: "uppercase",
              marginBottom: 10,
              whiteSpace: "nowrap",
            }}
          >
            {kicker}
          </div>
        )}
        <h1 style={{ fontSize: 38, letterSpacing: "-.02em" }}>{title}</h1>
        {sub && <div style={{ color: "var(--text-dim)", fontSize: 15.5, marginTop: 8, maxWidth: 560 }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}

export function MakerTag({ maker, size = 30, onClickProfile }: { maker: Order["maker"]; size?: number; onClickProfile?: (addr: string) => void }) {
  const m = typeof maker === "string" ? PERSONAS[maker] : maker;
  const color = (m as { color?: string; avatar?: string }).color || (m as { avatar?: string }).avatar || "var(--accent)";
  const initial = m.name[0];
  // Profile click only opens for on-chain makers (we stored the full addr
  // in eventToOrder). Demo personas don't carry an addr field.
  const fullAddr = (m as { addr?: string }).addr;
  const clickable = !!(onClickProfile && fullAddr);
  const content = (
    <>
      <span
        style={{
          width: size, height: size, borderRadius: "50%",
          background: color, color: "#06121f",
          display: "grid", placeItems: "center", fontWeight: 800,
          fontFamily: "var(--font-display)", fontSize: size * 0.46,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,.4)",
        }}
      >
        {initial}
      </span>
      <span style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.1, whiteSpace: "nowrap" }}>{m.name}</div>
        <div className="mono" style={{ fontSize: 11, color: "var(--text-faint)", whiteSpace: "nowrap" }}>
          {m.handle}
        </div>
      </span>
    </>
  );
  if (clickable) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (fullAddr) onClickProfile!(fullAddr);
        }}
        title="View maker profile"
        style={{
          display: "inline-flex", alignItems: "center", gap: 10,
          background: "transparent", border: "none", padding: 0, cursor: "pointer",
          textAlign: "left",
        }}
      >
        {content}
      </button>
    );
  }
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>{content}</span>;
}

export function Ghost({ w = 54 }: { w?: number }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: w,
        height: 13,
        borderRadius: 4,
        verticalAlign: "middle",
        background: "repeating-linear-gradient(90deg, var(--surface-3) 0 7px, transparent 7px 11px)",
        filter: "blur(1.2px)",
        opacity: 0.9,
      }}
    />
  );
}
