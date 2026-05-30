"use client";
import Mascot from "@/components/mascot";
import Bubbles from "@/components/bubbles";

function Grass({ x, y, s = 1, c }: { x: number; y: number; s?: number; c: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill={c}>
      <path d="M0,0 C-3,-20 -12,-30 -7,-52 C-2,-33 4,-22 3,0 Z" />
      <path d="M7,0 C5,-16 11,-28 17,-42 C11,-27 13,-14 12,0 Z" />
      <path d="M-8,0 C-9,-14 -17,-23 -19,-36 C-14,-21 -12,-12 -11,0 Z" />
    </g>
  );
}

function Coral({ x, y, s = 1, c }: { x: number; y: number; s?: number; c: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill="none" stroke={c} strokeWidth="5" strokeLinecap="round">
      <path d="M0,0 C-18,-28 -30,-14 -32,-40" />
      <path d="M0,0 C-7,-34 -16,-30 -14,-54" />
      <path d="M0,0 C8,-32 18,-32 16,-56" />
      <path d="M0,0 C20,-24 32,-18 34,-44" />
    </g>
  );
}

function Fish({ y, dur, delay, s = 1, c = "#2f93bf", op = 0.5 }: { y: number; dur: number; delay: number; s?: number; c?: string; op?: number }) {
  return (
    <g style={{ animation: `fishSwim ${dur}s linear infinite`, animationDelay: delay + "s", opacity: op }}>
      <g transform={`translate(0 ${y}) scale(${s})`} fill={c}>
        <ellipse cx="0" cy="0" rx="13" ry="7" />
        <path d="M-11,0 l-12,-8 l4,8 l-4,8 z" />
      </g>
    </g>
  );
}

export default function HeroScene() {
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }}>
      {/* sky wash */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(180deg,#f6fcff 0%,#eef9fd 50%,#e4f4fb 100%)",
        }}
      />
      {/* sun glow */}
      <div
        style={{
          position: "absolute",
          top: "-6%",
          right: "18%",
          width: 440,
          height: 440,
          borderRadius: "50%",
          background:
            "radial-gradient(circle,rgba(255,250,235,.9),rgba(255,243,210,.3) 45%,transparent 70%)",
          filter: "blur(6px)",
          animation: "glowPulse 7s ease-in-out infinite",
        }}
      />
      <svg
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMax slice"
        style={{ position: "absolute", left: 0, right: 0, bottom: 0, width: "100%", height: "46vh", display: "block" }}
      >
        <defs>
          <linearGradient id="ray" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fffaf0" stopOpacity=".55" />
            <stop offset="1" stopColor="#fffaf0" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* god rays */}
        <g opacity=".7">
          <polygon points="1040,-40 1130,-40 760,920 560,920" fill="url(#ray)" />
          <polygon points="1180,-40 1240,-40 1010,920 880,920" fill="url(#ray)" />
          <polygon points="900,-40 940,-40 700,920 600,920" fill="url(#ray)" opacity=".7" />
        </g>
        {/* distant peaks */}
        <path
          d="M-120,470 C 220,400 360,455 520,415 C 700,370 860,440 1040,400 C 1200,365 1330,420 1560,395 L1560,900 L-120,900 Z"
          fill="#cfe8f3"
          style={{ animation: "driftB 16s ease-in-out infinite" }}
        />
        <Fish y={500} dur={34} delay={0} s={0.9} c="#9fd4e6" op={0.45} />
        <path
          d="M-120,540 C 240,495 480,535 720,500 C 960,465 1200,520 1560,485 L1560,900 L-120,900 Z"
          fill="#a9dcea"
          style={{ animation: "driftA 13s ease-in-out infinite" }}
        />
        <path
          d="M-160,690 C 280,660 470,735 760,700 C 1030,668 1240,720 1620,690"
          fill="none"
          stroke="#eafaff"
          strokeWidth="30"
          strokeLinecap="round"
          opacity=".55"
          style={{ animation: "driftB 11s ease-in-out infinite" }}
        />
        <path
          d="M-120,640 C 300,600 560,650 820,615 C 1080,582 1280,635 1560,602 L1560,900 L-120,900 Z"
          fill="#74c6de"
          style={{ animation: "driftA 10s ease-in-out infinite" }}
        />
        <Fish y={660} dur={26} delay={6} s={1.1} c="#3f9bb4" op={0.55} />
        <Grass x={170} y={650} s={1.5} c="#3f9bb4" />
        <Grass x={1180} y={618} s={1.6} c="#3f9bb4" />
        <Grass x={930} y={636} s={1.1} c="#3f9bb4" />
        <path
          d="M-120,730 C 280,695 520,742 780,712 C 1040,682 1260,735 1560,705 L1560,900 L-120,900 Z"
          fill="#4aa9cf"
          style={{ animation: "driftB 8.5s ease-in-out infinite" }}
        />
        <path
          d="M-120,815 C 320,778 600,828 880,798 C 1120,772 1300,820 1560,800 L1560,900 L-120,900 Z"
          fill="#2f93bf"
          style={{ animation: "driftA 7s ease-in-out infinite" }}
        />
        <Coral x={86} y={840} s={1.9} c="#ff8a5e" />
        <Grass x={150} y={862} s={2.4} c="#1f7fa6" />
        <Grass x={40} y={880} s={2.1} c="#1f7fa6" />
        <Coral x={1360} y={838} s={2.0} c="#ff8a5e" />
        <Grass x={1300} y={866} s={2.5} c="#1f7fa6" />
        <Grass x={1410} y={884} s={2.2} c="#1f7fa6" />
      </svg>
      <div style={{ position: "absolute", right: "12%", bottom: "6%", animation: "bob 5.5s ease-in-out infinite" }}>
        <Mascot pose="idle" size={132} />
      </div>
      <div
        style={{
          position: "absolute",
          left: "13%",
          bottom: "4%",
          animation: "bob 6.8s ease-in-out infinite .8s",
          transform: "scaleX(-1)",
        }}
      >
        <Mascot pose="idle" size={86} palette="gold" />
      </div>
      <Bubbles n={22} absolute />
    </div>
  );
}
