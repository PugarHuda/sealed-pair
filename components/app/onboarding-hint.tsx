"use client";
// One-time dismissible banner for first-time visitors. Spells out the
// seal -> escrow -> reveal -> settle flow in one breath. Dismissal stored
// in localStorage so returning users don't see it again.

import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";

const SEEN_KEY = "sealedpair:onboarding-seen";

export default function OnboardingHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const seen = window.localStorage.getItem(SEEN_KEY);
      if (!seen) setShow(true);
    } catch { /* private mode / quota — skip silently */ }
  }, []);

  const dismiss = () => {
    setShow(false);
    try { window.localStorage.setItem(SEEN_KEY, "1"); } catch { /* */ }
  };

  if (!show) return null;
  return (
    <div
      className="fade-up"
      style={{
        maxWidth: 1280, margin: "12px auto 0",
        padding: "12px 18px",
        background: "color-mix(in oklab, var(--seal) 18%, transparent)",
        border: "1px solid var(--seal-glow)",
        borderRadius: "var(--r-sm)",
        color: "var(--text)",
        display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
      }}
    >
      <Icon name="lock" size={16} style={{ color: "var(--seal-glow)", flex: "0 0 auto" }} />
      <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.5, flex: 1, minWidth: 0 }}>
        <b style={{ color: "var(--seal-glow)" }}>Welcome to Sealed Pair.</b>{" "}
        <span style={{ color: "var(--text-dim)" }}>
          Makers <b style={{ color: "var(--text)" }}>seal</b> a quote (encrypted to Walrus) →
          takers fund <b style={{ color: "var(--text)" }}>escrow</b> on Sui →
          Seal auto-<b style={{ color: "var(--text)" }}>reveals</b> the terms →
          one atomic PTB <b style={{ color: "var(--text)" }}>settles</b> both legs.
          No desk to trust, nothing to front-run.
        </span>
      </div>
      <button
        onClick={dismiss}
        title="Dismiss (won't show again)"
        style={{
          background: "transparent",
          border: "1px solid var(--border)",
          color: "var(--text-dim)",
          borderRadius: 99,
          padding: "5px 12px",
          fontSize: 11.5, fontWeight: 700,
          cursor: "pointer",
          flex: "0 0 auto",
        }}
      >
        Got it ×
      </button>
    </div>
  );
}
