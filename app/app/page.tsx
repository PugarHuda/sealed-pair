"use client";
// App shell + state machine, ported from main.jsx (Lagoon / top nav / decrypt / coral pip locked).
import { useEffect, useState } from "react";
import Link from "next/link";
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

type Role = "marina" | "theo";
type View = "board" | "create" | "vault" | "deal";

const NAV: { id: View; label: string; icon: IconName }[] = [
  { id: "board",  label: "RFQ Board",   icon: "search" },
  { id: "create", label: "Seal a quote", icon: "lock" },
  { id: "vault",  label: "Vault",        icon: "shield" },
];

function Logo() {
  return (
    <Link href="/" style={{ display: "flex", alignItems: "center", gap: 11, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
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
    </Link>
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

export default function AppPage() {
  const [role, setRole] = useState<Role>("marina");
  const [view, setView] = useState<View>("board");
  const [orders, setOrders] = useState<Order[]>(() => [SETTLED_SEED, ...SEED_ORDERS]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [sealDraft, setSealDraft] = useState<Order | null>(null);
  const [settleOrder, setSettleOrder] = useState<Order | null>(null);
  const [liveCount, setLiveCount] = useState<number | null>(null);

  // Pull live OrderPosted events from the deployed Move package and merge them
  // into the board. No-op until NEXT_PUBLIC_SEALED_PAIR_PACKAGE_ID is set.
  useEffect(() => {
    if (!packageStatus().configured) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const live = await listOpenOrders({ network: SUI_NETWORK_FOR_EVENTS, limit: 50 });
        if (cancelled) return;
        setLiveCount(live.length);
        setOrders((prev) => {
          const seen = new Set(prev.map((o) => o.orderObj));
          const fresh = live.filter((o) => !seen.has(o.orderObj));
          return fresh.length ? [...fresh, ...prev] : prev;
        });
      } catch {
        // Network blip — keep what we had.
      }
    };
    refresh();
    const t = setInterval(refresh, 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

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
          <Logo />
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
            <NetworkPill network="mainnet" />
            <ConnectButton />
            <RoleToggle role={role} onChange={setRole} />
          </div>
        </div>
      </header>

      <main className="app-main">
        {view === "board" && <BoardScreen orders={orders} role={role} onOpen={openDeal} />}
        {view === "create" && <CreateScreen role={role} onSeal={beginSeal} />}
        {view === "vault" && <VaultScreen settled={settled} />}
        {view === "deal" && active && (
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
      </main>

      {sealDraft && <SealCeremony order={sealDraft} onDone={finishSeal} onClose={() => setSealDraft(null)} />}
      {settleOrder && <SettleCeremony order={settleOrder} onDone={finishSettle} onClose={() => setSettleOrder(null)} />}
    </div>
  );
}
