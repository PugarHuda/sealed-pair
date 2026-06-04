"use client";
// Brand-styled wallet connect/disconnect for Sealed Pair.
// Uses Mysten dApp Kit hooks + their <ConnectModal> for the wallet picker UX.

import { CSSProperties, useEffect, useRef, useState } from "react";
import {
  ConnectModal,
  useAutoConnectWallet,
  useCurrentAccount,
  useDisconnectWallet,
  useCurrentWallet,
} from "@mysten/dapp-kit";
import Icon from "@/components/ui/icon";
import { short } from "@/lib/data";
import { CoinBalance, fetchWalletBalances, SUI_NETWORK_FOR_EVENTS } from "@/lib/sui-orders";

const triggerStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "var(--accent)",
  color: "var(--accent-ink)",
  fontFamily: "var(--font-display)",
  fontWeight: 700,
  fontSize: 13.5,
  border: "none",
  borderRadius: 99,
  padding: "8px 14px",
  cursor: "pointer",
  whiteSpace: "nowrap",
  boxShadow: "0 8px 18px -10px var(--accent)",
  transition: "transform .12s var(--ease-back), filter .15s",
};

const connectedStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "var(--surface-2)",
  border: "1px solid var(--border)",
  borderRadius: 99,
  padding: "5px 4px 5px 12px",
  fontSize: 12.5,
  fontWeight: 700,
  color: "var(--text)",
  whiteSpace: "nowrap",
};

export default function ConnectButton() {
  const account = useCurrentAccount();
  const { currentWallet } = useCurrentWallet();
  const { mutate: disconnect } = useDisconnectWallet();
  // While dApp Kit's autoConnect is still trying to reattach a previously
  // approved wallet, account is null even though it'll likely be filled in
  // ~200-400ms later. Rendering "Connect wallet" during that window causes
  // a visible flash on every page load. We show a neutral pill instead.
  const autoConnect = useAutoConnectWallet();

  if (!account && autoConnect === "idle") {
    return (
      <div
        style={{
          ...connectedStyle,
          opacity: 0.55,
          background: "var(--surface-2)",
          color: "var(--text-faint)",
          padding: "5px 12px",
        }}
        aria-busy="true"
      >
        <span
          style={{
            width: 8, height: 8, borderRadius: "50%",
            background: "var(--text-faint)",
            opacity: 0.7,
          }}
        />
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>connecting…</span>
      </div>
    );
  }

  if (!account) {
    return (
      <ConnectModal
        trigger={
          <button style={triggerStyle} type="button">
            <Icon name="user" size={14} sw={2.4} /> Connect wallet
          </button>
        }
      />
    );
  }

  const walletName = currentWallet?.name || "wallet";

  return (
    <PortfolioMenu
      account={account}
      walletName={walletName}
      onDisconnect={() => disconnect()}
    />
  );
}

/** Connected-state pill with a click-to-open portfolio dropdown. Fetches
 *  real balances via suix_getAllBalances; refreshes when the menu opens. */
function PortfolioMenu({
  account, walletName, onDisconnect,
}: {
  account: { address: string };
  walletName: string;
  onDisconnect: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [balances, setBalances] = useState<CoinBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    fetchWalletBalances(account.address, SUI_NETWORK_FOR_EVENTS)
      .then((b) => { if (!cancelled) { setBalances(b); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, account.address]);

  // Click-outside close.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{ ...connectedStyle, cursor: "pointer" }}
      >
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--good)", boxShadow: "0 0 7px var(--good)" }} />
        <span title={`${walletName} · ${account.address}`} style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
          {short(account.address, 6, 4)}
        </span>
        <span style={{ color: "var(--text-faint)", fontSize: 14, marginLeft: 2, marginRight: 4, transform: open ? "rotate(180deg)" : "none", transition: "transform .15s", display: "inline-flex" }}>
          <Icon name="chev" size={12} sw={2.4} style={{ transform: "rotate(90deg)" }} />
        </span>
      </button>
      {open && (
        <div
          className="fade-up"
          style={{
            position: "absolute", top: "calc(100% + 8px)", right: 0,
            minWidth: 260,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            boxShadow: "0 20px 50px -20px #000",
            zIndex: 60,
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border-soft)" }}>
            <div style={{ fontSize: 11, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 700 }}>
              {walletName}
            </div>
            <div className="mono" style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4, wordBreak: "break-all" }}>
              {account.address}
            </div>
          </div>
          <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8, maxHeight: 280, overflowY: "auto" }}>
            <div style={{ fontSize: 11, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 700, marginBottom: 4 }}>
              Portfolio · {SUI_NETWORK_FOR_EVENTS}
            </div>
            {loading && (
              <div style={{ fontSize: 12, color: "var(--text-faint)" }}>Loading balances…</div>
            )}
            {!loading && balances.length === 0 && (
              <div style={{ fontSize: 12, color: "var(--text-faint)" }}>No coins held on this network.</div>
            )}
            {!loading && balances.map((b) => (
              <div
                key={b.coinType}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                  padding: "6px 0",
                  borderBottom: "1px solid var(--border-soft)",
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{b.symbol}</div>
                  <div style={{ fontSize: 10.5, color: "var(--text-faint)", fontFamily: "var(--font-mono)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={b.coinType}>
                    {b.coinType.startsWith("0x2::sui::") ? "native" : b.coinType.slice(0, 14) + "…" + b.coinType.slice(-8)}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{b.display}</div>
                  <div style={{ fontSize: 10.5, color: "var(--text-faint)" }}>{b.coinObjectCount} obj{b.coinObjectCount === 1 ? "" : "s"}</div>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => { setOpen(false); onDisconnect(); }}
            style={{
              width: "100%",
              padding: "10px 14px",
              background: "var(--deep)",
              border: "none",
              borderTop: "1px solid var(--border-soft)",
              color: "var(--bad)",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Disconnect wallet
          </button>
        </div>
      )}
    </div>
  );
}
