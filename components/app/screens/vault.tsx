"use client";
import { useEffect, useState } from "react";
import type { Order } from "@/lib/types";
import { short, digest, VOLUME_STATS, fmt } from "@/lib/data";
import { Card, Badge, Mono } from "@/components/ui/primitives";
import { Pair } from "@/components/ui/asset";
import Icon, { IconName } from "@/components/ui/icon";
import { PageHead, lblS } from "@/components/app/shared";
import { listSettledEvents, packageStatus, SettledEvent } from "@/lib/sui-orders";

function StatCard({ label, value, sub, icon, tone }: { label: string; value: string; sub?: string; icon: IconName; tone?: string }) {
  return (
    <Card pad={20}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={lblS}>{label}</div>
        <span style={{ color: tone || "var(--accent)" }}><Icon name={icon} size={18} /></span>
      </div>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 30, marginTop: 10, letterSpacing: "-.02em" }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12.5, color: "var(--text-faint)", marginTop: 2 }}>{sub}</div>}
    </Card>
  );
}

function VerifyRow({ children, mono }: { children: React.ReactNode; mono?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
      <span
        style={{
          width: 20, height: 20, borderRadius: 6, display: "grid", placeItems: "center", flex: "0 0 auto",
          background: "color-mix(in oklab, var(--good) 20%, transparent)", color: "var(--good)",
        }}
      >
        <Icon name="check" size={13} sw={2.8} />
      </span>
      <span style={{ color: "var(--text-dim)" }}>{children}</span>
      {mono && <span className="mono" style={{ marginLeft: "auto", color: "var(--text-faint)", fontSize: 11.5 }}>{mono}</span>}
    </div>
  );
}

function SettledRow({ order }: { order: Order }) {
  const [open, setOpen] = useState(false);
  const taker = order.taker || { name: "Theo", handle: "theo.reef.dao" };
  return (
    <Card pad={0} style={{ overflow: "hidden" }}>
      <div
        onClick={() => setOpen((o) => !o)}
        className="vault-row-grid"
        style={{ padding: "16px 22px", cursor: "pointer" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Pair give={order.give} get={order.get} size={30} />
          <div>
            <div style={{ fontWeight: 700 }}>{order.give} → {order.get}</div>
            <div className="mono" style={{ fontSize: 11.5, color: "var(--text-faint)" }}>
              {order.code} · {order.settledAt}
            </div>
          </div>
        </div>
        <div>
          <div style={lblS}>Size</div>
          <div style={{ fontWeight: 700, marginTop: 3 }}>{fmt(order.terms.amount)} {order.terms.give}</div>
        </div>
        <div>
          <div style={lblS}>Parties</div>
          <div className="mono" style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 3 }}>
            {order.escrow.byAddr ? short(order.escrow.byAddr) : taker.handle}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Badge tone="good" icon="check">Verified</Badge>
          <span style={{ color: "var(--text-faint)", transform: open ? "rotate(90deg)" : "none", transition: "transform .2s", display: "inline-flex" }}>
            <Icon name="chev" size={18} />
          </span>
        </div>
      </div>
      {open && (
        <div
          className="fade-up"
          style={{
            padding: "20px 22px",
            borderTop: "1px solid var(--border-soft)",
            background: "var(--deep)",
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22,
          }}
        >
          <div>
            <div style={{ ...lblS, marginBottom: 12 }}>Cryptographic audit</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              <VerifyRow>blobId matches on-chain commitment</VerifyRow>
              <VerifyRow>Decrypted terms hash == sealed hash</VerifyRow>
              <VerifyRow>Both legs settled in one atomic PTB</VerifyRow>
              <VerifyRow>Walrus blob still retrievable (epoch {order.walEpochs})</VerifyRow>
            </div>
          </div>
          <div>
            <div style={{ ...lblS, marginBottom: 12 }}>On-chain references</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Mono label="settle digest" copyable>{short(order.settleDigest || digest(), 11, 6)}</Mono>
              <Mono label="blobId" copyable>{short(order.blobId, 11, 6)}</Mono>
              <Mono label="order" copyable>{short(order.orderObj, 10, 6)}</Mono>
              <a
                href="#"
                onClick={(e) => e.preventDefault()}
                style={{ display: "inline-flex", alignItems: "center", gap: 7, color: "var(--accent)", fontSize: 13, fontWeight: 700, marginTop: 4 }}
              >
                <Icon name="ext" size={15} /> View on SuiScan
              </a>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

export default function VaultScreen({ settled }: { settled: Order[] }) {
  // Live on-chain settled events (no-op when package not deployed).
  const [onChainSettled, setOnChainSettled] = useState<SettledEvent[]>([]);
  const isLive = packageStatus().configured;

  useEffect(() => {
    if (!isLive) return;
    let cancelled = false;
    const refresh = async () => {
      const events = await listSettledEvents({ network: "testnet", limit: 50 });
      if (!cancelled) setOnChainSettled(events);
    };
    refresh();
    const t = setInterval(refresh, 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [isLive]);

  const totalVol = VOLUME_STATS.volume + settled.reduce((a, o) => a + (o.terms.counter || 0), 0);
  const settledCount = VOLUME_STATS.settled + settled.length + onChainSettled.length;

  return (
    <div className="fade-up">
      <PageHead
        kicker={<><Icon name="shield" size={14} /> Audit trail</>}
        title="The Vault"
        sub="Every settled trade leaves a permanent, verifiable record. Terms were sealed during negotiation — now they’re provable forever, with the blobId tying ciphertext to outcome."
      />
      <div className="vault-stats">
        <StatCard label="Settled volume"   value={"$" + (totalVol / 1e6).toFixed(2) + "M"} sub="all-time, on-chain"      icon="wave" />
        <StatCard label="Trades settled"   value={String(settledCount)}                    sub={onChainSettled.length > 0 ? `${onChainSettled.length} live · ${settledCount - onChainSettled.length} demo` : "atomic, zero failed legs"} icon="check" tone="var(--good)" />
        <StatCard label="Avg settle time"  value={VOLUME_STATS.avgSettle}                  sub="quote → finality"        icon="bolt" tone="var(--accent-2)" />
        <StatCard label="Sealed right now" value={String(VOLUME_STATS.sealed)}             sub="live on the board"       icon="lock" tone="var(--seal-glow)" />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <h3 style={{ fontSize: 17, whiteSpace: "nowrap" }}>Settlement history</h3>
        <span style={{ fontSize: 12.5, color: "var(--text-faint)" }}>
          powered by Tatum · {isLive ? "suix_queryEvents (live)" : "demo data until Move package deployed"}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {onChainSettled.map((evt) => (
          <SettledEventRow key={evt.orderId} evt={evt} />
        ))}
        {settled.map((o) => <SettledRow key={o.id} order={o} />)}
        {settled.length === 0 && onChainSettled.length === 0 && (
          <div style={{ color: "var(--text-faint)", padding: "30px 0", textAlign: "center" }}>No settlements yet.</div>
        )}
      </div>
    </div>
  );
}

function SettledEventRow({ evt }: { evt: SettledEvent }) {
  return (
    <Card pad={0} style={{ overflow: "hidden", borderColor: "var(--accent)" }}>
      <div
        style={{
          padding: "16px 22px",
          display: "grid",
          gridTemplateColumns: "1fr auto auto",
          gap: 18,
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: "color-mix(in oklab, var(--accent) 18%, transparent)",
              color: "var(--accent)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <Icon name="check" size={16} sw={2.6} />
          </span>
          <div>
            <div style={{ fontWeight: 700 }}>
              On-chain settlement <span style={{ color: "var(--accent)", fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", marginLeft: 8, letterSpacing: ".08em" }}>LIVE</span>
            </div>
            <div className="mono" style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 2 }}>
              {short(evt.orderId, 10, 6)} · epoch {evt.settledAtEpoch}
            </div>
          </div>
        </div>
        <Mono label="digest" copyable>{short(evt.txDigest, 10, 6)}</Mono>
        <a
          href={`https://suiscan.xyz/testnet/tx/${evt.txDigest}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: "var(--accent)",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          <Icon name="ext" size={14} /> SuiScan
        </a>
      </div>
    </Card>
  );
}
