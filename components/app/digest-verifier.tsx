"use client";
// Settle digest verifier — paste a tx digest, confirm it actually emitted
// an OrderSettled event from the deployed sealed_pair::order package.
// Real RPC verification, defends against spoofed digests in shared receipts.

import { useState } from "react";
import { Card, Btn } from "@/components/ui/primitives";
import Icon from "@/components/ui/icon";
import { SEALED_PAIR_PACKAGE_ID, SUI_NETWORK_FOR_EVENTS, SUISCAN_HOST } from "@/lib/sui-orders";

const DIGEST_RE = /^[1-9A-HJ-NP-Za-km-z]{43,44}$/;  // base58, 32 bytes

type VerifyResult =
  | { kind: "ok"; orderId: string; settledAtEpoch?: string }
  | { kind: "miss"; reason: string };

export default function DigestVerifier() {
  const [digest, setDigest] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);

  const verify = async () => {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/sui", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: "sui_getEvents",
          params: [digest.trim()],
          network: SUI_NETWORK_FOR_EVENTS,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { result?: Array<{ type: string; parsedJson?: { order_id?: string; settled_at_epoch?: string } }>; error?: { message: string } };
      if (json.error) {
        setResult({ kind: "miss", reason: `tx not found: ${json.error.message.slice(0, 80)}` });
        return;
      }
      const events = json.result ?? [];
      const settledType = `${SEALED_PAIR_PACKAGE_ID}::order::OrderSettled`;
      const match = events.find((e) => e.type === settledType);
      if (match) {
        setResult({
          kind: "ok",
          orderId: match.parsedJson?.order_id ?? "(missing)",
          settledAtEpoch: match.parsedJson?.settled_at_epoch,
        });
      } else if (events.length > 0) {
        const kinds = events.map((e) => e.type.split("::").pop()).join(", ");
        setResult({ kind: "miss", reason: `tx exists but emitted: ${kinds} — no OrderSettled` });
      } else {
        setResult({ kind: "miss", reason: "tx emitted no events from this package" });
      }
    } catch (e) {
      setResult({ kind: "miss", reason: e instanceof Error ? e.message : "lookup failed" });
    } finally {
      setBusy(false);
    }
  };

  const digestClean = digest.trim();
  const valid = DIGEST_RE.test(digestClean);

  return (
    <Card pad={20} style={{ marginBottom: 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
        <Icon name="shield" size={15} style={{ color: "var(--good)" }} />
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 14 }}>
          Settle digest verifier
        </div>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-faint)" }}>
          sui_getEvents · proves OrderSettled emitted
        </span>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          value={digest}
          onChange={(e) => setDigest(e.target.value)}
          placeholder="paste tx digest…"
          spellCheck={false}
          style={{
            flex: 1,
            background: "var(--deep)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-sm)",
            color: "var(--text)",
            fontFamily: "var(--font-mono)",
            fontSize: 12.5,
            padding: "9px 12px",
            outline: "none",
          }}
        />
        <Btn icon="check" onClick={verify} disabled={!valid || busy}>
          {busy ? "Verifying…" : "Verify"}
        </Btn>
      </div>
      {digest && !valid && (
        <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 8 }}>
          Expects a base58 transaction digest (43-44 chars).
        </div>
      )}
      {result && (
        <div
          style={{
            marginTop: 12,
            padding: "10px 12px",
            background: result.kind === "ok"
              ? "color-mix(in oklab, var(--good) 14%, transparent)"
              : "color-mix(in oklab, var(--bad) 14%, transparent)",
            border: `1px solid ${result.kind === "ok" ? "var(--good)" : "var(--bad)"}`,
            borderRadius: "var(--r-sm)",
            color: result.kind === "ok" ? "var(--good)" : "var(--bad)",
            fontSize: 12.5, fontWeight: 600,
          }}
        >
          {result.kind === "ok" ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <Icon name="check" size={13} sw={2.6} />
                <b>Verified</b> — real OrderSettled from this package.
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>
                order: {result.orderId.slice(0, 14)}…{result.orderId.slice(-6)}
                {result.settledAtEpoch && ` · settled at epoch ${result.settledAtEpoch}`}
              </div>
              <a
                href={`${SUISCAN_HOST}/tx/${digestClean}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--good)", fontSize: 11.5, textDecoration: "underline", marginTop: 4, display: "inline-block" }}
              >
                view on SuiScan ↗
              </a>
            </>
          ) : (
            <>
              <b>Not a settle from this package.</b> {result.reason}
            </>
          )}
        </div>
      )}
    </Card>
  );
}
