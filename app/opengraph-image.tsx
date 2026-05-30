// Server-rendered Open Graph image: 1200x630, branded with Pip the seahorse.
// Next.js automatically wires this as the og:image for the landing page.
// Visit /opengraph-image to view; share to Twitter/LinkedIn and they fetch it.
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Sealed Pair — sealed P2P OTC on Sui";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background:
            "linear-gradient(180deg,#f6fcff 0%,#eef9fd 45%,#a9dcea 75%,#2f93bf 100%)",
          padding: "60px 80px",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* Sun glow upper right */}
        <div
          style={{
            position: "absolute",
            top: -120,
            right: -80,
            width: 480,
            height: 480,
            borderRadius: "50%",
            background:
              "radial-gradient(circle,rgba(255,250,235,.9),rgba(255,243,210,.3) 45%,transparent 70%)",
          }}
        />

        {/* Pill of stack chips */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 18px 10px 20px",
            background: "rgba(255,255,255,.78)",
            border: "1px solid #cfe0ed",
            borderRadius: 99,
            fontSize: 22,
            fontWeight: 700,
            color: "#4f718d",
            alignSelf: "flex-start",
            boxShadow: "0 8px 24px -14px rgba(14,44,67,.5)",
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "#1f8fd1",
            }}
          />
          Peer-to-peer OTC, sealed on Sui
          <span style={{ display: "flex", gap: 6, marginLeft: 4 }}>
            {["Walrus", "Seal", "Tatum"].map((t) => (
              <span
                key={t}
                style={{
                  background: "#e7f1f8",
                  color: "#0e2c43",
                  borderRadius: 99,
                  padding: "5px 14px",
                  fontSize: 18,
                  fontWeight: 700,
                }}
              >
                {t}
              </span>
            ))}
          </span>
        </div>

        {/* Hero headline */}
        <div
          style={{
            marginTop: 60,
            display: "flex",
            flexDirection: "column",
            fontSize: 100,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1.05,
            color: "#0e2c43",
          }}
        >
          <span>Move size without</span>
          <span
            style={{
              fontFamily: "Georgia, serif",
              fontStyle: "italic",
              fontWeight: 400,
              color: "#1f8fd1",
            }}
          >
            tipping your hand.
          </span>
        </div>

        {/* Pip the seahorse (simplified SVG) */}
        <svg
          width="280"
          height="356"
          viewBox="0 0 220 280"
          style={{ position: "absolute", right: 80, bottom: 60 }}
        >
          <defs>
            <linearGradient id="og-body" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ff8f63" />
              <stop offset="1" stopColor="#e9683f" />
            </linearGradient>
            <linearGradient id="og-fin" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#5fe0ff" />
              <stop offset="1" stopColor="#2fb3e0" />
            </linearGradient>
          </defs>
          <path
            d="M168 120 q 38 -2 40 30 q -22 -6 -30 8 q 16 6 14 30 q -20 -10 -28 4 q 8 12 0 30 q -18 -14 -22 0 z"
            fill="url(#og-fin)"
            stroke="#2fb3e0"
            strokeWidth="2.5"
            strokeLinejoin="round"
            transform="rotate(8 168 150)"
          />
          <path
            d="M122 112 C 150 150, 168 168, 150 200 C 138 222, 108 230, 96 210 C 86 194, 100 178, 118 188 C 130 195, 126 210, 114 210"
            fill="none"
            stroke="#15243a"
            strokeWidth="54"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M122 112 C 150 150, 168 168, 150 200 C 138 222, 108 230, 96 210 C 86 194, 100 178, 118 188 C 130 195, 126 210, 114 210"
            fill="none"
            stroke="url(#og-body)"
            strokeWidth="44"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="120" cy="92" r="50" fill="#15243a" />
          <circle cx="120" cy="92" r="44" fill="url(#og-body)" />
          <rect x="42" y="102" width="50" height="22" rx="11" fill="url(#og-body)" />
          {/* eye */}
          <ellipse cx="138" cy="95" rx="15" ry="18" fill="#fff" stroke="#15243a" strokeWidth="3" />
          <circle cx="138" cy="100" r="13" fill="#243f8f" />
          <circle cx="133" cy="92" r="5" fill="#fff" />
          {/* coronet */}
          <path d="M96 50 l -8 -22 l 16 8 z" fill="#ffd27a" stroke="#15243a" strokeWidth="3" strokeLinejoin="round" />
          <path d="M120 44 l 0 -26 l 12 16 z" fill="#ffd27a" stroke="#15243a" strokeWidth="3" strokeLinejoin="round" />
          <path d="M142 52 l 12 -18 l 2 18 z" fill="#ffd27a" stroke="#15243a" strokeWidth="3" strokeLinejoin="round" />
        </svg>

        {/* Footer URL */}
        <div
          style={{
            position: "absolute",
            bottom: 50,
            left: 80,
            fontSize: 26,
            fontWeight: 700,
            color: "#0e2c43",
            display: "flex",
            gap: 14,
            alignItems: "center",
          }}
        >
          🦭 sealed-pair.vercel.app
        </div>
      </div>
    ),
    size,
  );
}
