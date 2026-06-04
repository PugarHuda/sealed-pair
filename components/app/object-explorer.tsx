"use client";
// Standalone Sui object explorer. Paste any 0x... id, hits sui_getObject
// via our /api/sui proxy, renders the parsed content as syntax-highlighted
// JSON. Pure on-chain read, no signing.

import { useState } from "react";
import { Card, Btn } from "@/components/ui/primitives";
import Icon from "@/components/ui/icon";
import { SUI_NETWORK_FOR_EVENTS, SUISCAN_HOST } from "@/lib/sui-orders";

const ID_RE = /^0x[0-9a-fA-F]{64}$/;

export default function ObjectExplorer() {
  const [id, setId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown | null>(null);

  const inspect = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/sui", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: "sui_getObject",
          params: [id, { showContent: true, showType: true, showOwner: true }],
          network: SUI_NETWORK_FOR_EVENTS,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { result?: { data?: unknown; error?: { code: string } } };
      if (json.result?.error) {
        throw new Error(`Object not found: ${json.result.error.code}`);
      }
      if (!json.result?.data) {
        throw new Error("No data returned");
      }
      setResult(json.result.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setBusy(false);
    }
  };

  const idClean = id.trim();
  const valid = ID_RE.test(idClean);

  return (
    <Card pad={20} style={{ marginBottom: 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
        <Icon name="search" size={15} style={{ color: "var(--accent)" }} />
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 14 }}>
          Sui object explorer
        </div>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-faint)" }}>
          sui_getObject · {SUI_NETWORK_FOR_EVENTS}
        </span>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          value={id}
          onChange={(e) => setId(e.target.value)}
          placeholder="0x…"
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
        <Btn icon="bolt" onClick={inspect} disabled={!valid || busy}>
          {busy ? "Fetching…" : "Inspect"}
        </Btn>
      </div>
      {id && !valid && (
        <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 8 }}>
          Expects 0x + 64 hex characters (32-byte Sui object id).
        </div>
      )}
      {error && (
        <div
          style={{
            marginTop: 12,
            padding: "10px 12px",
            background: "color-mix(in oklab, var(--bad) 14%, transparent)",
            border: "1px solid var(--bad)",
            borderRadius: "var(--r-sm)",
            color: "var(--bad)",
            fontSize: 13, fontWeight: 600,
          }}
        >
          {error}
        </div>
      )}
      {result !== null && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 700 }}>
              Raw on-chain data
            </span>
            <a
              href={`${SUISCAN_HOST}/object/${idClean}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                marginLeft: "auto",
                fontSize: 11.5, color: "var(--accent)",
                display: "inline-flex", alignItems: "center", gap: 5,
                textDecoration: "none",
              }}
            >
              View on SuiScan <Icon name="ext" size={11} />
            </a>
          </div>
          <pre
            style={{
              margin: 0,
              padding: "12px 14px",
              background: "var(--deep)",
              border: "1px solid var(--border-soft)",
              borderRadius: "var(--r-sm)",
              maxHeight: 300, overflow: "auto",
              fontFamily: "var(--font-mono)",
              fontSize: 11.5,
              color: "var(--text-dim)",
              lineHeight: 1.5,
            }}
          >
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </Card>
  );
}
