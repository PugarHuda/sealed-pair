"use client";
// Network mismatch banner. dApp Kit's CurrentAccount exposes a `chains`
// array (e.g., ["sui:devnet"]) populated by the wallet. When that doesn't
// match the app's configured SUI_NETWORK_FOR_EVENTS, any PTB the user
// signs will go to a chain where the package isn't deployed — that's an
// avoidable failure if we surface it up front.

import { useCurrentAccount } from "@mysten/dapp-kit";
import { SUI_NETWORK_FOR_EVENTS } from "@/lib/sui-orders";
import Icon from "@/components/ui/icon";

export default function NetworkMismatchBanner() {
  const account = useCurrentAccount();
  if (!account) return null;
  const walletChain = account.chains?.[0];        // e.g. "sui:devnet"
  if (!walletChain) return null;
  const walletNet = walletChain.startsWith("sui:") ? walletChain.slice(4) : walletChain;
  if (walletNet === SUI_NETWORK_FOR_EVENTS) return null;
  return (
    <div
      className="fade-up"
      style={{
        maxWidth: 1280, margin: "12px auto 0",
        padding: "10px 18px",
        background: "color-mix(in oklab, var(--warn) 16%, transparent)",
        border: "1px solid var(--warn)",
        borderRadius: "var(--r-sm)",
        color: "var(--warn)",
        fontSize: 13, fontWeight: 600,
        display: "flex", alignItems: "center", gap: 10,
      }}
    >
      <Icon name="bolt" size={14} />
      <div>
        <b>Wallet on {walletNet}, but Sealed Pair is deployed on {SUI_NETWORK_FOR_EVENTS}.</b>
        {" "}Any transaction you sign will fail. Switch your wallet to <b>{SUI_NETWORK_FOR_EVENTS}</b> before funding.
      </div>
    </div>
  );
}
