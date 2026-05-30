// Ambient floating bubbles. Ported from main.jsx / landing.jsx.
"use client";
import { useMemo } from "react";

export default function Bubbles({ n = 14, absolute = false }: { n?: number; absolute?: boolean }) {
  const arr = useMemo(
    () =>
      Array.from({ length: n }, () => ({
        left: Math.random() * 100,
        size: 6 + Math.random() * 22,
        dur: 9 + Math.random() * 12,
        delay: Math.random() * 12,
        op: 0.15 + Math.random() * 0.4,
      })),
    [n],
  );
  const wrap = absolute
    ? { position: "absolute" as const, inset: 0, overflow: "hidden", pointerEvents: "none" as const, zIndex: 0 }
    : undefined;
  const content = arr.map((b, i) => (
    <span
      key={i}
      className="bubble"
      style={{
        position: absolute ? "absolute" : "fixed",
        left: b.left + "%",
        width: b.size,
        height: b.size,
        animationDuration: b.dur + "s",
        animationDelay: b.delay + "s",
        opacity: b.op,
      }}
    />
  ));
  return absolute ? <div style={wrap}>{content}</div> : <>{content}</>;
}
