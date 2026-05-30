"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import Mascot from "@/components/mascot";
import { Btn } from "@/components/ui/primitives";

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const f = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", f);
    return () => window.removeEventListener("scroll", f);
  }, []);

  const link = (href: string, label: string) => (
    <a
      href={href}
      style={{ color: "var(--text-dim)", fontWeight: 600, fontSize: 14.5, padding: "8px 4px", transition: "color .15s" }}
      onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "var(--text)")}
      onMouseLeave={(e) => ((e.target as HTMLElement).style.color = "var(--text-dim)")}
    >
      {label}
    </a>
  );

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        transition: "all .25s",
        background: scrolled ? "color-mix(in oklab,var(--bg) 82%,transparent)" : "transparent",
        backdropFilter: scrolled ? "blur(14px)" : "none",
        borderBottom: `1px solid ${scrolled ? "var(--border-soft)" : "transparent"}`,
      }}
    >
      <div className="lp-wrap" style={{ display: "flex", alignItems: "center", gap: 24, padding: "14px 24px" }}>
        <a href="#top" style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 13,
              background: "color-mix(in oklab,var(--accent) 16%,var(--surface))",
              border: "1px solid var(--border)",
              display: "grid",
              placeItems: "center",
              overflow: "hidden",
              flex: "0 0 auto",
            }}
          >
            <div style={{ transform: "translateY(5px)" }}>
              <Mascot pose="idle" size={38} />
            </div>
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 19, lineHeight: 1 }}>Sealed Pair</div>
            <div style={{ fontSize: 10.5, color: "var(--text-faint)", fontFamily: "var(--font-mono)", marginTop: 3 }}>
              Sealed P2P OTC on Sui
            </div>
          </div>
        </a>
        <nav style={{ marginLeft: "auto", display: "flex", gap: 22, alignItems: "center" }}>
          {link("#how", "How it works")}
          {link("#why", "Why it wins")}
          {link("#security", "Security")}
          {link("#stack", "Stack")}
          <Link href="/app">
            <Btn variant="primary" size="sm" iconRight="chev">
              Launch app
            </Btn>
          </Link>
        </nav>
      </div>
    </header>
  );
}
