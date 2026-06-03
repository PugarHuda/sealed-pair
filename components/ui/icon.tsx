// Stroke icon set — currentColor, ported from components.jsx
"use client";
import { CSSProperties, JSX } from "react";

export type IconName =
  | "lock" | "unlock" | "shield" | "check" | "plus" | "search" | "copy" | "clock"
  | "layers" | "drop" | "arrows" | "chev" | "eye" | "anchor" | "wave" | "bolt"
  | "doc" | "user" | "spark" | "ext" | "bell";

const Ic: Record<IconName, JSX.Element> = {
  lock:    <path d="M6 11V8a6 6 0 1 1 12 0v3M5 11h14v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z" />,
  unlock:  <path d="M6 11V8a6 6 0 0 1 11.6-2M5 11h14v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z" />,
  shield:  <path d="M12 3l8 3v6c0 4.5-3 7.6-8 9-5-1.4-8-4.5-8-9V6z" />,
  check:   <path d="M4 12.5l5 5 11-12" />,
  plus:    <path d="M12 5v14M5 12h14" />,
  search:  <g><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></g>,
  copy:    <g><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></g>,
  clock:   <g><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></g>,
  layers:  <g><path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/></g>,
  drop:    <path d="M12 3s7 7.5 7 12a7 7 0 0 1-14 0c0-4.5 7-12 7-12z" />,
  arrows:  <path d="M7 8h11l-3-3M17 16H6l3 3" />,
  chev:    <path d="M9 6l6 6-6 6" />,
  eye:     <g><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></g>,
  anchor:  <g><circle cx="12" cy="5" r="2.5"/><path d="M12 8v12M5 13a7 7 0 0 0 14 0M4 13h2M18 13h2"/></g>,
  wave:    <path d="M2 9c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2 2 2 4 2M2 15c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2 2 2 4 2" />,
  bolt:    <path d="M13 2L4 14h7l-2 8 9-12h-7z" />,
  doc:     <g><path d="M6 3h8l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5"/></g>,
  user:    <g><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></g>,
  spark:   <path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z" />,
  ext:     <g><path d="M14 5h5v5"/><path d="M19 5l-8 8"/><path d="M19 14v5H5V5h5"/></g>,
  bell:    <g><path d="M6 18h12l-1.5-2.4A4 4 0 0 1 16 13.5V10a4 4 0 0 0-8 0v3.5a4 4 0 0 1-.5 2.1z"/><path d="M10 21a2 2 0 0 0 4 0"/></g>,
};

export default function Icon({
  name, size = 20, sw = 1.9, style,
}: { name: IconName; size?: number; sw?: number; style?: CSSProperties }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      {Ic[name]}
    </svg>
  );
}
