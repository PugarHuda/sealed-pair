"use client";
import { useState } from "react";
import { PERSONAS, short } from "@/lib/data";
import type { Order } from "@/lib/types";
import type { MakerStats } from "@/lib/sui-orders";
import { Segmented, inputStyle } from "@/components/ui/primitives";
import Icon from "@/components/ui/icon";
import { PageHead } from "@/components/app/shared";
import OrderCard from "@/components/app/order-card";
import { useCurrentAccount } from "@mysten/dapp-kit";

export default function BoardScreen({
  orders, role, onOpen, repMap,
}: {
  orders: Order[];
  role: "marina" | "theo";
  onOpen: (o: Order) => void;
  repMap?: Map<string, MakerStats>;
}) {
  const [side, setSide] = useState("ALL");
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<"ALL" | "MINE">("ALL");
  const myHandle = PERSONAS[role]?.handle;
  const account = useCurrentAccount();
  // Wallet maker handles are stored as the shortened "0x…" form by
  // listOpenOrders (lib/sui-orders.ts::eventToOrder). Match the same shape
  // here so live on-chain orders posted by the connected wallet are tagged
  // "Your offer" on the board, even after a hard refresh wipes local state.
  const walletShort = account?.address ? short(account.address, 6, 4) : null;
  const isMineOrder = (o: Order) => {
    const personaMine = typeof o.maker === "string" ? o.maker === role : o.maker.handle === myHandle;
    const walletMine = walletShort != null && typeof o.maker !== "string" && o.maker.handle === walletShort;
    return personaMine || walletMine;
  };
  const walletAddrLower = account?.address?.toLowerCase() ?? null;
  const filtered = orders.filter((o) => {
    if (o.state === "SETTLED") return false;
    if (side !== "ALL" && o.side !== side) return false;
    if (scope === "MINE" && !isMineOrder(o)) return false;
    // Private/targeted orders: hide from non-target wallets. Maker still
    // sees their own private orders (isMineOrder catches that branch).
    if (o.targetTaker && !isMineOrder(o)) {
      if (!walletAddrLower || walletAddrLower !== o.targetTaker) return false;
    }
    if (q) {
      const mn = typeof o.maker === "string" ? PERSONAS[o.maker].name : o.maker.name;
      const hay = (o.give + o.get + o.code + mn).toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });
  const mineCount = orders.filter((o) => o.state !== "SETTLED" && isMineOrder(o)).length;

  return (
    <div className="fade-up">
      <PageHead
        kicker={
          <>
            <span
              style={{
                width: 8, height: 8, borderRadius: "50%",
                background: "var(--good)", boxShadow: "0 0 8px var(--good)", display: "inline-block",
              }}
            />{" "}
            Live · Sui mainnet
          </>
        }
        title="RFQ Board"
        sub="Open quotes from across the desk. Size bands are public so takers can find a match — exact price and amount stay encrypted in Walrus until both sides commit to escrow."
        right={
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)" }}>
                <Icon name="search" size={17} />
              </span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search pair…"
                style={{ ...inputStyle, padding: "11px 14px 11px 38px", width: 180, fontSize: 14 }}
              />
            </div>
            <Segmented
              value={side}
              onChange={setSide}
              options={[{ value: "ALL", label: "All" }, { value: "SELL", label: "Sell" }, { value: "BUY", label: "Buy" }]}
            />
            {/* My-only filter — visible whenever there's at least one wallet-owned
                or persona-owned active order. Hidden otherwise to keep the
                header tight for visitors who haven't sealed anything yet. */}
            {(mineCount > 0 || walletShort) && (
              <Segmented
                value={scope}
                onChange={(v) => setScope(v as "ALL" | "MINE")}
                options={[
                  { value: "ALL", label: "Everyone" },
                  { value: "MINE", label: mineCount > 0 ? `Mine · ${mineCount}` : "Mine" },
                ]}
              />
            )}
          </div>
        }
      />
      {/* Matching opportunities: aggregate the currently-displayed orders
          (post-filters) into per-pair depth so makers see which pairs
          actually have counterparties active. Real on-chain data — no mock. */}
      <MatchingPanel orders={orders.filter((o) => o.state !== "SETTLED")} walletShort={walletShort} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
        {filtered.map((o) => {
          // Look up reputation by maker.handle (short address form), which is
          // exactly the alias key fetchMakerReputation writes.
          const makerKey = typeof o.maker === "string" ? null : o.maker.handle;
          const rep = makerKey ? repMap?.get(makerKey) ?? null : null;
          return (
            <OrderCard
              key={o.id}
              order={o}
              isMine={isMineOrder(o)}
              onOpen={onOpen}
              rep={rep}
            />
          );
        })}
      </div>
      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-faint)" }}>
          {scope === "MINE"
            ? "You haven't posted an active offer yet. Try 'Seal a quote'."
            : "No quotes match. Be the first — seal one."}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Matching opportunities: per-pair depth + your-pair counterparties. */
/* Real aggregation of on-chain orders. No mock numbers — if no live  */
/* orders exist, this panel renders nothing.                          */
/* ------------------------------------------------------------------ */
function MatchingPanel({ orders, walletShort }: { orders: Order[]; walletShort: string | null }) {
  if (orders.length < 2) return null;
  type Key = string;
  const pairKey = (o: Order): Key => `${o.give}/${o.get}`;
  // Aggregate counts per pair (combining both sides into one row).
  const pairs = new Map<string, { give: string; get: string; sells: number; buys: number }>();
  for (const o of orders) {
    if (!o.orderObj.startsWith("0x")) continue; // ignore demo seeds
    const k = `${o.give}/${o.get}`;
    const cur = pairs.get(k) ?? { give: o.give, get: o.get, sells: 0, buys: 0 };
    if (o.side === "BUY") cur.buys += 1; else cur.sells += 1;
    pairs.set(k, cur);
  }
  // Pairs the user has at least one order in — these are "your active pairs".
  const myPairKeys = new Set(
    walletShort
      ? orders
          .filter((o) => typeof o.maker !== "string" && o.maker.handle === walletShort)
          .map(pairKey)
      : [],
  );
  const ranked = Array.from(pairs.entries())
    .sort((a, b) => (b[1].sells + b[1].buys) - (a[1].sells + a[1].buys))
    .slice(0, 4);
  if (ranked.length === 0) return null;

  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border-soft)",
      borderRadius: "var(--r-md)", padding: "16px 20px", marginBottom: 22,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
        <Icon name="layers" size={16} style={{ color: "var(--accent-2)" }} />
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 14 }}>
          Pair depth · matching opportunities
        </div>
        <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--text-faint)" }}>
          aggregated from live OrderPosted events
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
        {ranked.map(([k, p]) => {
          const total = p.sells + p.buys;
          const mine = myPairKeys.has(k);
          return (
            <div
              key={k}
              style={{
                padding: "10px 12px",
                background: mine ? "color-mix(in oklab, var(--accent) 12%, var(--deep))" : "var(--deep)",
                border: mine ? "1px solid var(--accent)" : "1px solid var(--border-soft)",
                borderRadius: "var(--r-sm)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 700 }}>
                {p.give} <span style={{ color: "var(--text-faint)" }}>→</span> {p.get}
                {mine && (
                  <span style={{ fontSize: 9.5, fontWeight: 800, color: "var(--accent)", letterSpacing: ".06em", marginLeft: "auto" }}>
                    YOURS
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 6, fontVariantNumeric: "tabular-nums" }}>
                {total} active · {p.sells} sell · {p.buys} buy
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
