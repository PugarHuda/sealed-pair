"use client";
import type { Order } from "@/lib/types";
import { short } from "@/lib/data";
import { Badge, Btn, Card, Mono } from "@/components/ui/primitives";
import { Pair } from "@/components/ui/asset";
import Icon from "@/components/ui/icon";
import { MakerTag, Ghost } from "./shared";

export default function OrderCard({
  order, isMine, onOpen,
}: {
  order: Order;
  isMine: boolean;
  onOpen: (o: Order) => void;
}) {
  const stateBadge = {
    OPEN:     <Badge tone="open"   icon="lock">Sealed</Badge>,
    LOCKED:   <Badge tone="locked" icon="clock">Escrow funded</Badge>,
    REVEALED: <Badge tone="seal"   icon="unlock">Revealed</Badge>,
    SETTLED:  <Badge tone="good"   icon="check">Settled</Badge>,
    EXPIRED:  <Badge>Expired</Badge>,
    CANCELLED:<Badge>Cancelled</Badge>,
  }[order.state];
  const sideTone = order.side === "SELL" ? "var(--accent-2)" : "var(--accent)";

  return (
    <Card hover pad={0} onClick={() => onOpen(order)} style={{ overflow: "hidden", position: "relative" }}>
      {isMine && (
        <div
          style={{
            position: "absolute", top: 0, right: 0,
            background: "var(--accent)", color: "var(--accent-ink)",
            fontSize: 11, fontWeight: 800, padding: "4px 12px",
            borderBottomLeftRadius: 12, letterSpacing: ".04em", textTransform: "uppercase",
          }}
        >
          Your offer
        </div>
      )}
      <div style={{ padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <MakerTag maker={order.maker} />
        {!isMine && stateBadge}
      </div>
      <div style={{ padding: "4px 20px 18px", borderBottom: "1px solid var(--border-soft)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Pair give={order.give} get={order.get} size={34} />
          <span
            style={{
              fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 13,
              color: sideTone, border: `1.5px solid ${sideTone}`,
              borderRadius: 8, padding: "3px 10px",
            }}
          >
            {order.side}
          </span>
        </div>
      </div>
      <div style={{ padding: "16px 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div>
          <div style={{ fontSize: 11.5, color: "var(--text-faint)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>
            Size band · public
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 19 }}>
            {order.sizeBand} <span style={{ color: "var(--text-faint)", fontSize: 13, fontWeight: 600 }}>{order.give}</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11.5, color: "var(--text-faint)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
            <Icon name="lock" size={12} /> Terms · sealed
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-dim)" }}>
            <Ghost w={40} /> <span style={{ fontSize: 13 }}>@</span> <Ghost w={30} />
          </div>
        </div>
      </div>
      <div
        style={{
          padding: "14px 20px",
          borderTop: "1px solid var(--border-soft)",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
        }}
      >
        <Mono label="blobId" copyable style={{ maxWidth: "52%" }}>{short(order.blobId, 7, 5)}</Mono>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text-faint)", fontSize: 12.5 }}>
          <Icon name="clock" size={14} /> {order.expiresIn}
        </span>
      </div>
      <div style={{ padding: "0 20px 18px" }}>
        <Btn full variant={isMine ? "ghost" : "primary"} iconRight="chev">
          {isMine ? "Manage offer" : "Inspect & fund escrow"}
        </Btn>
      </div>
    </Card>
  );
}
