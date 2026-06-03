"use client";
// App shell + state machine, ported from main.jsx (Lagoon / top nav / decrypt / coral pip locked).
import { useCallback, useEffect, useState } from "react";
import type { Order } from "@/lib/types";
import {
  PERSONAS, SEED_ORDERS, SETTLED_SEED, makeOrder, digest,
} from "@/lib/data";
import Mascot from "@/components/mascot";
import Bubbles from "@/components/bubbles";
import Icon, { IconName } from "@/components/ui/icon";
import BoardScreen from "@/components/app/screens/board";
import CreateScreen, { CreateDraft } from "@/components/app/screens/create";
import DealScreen from "@/components/app/screens/deal";
import VaultScreen from "@/components/app/screens/vault";
import { SealCeremony, SettleCeremony } from "@/components/app/ceremonies";
import NetworkPill from "@/components/app/network-pill";
import { listOpenOrders, packageStatus, SUI_NETWORK_FOR_EVENTS } from "@/lib/sui-orders";
import ConnectButton from "@/components/wallet/connect-button";
import { useAutoConnectWallet, useCurrentAccount } from "@mysten/dapp-kit";

type Role = "marina" | "theo";
type View = "board" | "create" | "vault" | "deal";

const NAV: { id: View; label: string; icon: IconName }[] = [
  { id: "board",  label: "RFQ Board",   icon: "search" },
  { id: "create", label: "Seal a quote", icon: "lock" },
  { id: "vault",  label: "Vault",        icon: "shield" },
];

// Placeholder shown in the static HTML / pre-hydration paint. Replaces the
// previous behaviour of statically rendering seed orders, which created a
// visible "back to initial" flash on hard refresh.
function BoardSkeleton() {
  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 28px" }}>
      <div
        style={{
          width: 220, height: 14, borderRadius: 7,
          background: "var(--surface-3)",
          marginBottom: 14, opacity: 0.55,
        }}
      />
      <div
        style={{
          width: 360, height: 30, borderRadius: 8,
          background: "var(--surface-3)",
          marginBottom: 26, opacity: 0.55,
        }}
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: 20,
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            style={{
              height: 220,
              borderRadius: "var(--r-md)",
              background: "var(--surface)",
              border: "1px solid var(--border-soft)",
              opacity: 0.55,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function Logo({ onHome }: { onHome: () => void }) {
  // In-app click handler instead of <Link href="/"> — clicking the logo
  // inside /app should land back on the RFQ Board without nuking state.
  // Users wanting the marketing page can use the browser's back button.
  return (
    <button
      onClick={onHome}
      type="button"
      style={{ display: "flex", alignItems: "center", gap: 11, background: "none", border: "none", cursor: "pointer", padding: 0 }}
    >
      <div
        style={{
          width: 44, height: 44, borderRadius: 13,
          background: "color-mix(in oklab, var(--accent) 16%, var(--surface))",
          border: "1px solid var(--border)",
          display: "grid", placeItems: "center", overflow: "hidden", flex: "0 0 auto",
        }}
      >
        <div style={{ transform: "translateY(5px)" }}><Mascot pose="idle" size={38} /></div>
      </div>
      <div style={{ textAlign: "left" }}>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 19, lineHeight: 1, letterSpacing: "-.01em", whiteSpace: "nowrap" }}>
          Sealed Pair
        </div>
        <div style={{ fontSize: 10.5, color: "var(--text-faint)", fontFamily: "var(--font-mono)", marginTop: 3 }}>
          Sealed P2P OTC on Sui
        </div>
      </div>
    </button>
  );
}

function RoleToggle({ role, onChange }: { role: Role; onChange: (r: Role) => void }) {
  return (
    <div
      style={{
        display: "inline-flex",
        background: "var(--deep)",
        border: "1px solid var(--border)",
        borderRadius: 99,
        padding: 4,
        gap: 4,
      }}
    >
      {(["marina", "theo"] as Role[]).map((r) => {
        const p = PERSONAS[r];
        const on = r === role;
        return (
          <button
            key={r}
            onClick={() => onChange(r)}
            title={p.role}
            style={{
              display: "inline-flex", alignItems: "center", gap: 9,
              border: "none", borderRadius: 99,
              padding: "6px 14px 6px 6px",
              cursor: "pointer",
              background: on ? "var(--surface-3)" : "transparent",
              transition: "all .15s",
            }}
          >
            <span
              style={{
                width: 28, height: 28, borderRadius: "50%",
                background: p.avatar, color: "#06121f",
                display: "grid", placeItems: "center",
                fontWeight: 800, fontFamily: "var(--font-display)",
              }}
            >
              {p.name[0]}
            </span>
            <span style={{ textAlign: "left" }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: on ? "var(--text)" : "var(--text-dim)", lineHeight: 1 }}>
                {p.name}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 2 }}>{p.role}</div>
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Cache the last batch of live on-chain orders in localStorage so the board
// renders instantly on hard refresh instead of flashing the seed-only view
// while the first Tatum RPC call completes. Capped at 50 entries — the same
// page-size the poll asks for — so it can't grow unbounded.
const LIVE_CACHE_KEY = `sealedpair:live-orders:${SUI_NETWORK_FOR_EVENTS}`;

function readLiveCache(): Order[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LIVE_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Order[];
    return Array.isArray(parsed) ? parsed.slice(0, 50) : [];
  } catch {
    return [];
  }
}

function writeLiveCache(orders: Order[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LIVE_CACHE_KEY, JSON.stringify(orders.slice(0, 50)));
  } catch {
    // Quota or private-mode failure — caching is best-effort.
  }
}

export default function AppPage() {
  const [role, setRole] = useState<Role>("marina");
  const [view, setView] = useState<View>("board");
  // Seed with the demo set so the board never renders empty on first paint.
  // After mount we splice in any cached live orders synchronously so the
  // visible state matches what the user saw before the refresh.
  const [orders, setOrders] = useState<Order[]>(() => [SETTLED_SEED, ...SEED_ORDERS]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [sealDraft, setSealDraft] = useState<Order | null>(null);
  const [settleOrder, setSettleOrder] = useState<Order | null>(null);
  const [liveCount, setLiveCount] = useState<number | null>(null);
  // Until first client-side effect runs we deliberately keep wallet-dependent
  // chrome (persona toggle) hidden. That flips on after hydration so a brief
  // pre-hydration flash of the toggle doesn't appear and then vanish.
  const [hydrated, setHydrated] = useState(false);
  const account = useCurrentAccount();
  // While dApp Kit's autoConnect is in 'idle' we don't yet know whether the
  // user has a saved wallet. Treat that window as "wallet unknown" so we
  // don't flash the persona toggle before the wallet resolves.
  const autoConnect = useAutoConnectWallet();

  // Hydrate cached live orders on mount — runs once, syncs with seed state.
  useEffect(() => {
    setHydrated(true);
    const cached = readLiveCache();
    if (cached.length === 0) return;
    setOrders((prev) => {
      const seen = new Set(prev.map((o) => o.orderObj));
      const fresh = cached.filter((o) => !seen.has(o.orderObj));
      return fresh.length ? [...fresh, ...prev] : prev;
    });
  }, []);

  // Standalone refresh fn — used by the 30s poll AND fired manually right
  // after finishSeal so the user's brand-new on-chain order appears within
  // a few seconds instead of waiting up to half a minute.
  const refreshLiveOrders = useCallback(async () => {
    if (!packageStatus().configured) return;
    try {
      const live = await listOpenOrders({ network: SUI_NETWORK_FOR_EVENTS, limit: 50 });
      setLiveCount(live.length);
      // Persist immediately so the next page-load hydrates from this snapshot.
      writeLiveCache(live);
      setOrders((prev) => {
        const liveIds = new Set(live.map((o) => o.orderObj));
        // Remove any stale cached live order that the fresh fetch dropped
        // (e.g., it just got locked/settled and listOpenOrders filtered it out).
        // Keep demo seeds + the just-fetched live set.
        const keepers = prev.filter(
          (o) => !o.orderObj.startsWith("0x") || liveIds.has(o.orderObj),
        );
        const seen = new Set(keepers.map((o) => o.orderObj));
        const fresh = live.filter((o) => !seen.has(o.orderObj));
        return fresh.length ? [...fresh, ...keepers] : keepers;
      });
    } catch {
      // Network blip — keep what we had.
    }
  }, []);

  useEffect(() => {
    if (!packageStatus().configured) return;
    refreshLiveOrders();
    const t = setInterval(refreshLiveOrders, 30_000);
    return () => clearInterval(t);
  }, [refreshLiveOrders]);

  const active = orders.find((o) => o.id === activeId) || null;
  const settled = orders.filter((o) => o.state === "SETTLED");

  const isMineOf = (o: Order | null) => {
    if (!o) return false;
    if (typeof o.maker === "string") return o.maker === role;
    return o.maker.handle === PERSONAS[role]?.handle;
  };

  const updateOrder = (id: number, patch: Partial<Order>) =>
    setOrders((os) =>
      os.map((o) =>
        o.id === id
          ? {
              ...o,
              ...patch,
              escrow: patch.escrow ? { ...o.escrow, ...patch.escrow } : o.escrow,
            }
          : o,
      ),
    );

  const openDeal = (o: Order) => {
    setActiveId(o.id);
    setView("deal");
    window.scrollTo(0, 0);
  };

  const goNav = (id: View) => {
    setActiveId(null);
    setView(id);
    window.scrollTo(0, 0);
  };

  /* seal flow */
  const beginSeal = (draft: CreateDraft) => {
    const o = makeOrder({
      maker: draft.maker,
      side: draft.side,
      give: draft.give,
      get: draft.get,
      amount: draft.terms.amount,
      price: draft.terms.price,
      expiresIn: draft.expiry + " 00m",
      createdAgo: "just now",
    });
    o.terms.note = draft.terms.note;
    setSealDraft(o);
  };
  const finishSeal = (patch: { blobId: string; publisher?: string; txDigest?: string; escrowRequiredMist?: string }) => {
    if (sealDraft) {
      const sealed: Order = {
        ...sealDraft,
        blobId: patch.blobId,
        ...(patch.escrowRequiredMist ? { escrowRequiredMist: patch.escrowRequiredMist } : {}),
      };
      setOrders((os) => [sealed, ...os]);
    }
    setSealDraft(null);
    setView("board");
    window.scrollTo(0, 0);
    // Fire two short follow-up polls so the user's real on-chain order shows
    // up within a few seconds — events take ~1-3s to be indexable by the
    // gateway, and the regular 30s tick is too slow to feel responsive.
    if (patch.txDigest) {
      setTimeout(() => { void refreshLiveOrders(); }, 1500);
      setTimeout(() => { void refreshLiveOrders(); }, 5000);
    }
  };

  /* settle flow */
  const beginSettle = (o: Order) => setSettleOrder(o);
  const finishSettle = () => {
    if (settleOrder) {
      const o = settleOrder;
      updateOrder(o.id, {
        state: "SETTLED",
        revealed: true,
        settleDigest: digest(),
        settledAt: "Just now",
        taker: { name: PERSONAS[role].name, handle: PERSONAS[role].handle },
        escrow: {
          ...o.escrow,
          funded: true,
          by: PERSONAS[role].name,
          byAddr: PERSONAS[role].addr,
        },
      });
    }
    setSettleOrder(null);
    setView("vault");
    window.scrollTo(0, 0);
  };

  return (
    <div style={{ position: "relative", minHeight: "100vh", zIndex: 1 }}>
      <Bubbles />

      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          background: "color-mix(in oklab, var(--bg) 86%, transparent)",
          backdropFilter: "blur(14px)",
          borderBottom: "1px solid var(--border-soft)",
        }}
      >
        <div
          className="app-header-row"
          style={{ maxWidth: 1280, margin: "0 auto", padding: "14px 28px" }}
        >
          <Logo onHome={() => goNav("board")} />
          <nav style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {NAV.map((n) => {
              const on = view === n.id;
              return (
                <button
                  key={n.id}
                  onClick={() => goNav(n.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    border: "none", cursor: "pointer",
                    background: on ? "color-mix(in oklab, var(--accent) 15%, transparent)" : "transparent",
                    color: on ? "var(--accent)" : "var(--text-dim)",
                    fontFamily: "var(--font-display)",
                    fontWeight: 700, fontSize: 14.5,
                    padding: "10px 15px", borderRadius: "var(--r-sm)",
                    whiteSpace: "nowrap", transition: "all .15s",
                  }}
                >
                  <Icon name={n.icon} size={18} /> {n.label}
                </button>
              );
            })}
          </nav>
          <div className="app-header-trail">
            <NetworkPill />
            <ConnectButton />
            {/* Persona toggle is a pre-wallet demo artifact. Once a real
                wallet is connected, your identity comes from the address —
                showing the toggle is misleading. Gate on `hydrated` AND on
                autoConnect being settled, so we don't paint the toggle
                during the ~200-500ms while dApp Kit re-attaches a saved
                wallet (account is briefly null during that window). */}
            {hydrated && autoConnect !== "idle" && !account && (
              <RoleToggle role={role} onChange={setRole} />
            )}
          </div>
        </div>
      </header>

      {/* Main content renders only AFTER client hydration. Pre-hydration we
          paint a neutral skeleton so the static HTML never shows the seed-only
          board — that was the "back to initial" flash during refresh.
          Snapping from skeleton → real content reads as "loading complete",
          not "page regressed". */}
      <main
        className="app-main"
        style={{
          opacity: hydrated ? 1 : 0,
          transition: "opacity .12s ease-out",
        }}
      >
        {hydrated && view === "board" && <BoardScreen orders={orders} role={role} onOpen={openDeal} />}
        {hydrated && view === "create" && <CreateScreen role={role} onSeal={beginSeal} />}
        {hydrated && view === "vault" && <VaultScreen settled={settled} />}
        {hydrated && view === "deal" && active && (
          <DealScreen
            order={active}
            role={role}
            isMine={isMineOf(active)}
            revealStyle="decrypt"
            onSettle={beginSettle}
            onUpdate={updateOrder}
            onRoleSwitch={setRole}
            onBack={(to) => (to === "vault" ? goNav("vault") : goNav("board"))}
          />
        )}
        {!hydrated && <BoardSkeleton />}
      </main>

      {sealDraft && <SealCeremony order={sealDraft} onDone={finishSeal} onClose={() => setSealDraft(null)} />}
      {settleOrder && <SettleCeremony order={settleOrder} onDone={finishSettle} onClose={() => setSettleOrder(null)} />}
    </div>
  );
}
