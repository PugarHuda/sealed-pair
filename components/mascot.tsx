// Pip — the sealed-pair seahorse mascot. Cel-shaded multi-pose host.
// Ported pixel-perfect from mascot.jsx (Claude Design handoff).
"use client";
import { CSSProperties, useId } from "react";
import type { MascotPaletteKey, Pose } from "@/lib/types";

type Palette = { body: string; bodyDark: string; belly: string; fin: string; finDark: string; coronet: string };

export const MASCOT_PALETTES: Record<MascotPaletteKey, Palette> = {
  coral: { body: "#ff8f63", bodyDark: "#e9683f", belly: "#ffe4c6", fin: "#5fe0ff", finDark: "#2fb3e0", coronet: "#ffd27a" },
  jelly: { body: "#ff6fae", bodyDark: "#e0438b", belly: "#ffe0f0", fin: "#8a7dff", finDark: "#6a5cff", coronet: "#ffe27a" },
  mint:  { body: "#4fd6c4", bodyDark: "#28b1a0", belly: "#dffaf4", fin: "#ffd27a", finDark: "#ef9f3a", coronet: "#ff9f7a" },
  gold:  { body: "#ffc24a", bodyDark: "#e89a16", belly: "#fff0cf", fin: "#5fe0ff", finDark: "#2fb3e0", coronet: "#ff8f63" },
};

type Props = {
  pose?: Pose;
  size?: number;
  expressive?: number; // 0..1
  palette?: MascotPaletteKey;
  style?: CSSProperties;
};

export default function Mascot({
  pose = "idle",
  size = 160,
  expressive = 1,
  palette = "coral",
  style,
}: Props) {
  const uid = useId().replace(/:/g, "");
  const p = MASCOT_PALETTES[palette] || MASCOT_PALETTES.coral;
  const ex = Math.max(0, Math.min(1, expressive));

  const eyeCX = 138;
  const eyeCY = 95;

  const openEye = (lookX = 0, lookY = 0) => (
    <g>
      <ellipse cx={eyeCX} cy={eyeCY} rx="15.5" ry="18.5" fill="#fff" stroke="#15243a" strokeWidth="3.6" />
      <clipPath id={`ec${uid}`}>
        <ellipse cx={eyeCX} cy={eyeCY} rx="15.5" ry="18.5" />
      </clipPath>
      <g clipPath={`url(#ec${uid})`}>
        <circle cx={eyeCX + lookX} cy={eyeCY + 5 + lookY} r="13.5" fill={`url(#iris${uid})`} />
        <ellipse cx={eyeCX + lookX} cy={eyeCY + 6 + lookY} rx="6.6" ry="9" fill="#0a1526" />
        <ellipse cx={eyeCX + lookX} cy={eyeCY + 13 + lookY} rx="9" ry="4.5" fill="#bdf0ff" opacity=".6" />
        <circle cx={eyeCX - 5 + lookX} cy={eyeCY - 3 + lookY} r="5.6" fill="#fff" />
        <circle cx={eyeCX + 6.5 + lookX} cy={eyeCY + 9 + lookY} r="3" fill="#fff" opacity=".9" />
        <path
          d={`M ${eyeCX - 17} ${eyeCY - 21} L ${eyeCX + 17} ${eyeCY - 21} L ${eyeCX + 17} ${eyeCY - 8} Q ${eyeCX} ${eyeCY - 5} ${eyeCX - 17} ${eyeCY - 9} Z`}
          fill="#15243a"
          opacity=".88"
        />
      </g>
      <path
        d={`M ${eyeCX - 15} ${eyeCY - 11} Q ${eyeCX} ${eyeCY - 22} ${eyeCX + 16} ${eyeCY - 9}`}
        fill="none"
        stroke="#15243a"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path d={`M ${eyeCX + 15} ${eyeCY - 9} l 8 -4.5`} stroke="#15243a" strokeWidth="4" strokeLinecap="round" />
    </g>
  );

  let eye: JSX.Element;
  if (pose === "sealing" || pose === "sealed") {
    eye = (
      <g>
        <path
          d={`M ${eyeCX - 14} ${eyeCY + 2} Q ${eyeCX} ${eyeCY - 14} ${eyeCX + 15} ${eyeCY + 1}`}
          fill="none"
          stroke="#15243a"
          strokeWidth="5.5"
          strokeLinecap="round"
        />
        <path d={`M ${eyeCX + 15} ${eyeCY + 1} l 8 -3`} stroke="#15243a" strokeWidth="3.6" strokeLinecap="round" />
      </g>
    );
  } else if (pose === "reveal") {
    eye = (
      <g>
        <ellipse cx={eyeCX} cy={eyeCY} rx="15.5" ry="18.5" fill="#fff" stroke="#15243a" strokeWidth="3.6" />
        <clipPath id={`er${uid}`}>
          <ellipse cx={eyeCX} cy={eyeCY} rx="15.5" ry="18.5" />
        </clipPath>
        <g clipPath={`url(#er${uid})`}>
          <circle cx={eyeCX} cy={eyeCY + 4} r="13.5" fill={`url(#iris${uid})`} />
          <path
            d={`M ${eyeCX} ${eyeCY - 6} l 3.6 9 9.4 1.1 -7.4 6 2.6 9.2 -8.2 -5.3 -8.2 5.3 2.6 -9.2 -7.4 -6 9.4 -1.1 z`}
            fill="#fff"
            stroke="#bff0ff"
            strokeWidth="1"
            strokeLinejoin="round"
          />
        </g>
        <path
          d={`M ${eyeCX - 15} ${eyeCY - 11} Q ${eyeCX} ${eyeCY - 22} ${eyeCX + 16} ${eyeCY - 9}`}
          fill="none"
          stroke="#15243a"
          strokeWidth="5"
          strokeLinecap="round"
        />
      </g>
    );
  } else if (pose === "thinking") {
    eye = openEye(-3.5, -5);
  } else {
    eye = openEye(0, 0);
  }

  const happy = pose === "reveal" || pose === "proud" || pose === "idle";

  return (
    <svg
      viewBox="0 0 220 280"
      width={(size * 220) / 280}
      height={size}
      style={style}
      role="img"
      aria-label="Pip the seahorse"
    >
      <defs>
        <linearGradient id={`body${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={p.body} />
          <stop offset="1" stopColor={p.bodyDark} />
        </linearGradient>
        <linearGradient id={`fin${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={p.fin} />
          <stop offset="1" stopColor={p.finDark} />
        </linearGradient>
        <radialGradient id={`belly${uid}`} cx="0.5" cy="0.4" r="0.7">
          <stop offset="0" stopColor="#ffffff" stopOpacity=".95" />
          <stop offset="1" stopColor={p.belly} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`iris${uid}`} cx="0.5" cy="0.7" r="0.75">
          <stop offset="0" stopColor="#a8f0ff" />
          <stop offset=".45" stopColor="#46b0ff" />
          <stop offset="1" stopColor="#243f8f" />
        </radialGradient>
      </defs>

      {/* dorsal fin */}
      <path
        d="M168 120 q 38 -2 40 30 q -22 -6 -30 8 q 16 6 14 30 q -20 -10 -28 4 q 8 12 0 30 q -18 -14 -22 0 z"
        fill={`url(#fin${uid})`}
        opacity=".92"
        stroke={p.finDark}
        strokeWidth="2.5"
        strokeLinejoin="round"
        transform="rotate(8 168 150)"
      />
      {/* pectoral fin */}
      <path
        d="M168 104 q 30 -10 34 12 q -18 2 -20 16 q -14 -14 -14 -28 z"
        fill={`url(#fin${uid})`}
        stroke={p.finDark}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* body+tail outline */}
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
        stroke={`url(#body${uid})`}
        strokeWidth="44"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* belly ridges */}
      <g stroke={p.bodyDark} strokeWidth="3.5" strokeLinecap="round" opacity=".55">
        <line x1="120" y1="132" x2="146" y2="126" />
        <line x1="132" y1="152" x2="156" y2="148" />
        <line x1="140" y1="174" x2="160" y2="172" />
        <line x1="138" y1="196" x2="156" y2="200" />
      </g>
      {/* head */}
      <circle cx="120" cy="92" r="50" fill="#15243a" />
      <circle cx="120" cy="92" r="44" fill={`url(#body${uid})`} />
      <ellipse cx="106" cy="74" rx="22" ry="16" fill={`url(#belly${uid})`} opacity=".7" />
      <path d="M92 62 q 16 -14 34 -8 q -14 2 -20 12 q -9 -2 -14 -4 z" fill="#fff" opacity=".55" />
      {/* snout */}
      <g transform="rotate(-8 78 110)">
        <rect x="40" y="100" width="56" height="26" rx="13" fill="#15243a" />
        <rect x="42" y="102" width="50" height="22" rx="11" fill={`url(#body${uid})`} />
        {happy && <circle cx="50" cy="113" r="3.4" fill="#15243a" opacity=".5" />}
      </g>
      {/* coronet */}
      <g fill={p.coronet} stroke="#15243a" strokeWidth="3" strokeLinejoin="round">
        <path d="M96 50 l -8 -22 l 16 8 z" />
        <path d="M120 44 l 0 -26 l 12 16 z" />
        <path d="M142 52 l 12 -18 l 2 18 z" />
      </g>
      {/* blush */}
      {ex > 0 && <ellipse cx="120" cy="116" rx={8 * ex + 4} ry={6 * ex + 2.5} fill="#ff6f9f" opacity={0.6 * ex} />}

      {eye}

      {/* lock accessory */}
      {(pose === "sealing" || pose === "sealed") && (
        <g transform="translate(150 224)">
          <g style={{ filter: "drop-shadow(0 0 10px var(--seal-glow, #9aa6ff))" }}>
            <rect x="-17" y="-6" width="34" height="28" rx="7" fill="var(--seal, #7b8cff)" stroke="#15243a" strokeWidth="3" />
            <path d="M -9 -6 v -8 a 9 9 0 0 1 18 0 v 8" fill="none" stroke="#15243a" strokeWidth="4.5" />
            <circle cx="0" cy="6" r="3.6" fill="#15243a" />
          </g>
        </g>
      )}
      {/* reveal sparkles */}
      {pose === "reveal" && ex > 0 && (
        <g fill="var(--accent, #36e6d4)" stroke="#15243a" strokeWidth="1.4">
          <path d="M186 70 l 2.4 6 6.2 .8 -4.9 4 1.7 6.1 -5.4 -3.5 -5.4 3.5 1.7 -6.1 -4.9 -4 6.2 -.8 z" />
          <path d="M44 60 l 1.8 4.6 4.8.6 -3.8 3 1.3 4.7-4.1-2.7-4.1 2.7 1.3-4.7-3.8-3 4.8-.6z" opacity=".9" />
          <path d="M196 150 l 1.6 4 4.2.5-3.3 2.7 1.1 4.1-3.6-2.4-3.6 2.4 1.1-4.1-3.3-2.7 4.2-.5z" opacity=".8" />
        </g>
      )}
      {/* proud check */}
      {pose === "proud" && (
        <g transform="translate(150 222)">
          <circle cx="0" cy="0" r="17" fill="var(--good, #5ce6a8)" stroke="#15243a" strokeWidth="3" />
          <path
            d="M -7 1 l 5 5 9 -11"
            fill="none"
            stroke="#15243a"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      )}
      {/* thinking dots */}
      {pose === "thinking" && (
        <g fill="var(--text-dim, #8fb0d0)">
          <circle cx="176" cy="64" r="4" />
          <circle cx="190" cy="50" r="6" />
          <circle cx="206" cy="34" r="8" opacity=".8" />
        </g>
      )}
    </svg>
  );
}
