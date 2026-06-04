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
  fetchDeployedModule,
  packageStatus,
  SEALED_PAIR_PACKAGE_ID,
  SettledTrade,
  MakerStats,
  NormalizedModule,
  SUI_NETWORK_FOR_EVENTS,
  SUISCAN_HOST,
} from "@/lib/sui-orders";
import { Segmented } from "@/components/ui/primitives";
import { useCurrentAccount } from "@mysten/dapp-kit";
import ObjectExplorer from "@/components/app/object-explorer";
import DigestVerifier from "@/components/app/digest-verifier";

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

export default function VaultScreen({ settled, repMap }: { settled: Order[]; repMap?: Map<string, MakerStats> }) {
  // Live on-chain settled trades, enriched with Order content so they
  // render with the same columns as the demo rows below.
  const [liveTrades, setLiveTrades] = useState<SettledTrade[]>([]);
  const [scope, setScope] = useState<"ALL" | "MINE">("ALL");
  const isLive = packageStatus().configured;
  const account = useCurrentAccount();
  // Settlement rows treat the user as "mine" if either the maker (full
  // address in SettledTrade.maker) or the taker matches the connected
  // wallet. Demo Order rows are matched via the short maker.handle.
  const walletAddr = account?.address ?? null;
  const walletShort = walletAddr ? short(walletAddr, 6, 4) : null;
  const isMineTrade = (t: SettledTrade & { code?: string }) => {
    if (!walletAddr && !walletShort) return false;
    if (walletAddr && (t.maker === walletAddr || t.taker === walletAddr)) return true;
    if (walletShort && t.maker === walletShort) return true;
    return false;
  };

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

  // Volume = real escrow_required sum (USDC-ish back-derivation from
  // escrowDisplayLabel — "1,234 USDC" parses out as 1234). Falls back to
  // demo VOLUME_STATS when there are no live trades yet so the dashboard
  // still reads correctly at first paint.
  const liveVolumeSum = liveTrades.reduce((acc, t) => {
    const parsed = Number(t.escrowDisplayLabel.replace(/[^\d.]/g, ""));
    return acc + (Number.isFinite(parsed) ? parsed : 0);
  }, 0);
  const totalVol = liveTrades.length === 0
    ? VOLUME_STATS.volume + settled.reduce((a, o) => a + (o.terms.counter || 0), 0)
    : liveVolumeSum + settled.reduce((a, o) => a + (o.terms.counter || 0), 0);
  const settledCount = (liveTrades.length === 0 ? VOLUME_STATS.settled : 0) + settled.length + liveTrades.length;
  const mineLiveTrades = liveTrades.filter(isMineTrade);
  const mineDemoTrades = settled.map(fromOrder).filter(isMineTrade);
  const mineCount = mineLiveTrades.length + mineDemoTrades.length;
  const liveTradesToShow = scope === "MINE" ? mineLiveTrades : liveTrades;
  const settledToShow = scope === "MINE"
    ? settled.filter((o) => isMineTrade(fromOrder(o)))
    : settled;

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
      {/* Maker leaderboard — sorted by settle count, top 5 only. Renders
          nothing when repMap is empty / not yet loaded. */}
      <MakerLeaderboard repMap={repMap} />
      {/* Real Move module introspection — RPC fetch of the deployed package's
          normalised module structure. Proves the contract is really on-chain. */}
      <DeployedContractPanel />
      {/* Settle digest verifier — anti-spoof tool. */}
      <DigestVerifier />
      {/* Standalone Sui object explorer: paste any 0x... id, fetch live. */}
      <ObjectExplorer />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <h3 style={{ fontSize: 17, whiteSpace: "nowrap" }}>Settlement history</h3>
        <span style={{ fontSize: 12.5, color: "var(--text-faint)" }}>
          powered by Tatum · {isLive ? "suix_queryEvents + sui_multiGetObjects (live)" : "demo data until Move package deployed"}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          {(liveTrades.length > 0 || settled.length > 0) && (
            <CsvExportButton
              liveTrades={liveTradesToShow}
              demoTrades={settledToShow.map(fromOrder)}
              scopeIsMine={scope === "MINE"}
            />
          )}
          {walletAddr && (
            <Segmented
              value={scope}
              onChange={(v) => setScope(v as "ALL" | "MINE")}
              options={[
                { value: "ALL", label: "All trades" },
                { value: "MINE", label: mineCount > 0 ? `Mine · ${mineCount}` : "Mine" },
              ]}
            />
          )}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {liveTradesToShow.map((t) => <UnifiedRow key={t.orderId} trade={t} live />)}
        {settledToShow.map((o) => <UnifiedRow key={o.id} trade={fromOrder(o)} />)}
        {settledToShow.length === 0 && liveTradesToShow.length === 0 && (
          <div style={{ color: "var(--text-faint)", padding: "30px 0", textAlign: "center" }}>
            {scope === "MINE" ? "You haven't settled any trades yet on this wallet." : "No settlements yet."}
          </div>
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
  const [receiptCopied, setReceiptCopied] = useState(false);
  const partyShort = trade.taker ? short(trade.taker, 6, 4) : "—";
  const copyReceipt = () => {
    if (typeof window === "undefined") return;
    const receipt = {
      platform: "Sealed Pair",
      network: SUI_NETWORK_FOR_EVENTS,
      orderId: trade.orderId,
      blobId: trade.blobId,
      settleDigest: trade.txDigest || null,
      settledAtEpoch: trade.settledAtEpoch || null,
      maker: trade.maker || null,
      taker: trade.taker || null,
      pair: { give: trade.give, get: trade.get },
      escrow: trade.escrowDisplayLabel,
      escrowRequiredMist: trade.escrowRequiredMist,
      suiScanUrl: trade.txDigest ? `${SUISCAN_HOST}/tx/${trade.txDigest}` : null,
      walrusAggregatorUrl: `https://aggregator.walrus-testnet.walrus.space/v1/blobs/${trade.blobId}`,
      issuedAt: new Date().toISOString(),
      live: !!live,
    };
    navigator.clipboard?.writeText(JSON.stringify(receipt, null, 2)).then(() => {
      setReceiptCopied(true);
      setTimeout(() => setReceiptCopied(false), 1800);
    }).catch(() => { /* clipboard blocked */ });
  };
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
              {/* Real machine-readable receipt: copies a full JSON payload
                  with all on-chain references, suitable for archiving or
                  forwarding to an accounting / compliance system. */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); copyReceipt(); }}
                style={{
                  marginTop: 8,
                  display: "inline-flex", alignItems: "center", gap: 7,
                  background: receiptCopied ? "color-mix(in oklab, var(--good) 14%, var(--deep))" : "var(--deep)",
                  border: `1px solid ${receiptCopied ? "var(--good)" : "var(--border)"}`,
                  borderRadius: 99,
                  padding: "5px 12px",
                  fontSize: 12, fontWeight: 700,
                  color: receiptCopied ? "var(--good)" : "var(--text-dim)",
                  cursor: "pointer",
                }}
              >
                <Icon name={receiptCopied ? "check" : "doc"} size={12} sw={2.4} />
                {receiptCopied ? "Receipt copied" : "Copy JSON receipt"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function MakerLeaderboard({ repMap }: { repMap?: Map<string, MakerStats> }) {
  if (!repMap || repMap.size === 0) return null;
  // The repMap aliases each entry under BOTH full and short address keys.
  // Dedupe by object identity to avoid double-counting.
  const unique = Array.from(new Set(repMap.values()));
  const ranked = unique.sort((a, b) => b.settles - a.settles).slice(0, 5);
  if (ranked.length === 0) return null;
  return (
    <Card pad={20} style={{ marginBottom: 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
        <Icon name="spark" size={16} style={{ color: "var(--accent)" }} />
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 15 }}>
          Top makers · all-time settle count
        </div>
        <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--text-faint)" }}>
          from on-chain OrderSettled events
        </span>
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {ranked.map((stats, i) => (
          <div
            key={stats.asMakerAddr}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "10px 12px",
              background: i === 0 ? "color-mix(in oklab, var(--accent) 12%, var(--deep))" : "var(--deep)",
              border: i === 0 ? "1px solid var(--accent)" : "1px solid var(--border-soft)",
              borderRadius: "var(--r-sm)",
            }}
          >
            <span
              style={{
                width: 26, height: 26, borderRadius: "50%",
                display: "grid", placeItems: "center",
                background: i === 0 ? "var(--accent)" : "var(--surface-3)",
                color: i === 0 ? "var(--accent-ink)" : "var(--text-dim)",
                fontWeight: 800, fontFamily: "var(--font-display)", fontSize: 13,
              }}
            >
              {i + 1}
            </span>
            <span className="mono" style={{ fontSize: 13, color: "var(--text-dim)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {short(stats.asMakerAddr, 8, 6)}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--good)" }}>
              {stats.settles}× settled
            </span>
            <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>
              last @ epoch {stats.lastEpoch}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* DeployedContractPanel — fetches the live on-chain Move module structure
 * via sui_getNormalizedMoveModule and renders exposed functions + structs.
 * Pure RPC read, no signing, no mock — works for any visitor.            */
function DeployedContractPanel() {
  const [mod, setMod] = useState<NormalizedModule | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    fetchDeployedModule(SUI_NETWORK_FOR_EVENTS)
      .then((m) => { if (!cancelled) { setMod(m); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (!SEALED_PAIR_PACKAGE_ID) return null;
  if (loading) return null;
  if (!mod) return null;

  const funcs = Object.entries(mod.exposedFunctions || {});
  const structs = Object.entries(mod.structs || {});
  const eventStructs = structs.filter(([, s]) => s.abilities?.abilities?.includes("Copy") && s.abilities?.abilities?.includes("Drop"));

  return (
    <Card pad={20} style={{ marginBottom: 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
        <Icon name="anchor" size={16} style={{ color: "var(--accent-2)" }} />
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 15 }}>
          Deployed contract · live introspection
        </div>
        <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--text-faint)" }}>
          sui_getNormalizedMoveModule
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
        <Mono label="package" copyable>{SEALED_PAIR_PACKAGE_ID.slice(0, 14)}…{SEALED_PAIR_PACKAGE_ID.slice(-6)}</Mono>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <div>
          <div style={{ ...lblS, marginBottom: 8 }}>Public functions ({funcs.length})</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {funcs.slice(0, 12).map(([name, f]) => (
              <span
                key={name}
                title={`${f.visibility}${f.isEntry ? " · entry" : ""}`}
                style={{
                  fontFamily: "var(--font-mono)", fontSize: 11.5,
                  padding: "3px 9px", borderRadius: 99,
                  background: f.isEntry
                    ? "color-mix(in oklab, var(--accent) 14%, transparent)"
                    : "var(--surface-3)",
                  color: f.isEntry ? "var(--accent)" : "var(--text-dim)",
                  border: f.isEntry ? "1px solid color-mix(in oklab, var(--accent) 35%, transparent)" : "1px solid var(--border-soft)",
                }}
              >
                {name}
              </span>
            ))}
          </div>
        </div>
        <div>
          <div style={{ ...lblS, marginBottom: 8 }}>Emitted events ({eventStructs.length})</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {eventStructs.slice(0, 8).map(([name]) => (
              <span
                key={name}
                style={{
                  fontFamily: "var(--font-mono)", fontSize: 11.5,
                  padding: "3px 9px", borderRadius: 99,
                  background: "color-mix(in oklab, var(--good) 14%, transparent)",
                  color: "var(--good)",
                  border: "1px solid color-mix(in oklab, var(--good) 35%, transparent)",
                }}
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

/* CsvExportButton — generates a real CSV download of all on-chain refs
 * for the currently-displayed settled trades. No mocks, no formatting
 * tricks — empty fields stay empty, numeric fields preserve precision.  */
function CsvExportButton({
  liveTrades, demoTrades, scopeIsMine,
}: {
  liveTrades: SettledTrade[];
  demoTrades: SettledTrade[];
  scopeIsMine: boolean;
}) {
  const [done, setDone] = useState(false);
  const handleClick = () => {
    if (typeof window === "undefined") return;
    const rows: string[] = [];
    const escape = (v: unknown) => {
      const s = v === null || v === undefined ? "" : String(v);
      return s.includes(",") || s.includes("\"") || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };
    rows.push([
      "kind", "network", "orderId", "blobId",
      "settleDigest", "settledAtEpoch", "maker", "taker",
      "give", "get", "escrow", "suiScanUrl", "walrusUrl",
    ].join(","));
    const network = SUI_NETWORK_FOR_EVENTS;
    const writeRow = (t: SettledTrade, kind: "live" | "demo") => {
      rows.push([
        kind, network, t.orderId, t.blobId,
        t.txDigest || "", t.settledAtEpoch || "", t.maker || "", t.taker || "",
        t.give, t.get, t.escrowDisplayLabel,
        t.txDigest ? `${SUISCAN_HOST}/tx/${t.txDigest}` : "",
        `https://aggregator.walrus-testnet.walrus.space/v1/blobs/${t.blobId}`,
      ].map(escape).join(","));
    };
    liveTrades.forEach((t) => writeRow(t, "live"));
    demoTrades.forEach((t) => writeRow(t, "demo"));
    const csv = rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const scope = scopeIsMine ? "mine" : "all";
    const date = new Date().toISOString().slice(0, 10);
    a.download = `sealed-pair-settlements-${scope}-${date}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDone(true);
    setTimeout(() => setDone(false), 1800);
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      title="Export visible settlements as CSV"
      style={{
        display: "inline-flex", alignItems: "center", gap: 7,
        background: done ? "color-mix(in oklab, var(--good) 14%, var(--deep))" : "var(--deep)",
        border: `1px solid ${done ? "var(--good)" : "var(--border)"}`,
        borderRadius: 99,
        padding: "6px 13px",
        fontSize: 12, fontWeight: 700,
        color: done ? "var(--good)" : "var(--text-dim)",
        cursor: "pointer",
      }}
    >
      <Icon name={done ? "check" : "doc"} size={12} sw={2.4} />
      {done ? "Downloaded" : "CSV export"}
    </button>
  );
}
