"use client";
// Walrus blob inspector — given a blobId, hits the Walrus aggregator
// (through our /api/walrus/blob proxy) and shows real bytes: total size,
// hex preview of first/last 32 bytes, and a direct aggregator URL.
//
// Useful for judges who want to verify "the blobId really points to data
// on Walrus testnet" without leaving the app.

import { useEffect, useState } from "react";
import { Btn, Card } from "@/components/ui/primitives";
import Icon from "@/components/ui/icon";

const AGGREGATOR_BASE = "https://aggregator.walrus-testnet.walrus.space/v1/blobs";

function hex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join(" ");
}

export default function BlobInspector({
  blobId, onClose,
}: {
  blobId: string;
  onClose: () => void;
}) {
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [latencyMs, setLatencyMs] = useState<number>(0);
  const [headers, setHeaders] = useState<{ contentType: string | null; servedBy: string | null }>({
    contentType: null, servedBy: null,
  });

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    const start = performance.now();
    (async () => {
      try {
        const res = await fetch(`/api/walrus/blob/${encodeURIComponent(blobId)}`, {
          cache: "force-cache",
          signal: ac.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = await res.arrayBuffer();
        if (cancelled) return;
        setBytes(new Uint8Array(buf));
        setLatencyMs(Math.round(performance.now() - start));
        setHeaders({
          contentType: res.headers.get("content-type"),
          servedBy: res.headers.get("x-walrus-aggregator") ?? res.headers.get("server"),
        });
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof Error && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "fetch failed");
        setLoading(false);
      }
    })();
    return () => { cancelled = true; ac.abort(); };
  }, [blobId]);

  const totalBytes = bytes?.byteLength ?? 0;
  const head = bytes ? bytes.slice(0, 32) : null;
  const tail = bytes && bytes.byteLength > 32 ? bytes.slice(-16) : null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 90,
        display: "grid", placeItems: "center", padding: 24,
        background: "color-mix(in oklab, var(--deep) 78%, transparent)",
        backdropFilter: "blur(8px)", animation: "popIn .25s ease",
      }}
    >
      <Card
        pad={0}
        style={{
          width: "min(96vw, 620px)",
          maxHeight: "88vh",
          overflow: "auto",
        }}
      >
        <div onClick={(e) => e.stopPropagation()}>
          <div style={{ padding: "22px 26px", borderBottom: "1px solid var(--border-soft)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
              <Icon name="layers" size={16} style={{ color: "var(--accent-2)" }} />
              <h2 style={{ fontSize: 18, margin: 0 }}>Walrus blob inspector</h2>
              <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--text-faint)" }}>
                live aggregator
              </span>
            </div>
            <div className="mono" style={{ fontSize: 12, color: "var(--text-dim)", wordBreak: "break-all" }}>
              {blobId}
            </div>
          </div>

          <div style={{ padding: "20px 26px", display: "flex", flexDirection: "column", gap: 16 }}>
            {loading && (
              <div style={{ color: "var(--text-faint)", fontSize: 13 }}>
                Fetching ciphertext from aggregator…
              </div>
            )}
            {error && (
              <div
                style={{
                  padding: "12px 14px",
                  background: "color-mix(in oklab, var(--bad) 14%, transparent)",
                  border: "1px solid var(--bad)",
                  borderRadius: "var(--r-sm)",
                  color: "var(--bad)",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                <b>Blob not retrievable.</b> {error}
              </div>
            )}
            {bytes && !error && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  <Stat label="Bytes" value={totalBytes.toLocaleString("en-US")} />
                  <Stat label="Fetch time" value={`${latencyMs} ms`} tone="var(--accent-2)" />
                  <Stat label="Status" value="Retrievable" tone="var(--good)" />
                </div>
                {(headers.contentType || headers.servedBy) && (
                  <div
                    style={{
                      padding: "10px 12px",
                      background: "var(--deep)",
                      border: "1px solid var(--border-soft)",
                      borderRadius: "var(--r-sm)",
                      display: "grid", gap: 6,
                      fontSize: 11.5,
                      fontFamily: "var(--font-mono)",
                      color: "var(--text-dim)",
                    }}
                  >
                    {headers.contentType && <div>content-type: {headers.contentType}</div>}
                    {headers.servedBy && <div>served-by: {headers.servedBy}</div>}
                    <div style={{ color: "var(--text-faint)" }}>
                      Walrus testnet · multi-aggregator failover (lib/walrus.ts)
                    </div>
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 700, marginBottom: 8 }}>
                    First 32 bytes (hex)
                  </div>
                  <pre
                    style={{
                      margin: 0,
                      padding: "12px 14px",
                      background: "var(--deep)",
                      border: "1px solid var(--border-soft)",
                      borderRadius: "var(--r-sm)",
                      fontSize: 11.5,
                      color: "var(--text-dim)",
                      fontFamily: "var(--font-mono)",
                      whiteSpace: "pre-wrap", wordBreak: "break-word",
                      lineHeight: 1.6,
                    }}
                  >
                    {head ? hex(head) : "(empty)"}
                  </pre>
                </div>
                {tail && (
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 700, marginBottom: 8 }}>
                      Last 16 bytes (hex)
                    </div>
                    <pre
                      style={{
                        margin: 0,
                        padding: "12px 14px",
                        background: "var(--deep)",
                        border: "1px solid var(--border-soft)",
                        borderRadius: "var(--r-sm)",
                        fontSize: 11.5,
                        color: "var(--text-dim)",
                        fontFamily: "var(--font-mono)",
                        whiteSpace: "pre-wrap", wordBreak: "break-word",
                        lineHeight: 1.6,
                      }}
                    >
                      {hex(tail)}
                    </pre>
                  </div>
                )}
                <div style={{ fontSize: 11.5, color: "var(--text-faint)", lineHeight: 1.5 }}>
                  Content-addressed: blobId is the BLAKE2b hash of these bytes.
                  Swap the ciphertext anywhere and the blobId changes — provably.
                </div>
              </>
            )}
          </div>

          <div style={{ padding: "14px 26px 22px", display: "flex", gap: 10, borderTop: "1px solid var(--border-soft)" }}>
            <a
              href={`${AGGREGATOR_BASE}/${blobId}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: 1,
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
                background: "var(--accent)",
                color: "var(--accent-ink)",
                border: "none",
                borderRadius: 99,
                padding: "10px 16px",
                fontSize: 13, fontWeight: 700,
                cursor: "pointer",
                textDecoration: "none",
              }}
            >
              <Icon name="ext" size={13} sw={2.4} /> Open on Walrus aggregator
            </a>
            <Btn variant="outline" onClick={onClose}>Close</Btn>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div
      style={{
        padding: "10px 12px",
        background: "var(--deep)",
        border: "1px solid var(--border-soft)",
        borderRadius: "var(--r-sm)",
      }}
    >
      <div style={{ fontSize: 10.5, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 700 }}>
        {label}
      </div>
      <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4, color: tone ?? "var(--text)" }}>
        {value}
      </div>
    </div>
  );
}
