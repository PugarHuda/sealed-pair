"use client";
import Link from "next/link";
import Mascot from "@/components/mascot";
import { Btn } from "@/components/ui/primitives";
import Icon from "@/components/ui/icon";
import HeroScene from "./hero-scene";

export default function Hero() {
  return (
    <section id="top" className="hero-full">
      <HeroScene />
      <div
        className="lp-wrap"
        style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center" }}
      >
        {/* credential pill */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 11,
            background: "color-mix(in oklab,var(--surface) 78%,transparent)",
            backdropFilter: "blur(8px)",
            border: "1px solid var(--border)",
            borderRadius: 99,
            padding: "8px 8px 8px 16px",
            boxShadow: "0 8px 24px -14px rgba(14,44,67,.5)",
            fontSize: 13,
            fontWeight: 700,
            color: "var(--text-dim)",
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)" }} />
          Peer-to-peer OTC, sealed on Sui
          <span style={{ display: "inline-flex", gap: 6, marginLeft: 4 }}>
            {["Walrus", "Seal", "Tatum"].map((x) => (
              <span
                key={x}
                style={{
                  background: "var(--surface-3)",
                  color: "var(--text)",
                  borderRadius: 99,
                  padding: "4px 10px",
                  fontSize: 11.5,
                }}
              >
                {x}
              </span>
            ))}
          </span>
        </div>

        <h1 className="hero-h1" style={{ marginTop: 22, width: "100%", paddingBottom: "0.1em" }}>
          <span style={{ color: "var(--text)" }}>Move size without</span>
          <br />
          <span className="serif-ital" style={{ color: "var(--accent)" }}>
            tipping your hand.
          </span>
        </h1>

        <p className="lead" style={{ marginTop: 52, fontSize: "clamp(16px,1.7vw,20px)", maxWidth: 600 }}>
          Post a quote with the price locked. It only opens once the other side puts up escrow — and the moment it
          does, both sides settle in a single Sui transaction. No desk to trust. Nothing to front-run.
        </p>

        {/* glassy demo card */}
        <Link
          href="/app"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            width: "min(540px,92%)",
            marginTop: 30,
            background: "color-mix(in oklab,var(--surface) 82%,transparent)",
            backdropFilter: "blur(10px)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            padding: "15px 20px",
            boxShadow: "0 18px 40px -22px rgba(14,44,67,.5)",
            textAlign: "left",
            transform: "rotate(-0.8deg)",
          }}
        >
          <div
            style={{
              width: 50,
              height: 50,
              borderRadius: 14,
              background: "color-mix(in oklab,var(--accent) 16%,var(--surface))",
              border: "1px solid var(--border)",
              display: "grid",
              placeItems: "center",
              overflow: "hidden",
              flex: "0 0 auto",
            }}
          >
            <div style={{ transform: "translateY(6px)" }}>
              <Mascot pose="sealed" size={42} />
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--accent)" }}>
              Playable demo
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18 }}>Run a sealed trade yourself</div>
          </div>
          <span style={{ color: "var(--text-dim)" }}>
            <Icon name="ext" size={20} />
          </span>
        </Link>

        <div style={{ display: "flex", gap: 14, marginTop: 24, flexWrap: "wrap", justifyContent: "center" }}>
          <Link href="/app">
            <Btn
              variant="primary"
              size="lg"
              iconRight="chev"
              style={{ background: "var(--text)", color: "#fff", boxShadow: "0 14px 30px -12px rgba(14,44,67,.6)" }}
            >
              Try the demo
            </Btn>
          </Link>
          <Btn
            variant="ghost"
            size="lg"
            icon="eye"
            style={{ boxShadow: "0 10px 26px -16px rgba(14,44,67,.5)" }}
            onClick={() => document.getElementById("how")?.scrollIntoView()}
          >
            How it works
          </Btn>
        </div>
      </div>
    </section>
  );
}
