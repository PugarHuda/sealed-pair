"use client";
import { useState } from "react";
import { PERSONAS } from "@/lib/data";
import type { Order } from "@/lib/types";
import { Segmented, inputStyle } from "@/components/ui/primitives";
import Icon from "@/components/ui/icon";
import { PageHead } from "@/components/app/shared";
import OrderCard from "@/components/app/order-card";

export default function BoardScreen({
  orders, role, onOpen,
}: {
  orders: Order[];
  role: "marina" | "theo";
  onOpen: (o: Order) => void;
}) {
  const [side, setSide] = useState("ALL");
  const [q, setQ] = useState("");
  const myHandle = PERSONAS[role]?.handle;
  const filtered = orders.filter((o) => {
    if (o.state === "SETTLED") return false;
    if (side !== "ALL" && o.side !== side) return false;
    if (q) {
      const mn = typeof o.maker === "string" ? PERSONAS[o.maker].name : o.maker.name;
      const hay = (o.give + o.get + o.code + mn).toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });

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
          </div>
        }
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
        {filtered.map((o) => {
          const isMine = typeof o.maker === "string" ? o.maker === role : o.maker.handle === myHandle;
          return <OrderCard key={o.id} order={o} isMine={isMine} onOpen={onOpen} />;
        })}
      </div>
      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-faint)" }}>
          No quotes match. Be the first — seal one.
        </div>
      )}
    </div>
  );
}
