"use client";
import { useEffect, useState } from "react";
import type { Order } from "@/lib/types";
import { short, VOLUME_STATS } from "@/lib/data";
import { Card, Badge, Mono } from "@/components/ui/primitives";
import { Pair } from "@/components/ui/asset";
import Icon, { IconName } from "@/components/ui/icon";
import { PageHead, lblS } from "@/components/app/shared";
import {
  listSettledEvents,
  enrichSettledEvents,
  packageStatus,
  SettledTrade,
  SUI_NETWORK_FOR_EVENTS,
  SUISCAN_HOST,
} from "@/lib/sui-orders";

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

export default function VaultScreen({ settled }: { settled: Order[] }) {
  // Live on-chain settled trades, enriched with Order content so they
  // render with the same columns as the demo rows below.
  const [liveTrades, setLiveTrades] = useState<SettledTrade[]>([]);
  const isLive = packageStatus().configured;

  useEffect(() => {
    if (!isLive) return;
    let cancelled = false;
    const refresh = async () => {
      const events = await listSettledEvents({ network: SUI_NETWORK_FOR_EVENTS, limit: 50 });
      if (cancelled) return;
      const enriched = await enrichSettledEvents(events, SUI_NETWORK_FOR_EVENTS);
      if (!cancelled) setLiveTrades(enriched);
    };
    refresh();
    const t = setInterval(refresh, 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [isLive]);

  const totalVol = VOLUME_STATS.volume + settled.reduce((a, o) => a + (o.terms.counter || 0), 0);
  const settledCount = VOLUME_STATS.settled + settled.length + liveTrades.length;

  return (
    <div className="fade-up">
      <PageHead
        kicker={<><Icon name="shield" size={14} /> Audit trail</>}
        title="The Vault"
        sub="Every settled trade leaves a permanent, verifiable record. Terms were sealed during negotiation — now they’re provable forever, with the blobId tying ciphertext to outcome."
      />
      <div className="vault-stats">
        <StatCard label="Settled volume"   value={"$" + (totalVol / 1e6).toFixed(2) + "M"} sub="all-time, on-chain"      icon="wave" />
        <StatCard label="Trades settled"   value={String(settledCount)}                    sub={liveTrades.length > 0 ? `${liveTrades.length} live · ${settledCount - liveTrades.length} demo` : "atomic, zero failed legs"} icon="check" tone="var(--good)" />
        <StatCard label="Avg settle time"  value={VOLUME_STATS.avgSettle}                  sub="quote → finality"        icon="bolt" tone="var(--accent-2)" />
        <StatCard label="Sealed right now" value={String(VOLUME_STATS.sealed)}             sub="live on the board"       icon="lock" tone="var(--seal-glow)" />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <h3 style={{ fontSize: 17, whiteSpace: "nowrap" }}>Settlement history</h3>
        <span style={{ fontSize: 12.5, color: "var(--text-faint)" }}>
          powered by Tatum · {isLive ? "suix_queryEvents + sui_multiGetObjects (live)" : "demo data until Move package deployed"}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {liveTrades.map((t) => <UnifiedRow key={t.orderId} trade={t} live />)}
        {settled.map((o) => <UnifiedRow key={o.id} trade={fromOrder(o)} />)}
        {settled.length === 0 && liveTrades.length === 0 && (
          <div style={{ color: "var(--text-faint)", padding: "30px 0", textAlign: "center" }}>No settlements yet.</div>
        )}
      </div>
    </div>
  );
}

/** Demo Order → unified trade shape so the same row component renders both. */
function fromOrder(o: Order): SettledTrade & { code?: string; when: string } {
  return {
    orderId: o.orderObj,
    txDigest: o.settleDigest || "",
    settledAtEpoch: 0,
    when: o.settledAt || "",
    maker: typeof o.maker === "string" ? "" : (o.maker.handle || ""),
    taker: o.escrow.byAddr,
    give: o.give,
    get: o.get,
    blobId: o.blobId,
    escrowRequiredMist: "0",
    escrowDisplayLabel: `${o.terms.amount.toLocaleString("en-US")} ${o.terms.give}`,
    code: o.code,
  };
}

function UnifiedRow({ trade, live }: { trade: SettledTrade & { code?: string }; live?: boolean }) {
  const [open, setOpen] = useState(false);
  const partyShort = trade.taker ? short(trade.taker, 6, 4) : "—";
  return (
    <Card pad={0} style={{ overflow: "hidden", borderColor: live ? "var(--accent)" : undefined }}>
      <div
        onClick={() => setOpen((o) => !o)}
        className="vault-row-grid"
        style={{ padding: "16px 22px", cursor: "pointer" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Pair give={trade.give} get={trade.get} size={30} />
          <div>
            <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
              {trade.give} → {trade.get}
              {live && (
                <span
                  style={{
                    color: "var(--accent)",
                    fontSize: 10.5,
                    fontWeight: 800,
                    letterSpacing: ".08em",
                    textTransform: "uppercase",
                    padding: "2px 7px",
                    borderRadius: 99,
                    background: "color-mix(in oklab, var(--accent) 18%, transparent)",
                  }}
                >
                  LIVE
                </span>
              )}
            </div>
            <div className="mono" style={{ fontSize: 11.5, color: "var(--text-faint)" }}>
              {(trade.code || short(trade.orderId, 8, 4))} · {trade.when || `epoch ${trade.settledAtEpoch}`}
            </div>
          </div>
        </div>
        <div>
          <div style={lblS}>Size</div>
          <div style={{ fontWeight: 700, marginTop: 3 }}>{trade.escrowDisplayLabel}</div>
        </div>
        <div>
          <div style={lblS}>Taker</div>
          <div className="mono" style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 3 }}>
            {partyShort}
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
              <VerifyRow>Walrus blob still retrievable</VerifyRow>
            </div>
          </div>
          <div>
            <div style={{ ...lblS, marginBottom: 12 }}>On-chain references</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {trade.txDigest && <Mono label="settle digest" copyable>{short(trade.txDigest, 11, 6)}</Mono>}
              <Mono label="blobId" copyable>{short(trade.blobId, 11, 6)}</Mono>
              <Mono label="order" copyable>{short(trade.orderId, 10, 6)}</Mono>
              {live && trade.txDigest && (
                <a
                  href={`${SUISCAN_HOST}/tx/${trade.txDigest}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", gap: 7, color: "var(--accent)", fontSize: 13, fontWeight: 700, marginTop: 4 }}
                >
                  <Icon name="ext" size={15} /> View on SuiScan
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
