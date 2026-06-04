"use client";
import { useState } from "react";
import { PERSONAS, short } from "@/lib/data";
import type { Order } from "@/lib/types";
import type { MakerStats } from "@/lib/sui-orders";
import { Segmented, inputStyle } from "@/components/ui/primitives";
import Icon from "@/components/ui/icon";
import { PageHead } from "@/components/app/shared";
import OrderCard from "@/components/app/order-card";
import ActivityTicker from "@/components/app/activity-ticker";
import { useCurrentAccount } from "@mysten/dapp-kit";

export default function BoardScreen({
  orders, role, onOpen, repMap, onMakerProfile, initialPair, onRefresh,
}: {
  orders: Order[];
  role: "marina" | "theo";
  onOpen: (o: Order) => void;
  repMap?: Map<string, MakerStats>;
  onMakerProfile?: (addr: string) => void;
  /** Pre-applied pair filter from `/app?pair=SUI-USDC` deep-link. The Board
   *  shows only orders matching this pair until the user clears the chip. */
  initialPair?: string;
  /** Force-poll all live data on demand. Useful for demo + when the user
   *  expects fresh state right after a settle/cancel that wasn't theirs. */
  onRefresh?: () => Promise<void> | void;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try { await onRefresh(); } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  };
  const [side, setSide] = useState("ALL");
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<"ALL" | "MINE">("ALL");
  // Hyphen-separated "GIVE-GET" matches the URL convention used by
  // history.pushState below. Empty string = no pair filter.
  const [pairFilter, setPairFilter] = useState<string>(initialPair?.toUpperCase() ?? "");
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
    if (pairFilter && `${o.give}-${o.get}` !== pairFilter) return false;
    // Private/targeted orders: hide from non-target wallets. Maker still
    // sees their own private orders (isMineOrder catches that branch).
    if (o.targetTaker && !isMineOrder(o)) {
      if (!walletAddrLower || walletAddrLower !== o.targetTaker) return false;
    }
    if (q) {
      const mn = typeof o.maker === "string" ? PERSONAS[o.maker].name : o.maker.name;
      const handle = typeof o.maker === "string" ? "" : o.maker.handle;
      const addr = typeof o.maker === "string" ? "" : (o.maker as { addr?: string }).addr ?? "";
      // Match on pair / human name / code / handle / full address /
      // orderObj / blobId substrings so users can paste any reference.
      const hay = (
        o.give + o.get + o.code + mn + handle + addr + o.orderObj + o.blobId
      ).toLowerCase();
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
                placeholder="Search pair / addr / blobId…"
                style={{ ...inputStyle, padding: "11px 14px 11px 38px", width: 220, fontSize: 14 }}
              />
            </div>
            <Segmented
              value={side}
              onChange={setSide}
              options={[{ value: "ALL", label: "All" }, { value: "SELL", label: "Sell" }, { value: "BUY", label: "Buy" }]}
            />
            {onRefresh && (
              <button
                type="button"
                onClick={handleRefresh}
                title="Force-refresh live data"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  background: "var(--deep)",
                  border: "1px solid var(--border)",
                  borderRadius: 99,
                  color: refreshing ? "var(--accent)" : "var(--text-dim)",
                  padding: "8px 13px",
                  fontSize: 12.5, fontWeight: 700,
                  cursor: refreshing ? "default" : "pointer",
                  opacity: refreshing ? 0.7 : 1,
                  transition: "opacity .15s",
                }}
                disabled={refreshing}
              >
                <span
                  style={{
                    display: "inline-flex",
                    animation: refreshing ? "spin .6s linear infinite" : undefined,
                  }}
                >
                  <Icon name="bolt" size={13} sw={2.4} />
                </span>
                {refreshing ? "Refreshing…" : "Refresh"}
              </button>
            )}
            {/* My-only filter — render only when the user actually has at
                least one mine order, so wallets that haven't posted don't
                see a dead toggle that always shows the empty state. */}
            {mineCount > 0 && (
              <Segmented
                value={scope}
                onChange={(v) => setScope(v as "ALL" | "MINE")}
                options={[
                  { value: "ALL", label: "Everyone" },
                  { value: "MINE", label: `Mine · ${mineCount}` },
                ]}
              />
            )}
          </div>
        }
      />
      {pairFilter && (
        <div
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "6px 14px",
            background: "color-mix(in oklab, var(--accent) 14%, transparent)",
            border: "1px solid var(--accent)",
            borderRadius: 99,
            color: "var(--accent)",
            fontSize: 13, fontWeight: 700,
            marginBottom: 16,
          }}
        >
          Pair filter: {pairFilter.replace("-", " → ")}
          <button
            onClick={() => setPairFilter("")}
            style={{
              background: "transparent", border: "none", color: "var(--accent)",
              cursor: "pointer", fontSize: 15, lineHeight: 1, padding: "0 4px",
            }}
            aria-label="Clear pair filter"
          >
            ×
          </button>
        </div>
      )}
      {/* Live activity ticker — merges OrderPosted + OrderSettled events,
          sorted by timestamp. Real on-chain data via suix_queryEvents. */}
      <ActivityTicker />
      {/* Matching opportunities: aggregate the currently-displayed orders
          (post-filters) into per-pair depth so makers see which pairs
          actually have counterparties active. Clicking a pair sets the
          board filter so it doubles as a navigation surface. */}
      <MatchingPanel
        orders={orders.filter((o) => o.state !== "SETTLED")}
        walletShort={walletShort}
        onSelectPair={(pair) => setPairFilter(pair)}
      />
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
              onMakerProfile={onMakerProfile}
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
function MatchingPanel({ orders, walletShort, onSelectPair }: { orders: Order[]; walletShort: string | null; onSelectPair?: (pair: string) => void }) {
  if (orders.length < 2) return null;
  type Key = string;
  const pairKey = (o: Order): Key => `${o.give}/${o.get}`;
  // Aggregate counts per pair (combining both sides into one row).
  const pairs = new Map<string, { give: string; get: string; sells: number; buys: number; escrowSumMist: bigint }>();
  for (const o of orders) {
    // Count both live + seed orders so the depth view doesn't appear empty
    // before live data lands. Escrow sum still only adds live orders below
    // (seeds have no escrowRequiredMist).
    const k = `${o.give}/${o.get}`;
    const cur = pairs.get(k) ?? { give: o.give, get: o.get, sells: 0, buys: 0, escrowSumMist: 0n };
    if (o.side === "BUY") cur.buys += 1; else cur.sells += 1;
    // Real escrow sum from on-chain Order.escrow_required. Only SUI-side
    // escrows are summed here (the Move package locks escrow as a
    // Balance<SUI>); other pairs contribute 0 until escrow generics ship.
    if (o.escrowRequiredMist && /^\d+$/.test(o.escrowRequiredMist)) {
      try { cur.escrowSumMist += BigInt(o.escrowRequiredMist); } catch { /* ignore */ }
    }
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
          const pairKey = `${p.give}-${p.get}`;
          return (
            <button
              key={k}
              type="button"
              onClick={() => onSelectPair?.(pairKey)}
              title={`Filter board to ${p.give} → ${p.get}`}
              style={{
                padding: "10px 12px",
                background: mine ? "color-mix(in oklab, var(--accent) 12%, var(--deep))" : "var(--deep)",
                border: mine ? "1px solid var(--accent)" : "1px solid var(--border-soft)",
                borderRadius: "var(--r-sm)",
                cursor: onSelectPair ? "pointer" : "default",
                textAlign: "left",
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
              {p.escrowSumMist > 0n && (
                <div
                  style={{
                    fontSize: 11, color: "var(--text-faint)", marginTop: 4,
                    fontVariantNumeric: "tabular-nums",
                  }}
                  title="Sum of escrow_required across all OPEN orders in this pair"
                >
                  Escrow pooled: {(Number(p.escrowSumMist) / 1e9).toFixed(2)} SUI
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
