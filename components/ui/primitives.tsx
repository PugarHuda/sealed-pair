// Btn / Card / Badge / Mono / Field / Input / Segmented / CeremonyStep / Row
// Ported pixel-perfect from components.jsx + screens.jsx
"use client";
import {
  CSSProperties, InputHTMLAttributes, ReactNode, useRef, useState,
} from "react";
import Icon, { IconName } from "./icon";

/* ---------------- Buttons ---------------- */
export type BtnVariant = "primary" | "coral" | "seal" | "ghost" | "outline" | "quiet";
type BtnProps = {
  children?: ReactNode;
  variant?: BtnVariant;
  size?: "lg" | "md" | "sm";
  icon?: IconName;
  iconRight?: IconName;
  full?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
  type?: "button" | "submit" | "reset";
};
export function Btn({
  children, variant = "primary", size = "md", icon, iconRight, full, disabled, onClick, style, type = "button",
}: BtnProps) {
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    border: "1px solid transparent",
    borderRadius: "var(--r-md)",
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "transform .12s var(--ease-back), filter .15s, box-shadow .2s",
    width: full ? "100%" : "auto",
    whiteSpace: "nowrap",
    letterSpacing: ".01em",
    padding: size === "lg" ? "15px 26px" : size === "sm" ? "8px 14px" : "12px 20px",
    fontSize: size === "lg" ? 17 : size === "sm" ? 13.5 : 15,
    opacity: disabled ? 0.5 : 1,
  };
  const variants: Record<BtnVariant, CSSProperties> = {
    primary:  { background: "var(--accent)", color: "var(--accent-ink)", boxShadow: "0 10px 24px -10px var(--accent)" },
    coral:    { background: "var(--accent-2)", color: "var(--accent-2-ink)", boxShadow: "0 10px 24px -10px var(--accent-2)" },
    seal:     { background: "var(--seal)", color: "#fff", boxShadow: "0 10px 24px -10px var(--seal)" },
    ghost:    { background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" },
    outline:  { background: "transparent", color: "var(--text)", border: "1px solid var(--border)" },
    quiet:    { background: "transparent", color: "var(--text-dim)" },
  };
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <button
      ref={ref}
      type={type}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      onMouseDown={(e) => !disabled && (e.currentTarget.style.transform = "scale(.96)")}
      onMouseUp={(e) => (e.currentTarget.style.transform = "")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "")}
      style={{ ...base, ...variants[variant], ...style }}
    >
      {icon && <Icon name={icon} size={size === "sm" ? 16 : 18} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === "sm" ? 16 : 18} />}
    </button>
  );
}

/* ---------------- Card ---------------- */
export function Card({
  children, pad = 22, glow, hover, onClick, style,
}: {
  children: ReactNode;
  pad?: number;
  glow?: boolean;
  hover?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
}) {
  const [h, setH] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: pad,
        boxShadow: glow ? "var(--glow)" : "var(--card-shadow)",
        transition: "transform .18s var(--ease), border-color .18s, box-shadow .25s",
        cursor: onClick ? "pointer" : "default",
        transform: hover && h ? "translateY(-4px)" : "none",
        borderColor: hover && h ? "var(--accent)" : "var(--border)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ---------------- Badge ---------------- */
export type BadgeTone = "neutral" | "open" | "seal" | "locked" | "good" | "bad";
export function Badge({
  children, tone = "neutral", size = "md", icon, style,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  size?: "md" | "sm";
  icon?: IconName;
  style?: CSSProperties;
}) {
  const tones: Record<BadgeTone, [string, string]> = {
    neutral: ["color-mix(in oklab, var(--text-dim) 16%, transparent)", "var(--text-dim)"],
    open:    ["color-mix(in oklab, var(--accent) 18%, transparent)",   "var(--accent)"],
    seal:    ["color-mix(in oklab, var(--seal) 22%, transparent)",     "var(--seal-glow)"],
    locked:  ["color-mix(in oklab, var(--warn) 20%, transparent)",     "var(--warn)"],
    good:    ["color-mix(in oklab, var(--good) 20%, transparent)",     "var(--good)"],
    bad:     ["color-mix(in oklab, var(--bad) 20%, transparent)",      "var(--bad)"],
  };
  const [bg, fg] = tones[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: bg,
        color: fg,
        borderRadius: 99,
        padding: size === "sm" ? "3px 9px" : "5px 12px",
        fontSize: size === "sm" ? 11.5 : 12.5,
        fontWeight: 700,
        fontFamily: "var(--font-body)",
        letterSpacing: ".03em",
        textTransform: "uppercase",
        ...style,
      }}
    >
      {icon && <Icon name={icon} size={size === "sm" ? 12 : 13} sw={2.4} />}
      {children}
    </span>
  );
}

/* ---------------- Mono pill (copyable) ---------------- */
export function Mono({
  children, label, copyable, style,
}: {
  children: ReactNode;
  label?: string;
  copyable?: boolean;
  style?: CSSProperties;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <span
      onClick={
        copyable
          ? () => {
              navigator.clipboard?.writeText(String(children)).catch(() => {});
              setCopied(true);
              setTimeout(() => setCopied(false), 1100);
            }
          : undefined
      }
      title={copyable ? "Copy" : undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        fontFamily: "var(--font-mono)",
        fontSize: 12.5,
        color: "var(--text-dim)",
        background: "var(--deep)",
        border: "1px solid var(--border-soft)",
        borderRadius: 8,
        padding: "4px 9px",
        cursor: copyable ? "pointer" : "default",
        ...style,
      }}
    >
      {label && (
        <span style={{ color: "var(--text-faint)", fontFamily: "var(--font-body)", fontWeight: 600 }}>
          {label}
        </span>
      )}
      {children}
      {copyable && (
        <Icon name={copied ? "check" : "copy"} size={13} style={{ color: copied ? "var(--good)" : "var(--text-faint)" }} />
      )}
    </span>
  );
}

/* ---------------- Form field ---------------- */
export function Field({
  label, hint, children, right,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-dim)" }}>{label}</span>
        {right}
      </div>
      {children}
      {hint && <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 6 }}>{hint}</div>}
    </label>
  );
}

export const inputStyle: CSSProperties = {
  width: "100%",
  background: "var(--deep)",
  border: "1px solid var(--border)",
  color: "var(--text)",
  borderRadius: "var(--r-sm)",
  padding: "13px 15px",
  fontSize: 16,
  fontFamily: "var(--font-body)",
  outline: "none",
};

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{ ...inputStyle, ...(props.style as CSSProperties) }}
      onFocus={(e) => {
        e.target.style.borderColor = "var(--accent)";
        e.target.style.boxShadow = "0 0 0 3px color-mix(in oklab,var(--accent) 22%,transparent)";
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        e.target.style.borderColor = "var(--border)";
        e.target.style.boxShadow = "none";
        props.onBlur?.(e);
      }}
    />
  );
}

/* ---------------- Segmented ---------------- */
type SegOpt = { value: string; label: string; icon?: IconName } | string;
export function Segmented({
  value, options, onChange, full,
}: {
  value: string;
  options: SegOpt[];
  onChange: (v: string) => void;
  full?: boolean;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        background: "var(--deep)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-sm)",
        padding: 4,
        gap: 4,
        width: full ? "100%" : "auto",
      }}
    >
      {options.map((o) => {
        const v = typeof o === "string" ? o : o.value;
        const lab = typeof o === "string" ? o : o.label;
        const ic = typeof o === "string" ? undefined : o.icon;
        const on = v === value;
        return (
          <button
            key={v}
            onClick={() => onChange(v)}
            style={{
              flex: full ? 1 : "initial",
              border: "none",
              borderRadius: 8,
              padding: "9px 16px",
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              background: on ? "var(--accent)" : "transparent",
              color: on ? "var(--accent-ink)" : "var(--text-dim)",
              transition: "all .15s",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
            }}
          >
            {ic && <Icon name={ic} size={15} />}
            {lab}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- CeremonyStep ---------------- */
export function CeremonyStep({
  state, label, detail, icon,
}: {
  state: "pending" | "active" | "done";
  label: ReactNode;
  detail?: ReactNode;
  icon?: IconName;
}) {
  const c = state === "done" ? "var(--good)" : state === "active" ? "var(--accent)" : "var(--text-faint)";
  return (
    <div
      style={{
        display: "flex",
        gap: 14,
        alignItems: "flex-start",
        opacity: state === "pending" ? 0.45 : 1,
        transition: "opacity .3s",
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          flex: "0 0 auto",
          display: "grid",
          placeItems: "center",
          background:
            state === "pending"
              ? "var(--surface-2)"
              : `color-mix(in oklab, ${c} 18%, transparent)`,
          color: c,
          border: `1px solid ${state === "pending" ? "var(--border)" : c}`,
          animation: state === "active" ? "pulseGlow 1.4s infinite" : "none",
        }}
      >
        {state === "done" ? (
          <Icon name="check" size={18} sw={2.6} />
        ) : state === "active" ? (
          <span
            className="spin"
            style={{
              width: 15,
              height: 15,
              border: "2.5px solid currentColor",
              borderTopColor: "transparent",
              borderRadius: "50%",
              display: "block",
            }}
          />
        ) : icon ? (
          <Icon name={icon} size={17} />
        ) : null}
      </div>
      <div style={{ paddingTop: 2, minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14.5, color: state === "pending" ? "var(--text-faint)" : "var(--text)" }}>
          {label}
        </div>
        {detail && state !== "pending" && (
          <div
            className="mono"
            style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 3, wordBreak: "break-all" }}
          >
            {detail}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Row (label/value flex) ---------------- */
export function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 13.5, color: "var(--text-dim)" }}>{label}</span>
      <span style={{ fontWeight: 700, fontSize: 14.5 }}>{children}</span>
    </div>
  );
}
