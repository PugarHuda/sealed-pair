"use client";
// Brand-styled wallet connect/disconnect for Sealed Pair.
// Uses Mysten dApp Kit hooks + their <ConnectModal> for the wallet picker UX.

import { CSSProperties } from "react";
import {
  ConnectModal,
  useAutoConnectWallet,
  useCurrentAccount,
  useDisconnectWallet,
  useCurrentWallet,
} from "@mysten/dapp-kit";
import Icon from "@/components/ui/icon";
import { short } from "@/lib/data";

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
    <div style={connectedStyle}>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: "var(--good)",
          boxShadow: "0 0 7px var(--good)",
        }}
      />
      <span
        title={`${walletName} · ${account.address}`}
        style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}
      >
        {short(account.address, 6, 4)}
      </span>
      <button
        onClick={() => disconnect()}
        title="Disconnect wallet"
        style={{
          border: "none",
          background: "transparent",
          color: "var(--text-faint)",
          cursor: "pointer",
          padding: "2px 8px",
          fontSize: 16,
          lineHeight: 1,
          marginLeft: 2,
        }}
        aria-label="Disconnect"
      >
        ×
      </button>
    </div>
  );
}
