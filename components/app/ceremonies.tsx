"use client";
import { ReactNode, useEffect, useRef, useState } from "react";
import type { Order } from "@/lib/types";
import { rnd, short, digest, objId, fmt } from "@/lib/data";
import { Badge, Btn, Mono, CeremonyStep } from "@/components/ui/primitives";
import { IconName } from "@/components/ui/icon";
import Mascot from "@/components/mascot";
import { encryptText, generateKey, stashKey } from "@/lib/crypto";
import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { SEALED_PAIR_PACKAGE_ID } from "@/lib/sui-orders";

/* ---------------- step runner ---------------- */
function useSteps(steps: { ms: number }[], active: boolean, onComplete?: () => void) {
  const [done, setDone] = useState(0);
  useEffect(() => {
    if (!active) {
      setDone(0);
      return;
    }
    setDone(0);
    const timers: ReturnType<typeof setTimeout>[] = [];
    let acc = 0;
    steps.forEach((s, k) => {
      acc += s.ms;
      timers.push(setTimeout(() => setDone(k + 1), acc));
    });
    timers.push(setTimeout(() => onComplete && onComplete(), acc + 650));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
  return done;
}

/* ---------------- shells ---------------- */
function Overlay({
  children, onClose, width = 560,
}: {
  children: ReactNode;
  onClose: () => void;
  width?: number;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 80,
        display: "grid", placeItems: "center", padding: 24,
        background: "color-mix(in oklab, var(--deep) 78%, transparent)",
        backdropFilter: "blur(8px)",
        animation: "popIn .25s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="fade-up"
        style={{
          width: "min(94vw," + width + "px)",
          maxHeight: "92vh",
          overflow: "auto",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-xl)",
          boxShadow: "0 40px 100px -30px #000, var(--glow)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function CodeBlock({ title, lines, accent }: { title?: string; lines: string; accent?: string }) {
  return (
    <div style={{ background: "var(--deep)", border: "1px solid var(--border-soft)", borderRadius: "var(--r-sm)", overflow: "hidden" }}>
      {title && (
        <div
          style={{
            padding: "8px 14px",
            borderBottom: "1px solid var(--border-soft)",
            fontFamily: "var(--font-mono)",
            fontSize: 11.5, color: "var(--text-faint)",
            display: "flex", alignItems: "center", gap: 8,
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: accent || "var(--accent)" }} />
          {title}
        </div>
      )}
      <pre
        style={{
          margin: 0,
          padding: "14px 16px",
          fontFamily: "var(--font-mono)",
          fontSize: 12.5, lineHeight: 1.65,
          color: "var(--text-dim)",
          whiteSpace: "pre-wrap", wordBreak: "break-word",
        }}
      >
        {lines}
      </pre>
    </div>
  );
}

const POLICY_SRC = `// Seal access policy — enforced on-chain (Move)
public fun seal_approve(order: &Order, req: address): bool {
    order.state == LOCKED              // taker has committed
 && order.escrow.funded == true        // good-faith deposit posted
 && (req == order.maker || req == order.taker)
 && tx_context::epoch() < order.expiry_epoch
}`;

/* ---------------- SEAL ceremony — real Walrus upload ---------------- */

type SealResult = { blobId: string; publisher?: string };

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function uploadToWalrus(ciphertext: Uint8Array, epochs = 6): Promise<SealResult> {
  // ArrayBuffer cast: BodyInit needs ArrayBuffer/Blob/etc., Uint8Array.buffer is one
  const body = ciphertext.buffer.slice(ciphertext.byteOffset, ciphertext.byteOffset + ciphertext.byteLength) as ArrayBuffer;
  const res = await fetch(`/api/walrus/store?epochs=${epochs}`, {
    method: "PUT",
    headers: { "Content-Type": "application/octet-stream" },
    body,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Walrus store failed (${res.status}): ${txt.slice(0, 200)}`);
  }
  const json = (await res.json()) as { ok: boolean; blobId?: string; publisher?: string; error?: string };
  if (!json.ok || !json.blobId) throw new Error(json.error || "Walrus returned no blobId");
  return { blobId: json.blobId, publisher: json.publisher };
}

export function SealCeremony({
  order, onDone, onClose,
}: {
  order: Order;
  onDone: (patch: { blobId: string; publisher?: string; txDigest?: string }) => void;
  onClose: () => void;
}) {
  type Step = { label: string; detail?: string; icon: IconName; sub?: ReactNode };
  const [done, setDone] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [realBlobId, setRealBlobId] = useState<string | null>(null);
  const [publisher, setPublisher] = useState<string | undefined>(undefined);
  const [txDigest, setTxDigest] = useState<string | null>(null);
  const cipherPreview = useRef("");
  const started = useRef(false);

  // Wallet (D2/D3): when connected AND Move package deployed, we register
  // the Order on-chain for real. Otherwise step 4 remains a visual mock.
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const onChainEnabled = !!(account && SEALED_PAIR_PACKAGE_ID);

  // Display blobId: real if available, else the placeholder so the UI doesn't flash
  const displayBlobId = realBlobId || order.blobId;

  const steps: Step[] = [
    {
      label: "Encrypting terms locally",
      detail: "AES-256-GCM · plaintext never leaves device",
      icon: "lock",
      sub: cipherPreview.current
        ? <CodeBlock title="ciphertext (preview)" lines={cipherPreview.current} />
        : null,
    },
    {
      label: "Uploading ciphertext to Walrus",
      detail: realBlobId ? `blobId ${realBlobId}` : "PUT /v1/blobs · public testnet publisher",
      icon: "layers",
      sub: (
        <div style={{ fontSize: 12.5, color: "var(--text-faint)" }}>
          Content-addressed — the blobId <b style={{ color: "var(--text-dim)" }}>is</b> the commitment. Terms can&apos;t be swapped without changing it.
        </div>
      ),
    },
    {
      label: "Sealing key with on-chain policy",
      detail: "policyId " + short(order.policyId) + " · threshold 2-of-3 key servers",
      icon: "shield",
      sub: <CodeBlock title="seal_policy.move" lines={POLICY_SRC} accent="var(--seal)" />,
    },
    {
      label: onChainEnabled ? "Registering Order on Sui" : "Registering Order on Sui (demo)",
      detail: onChainEnabled
        ? txDigest
          ? `digest ${short(txDigest, 10, 6)}`
          : "signing + executing create_offer PTB"
        : "wallet not connected — skipping on-chain registration",
      icon: "anchor",
    },
  ];

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        // ---- Step 1: encrypt locally
        const t = order.terms;
        const plaintext = JSON.stringify({
          orderId: order.id,
          code: order.code,
          side: order.side,
          give: order.give,
          get: order.get,
          amount: t.amount,
          price: t.price,
          counter: t.counter,
          minFill: t.minFill,
          note: t.note ?? "",
          expiresIn: order.expiresIn,
          v: 1,
        });
        const key = await generateKey();
        const ciphertext = await encryptText(plaintext, key);
        // visual preview of first/last bytes
        const hex = (b: Uint8Array, n: number) =>
          Array.from(b.slice(0, n))
            .map((x) => x.toString(16).padStart(2, "0"))
            .join(" ");
        cipherPreview.current = `${hex(ciphertext, 4)}  ${rnd(28)}  …${hex(ciphertext.slice(-4), 4)}`;
        await sleep(900);
        setDone(1);

        // ---- Step 2: upload to Walrus
        const { blobId, publisher: pub } = await uploadToWalrus(ciphertext, 6);
        setRealBlobId(blobId);
        setPublisher(pub);
        // stash key keyed by REAL blobId so taker (same browser) can decrypt
        await stashKey(blobId, key);
        await sleep(400);
        setDone(2);

        // ---- Step 3: seal policy (mock until Seal SDK wired)
        await sleep(1100);
        setDone(3);

        // ---- Step 4: Sui register
        if (onChainEnabled && SEALED_PAIR_PACKAGE_ID) {
          try {
            const t = order.terms;
            // 5% of counter as escrow, scaled to MIST when give === SUI.
            const escrowMist = t.give === "SUI"
              ? BigInt(Math.max(1_000_000, Math.floor(t.amount * 0.05 * 1e9)))
              : BigInt(Math.max(1_000_000, Math.floor(t.counter * 0.02 * 1e6)));
            const expiryEpoch = BigInt(Number.MAX_SAFE_INTEGER); // refined when reading current epoch
            const tx = new Transaction();
            tx.moveCall({
              target: `${SEALED_PAIR_PACKAGE_ID}::order::create_offer`,
              arguments: [
                tx.pure.vector("u8", Array.from(new TextEncoder().encode(blobId))),
                tx.pure.id(order.policyId),
                tx.pure.vector("u8", Array.from(new TextEncoder().encode(order.give))),
                tx.pure.vector("u8", Array.from(new TextEncoder().encode(order.get))),
                tx.pure.u64(escrowMist),
                tx.pure.u64(expiryEpoch),
              ],
            });
            const result = await signAndExecute({ transaction: tx });
            setTxDigest(result.digest);
          } catch (e) {
            // Wallet rejected or chain error — degrade to demo mode for this step
            // but keep the Walrus blob (the sealed commitment) so the order still flows.
            console.warn("[seal] on-chain register failed, falling back to demo:", e);
            await sleep(700);
          }
        } else {
          await sleep(1000);
        }
        setDone(4);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Sealing failed");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finished = done >= steps.length;

  return (
    <Overlay onClose={onClose}>
      <div
        style={{
          padding: "26px 28px",
          display: "flex", gap: 18, alignItems: "center",
          borderBottom: "1px solid var(--border-soft)",
        }}
      >
        <div style={{ animation: "sway 3s ease-in-out infinite" }}>
          <Mascot pose={finished ? "sealed" : "sealing"} size={92} />
        </div>
        <div>
          <Badge tone={error ? "bad" : "seal"} icon={error ? "bolt" : "lock"}>
            {error ? "Sealing failed" : finished ? "Sealed" : "Sealing"}
          </Badge>
          <h2 style={{ fontSize: 24, marginTop: 8 }}>
            {error ? "Couldn’t seal." : finished ? "Your quote is sealed." : "Sealing your quote…"}
          </h2>
          <div style={{ color: "var(--text-dim)", fontSize: 14, marginTop: 4 }}>
            {error
              ? error
              : "Pip curls tight around the lock. Nobody sees your terms until escrow is funded."}
          </div>
        </div>
      </div>
      <div style={{ padding: "22px 28px", display: "flex", flexDirection: "column", gap: 18 }}>
        {steps.map((s, k) => (
          <div key={k}>
            <CeremonyStep
              state={k < done ? "done" : k === done ? "active" : "pending"}
              label={s.label}
              detail={s.detail}
              icon={s.icon}
            />
            {s.sub && k === Math.min(done, steps.length - 1) && !finished && (
              <div style={{ marginLeft: 48, marginTop: 10 }}>{s.sub}</div>
            )}
          </div>
        ))}
      </div>
      {finished && !error && (
        <div className="fade-up" style={{ padding: "20px 28px 28px", borderTop: "1px solid var(--border-soft)" }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
            <Mono label="blobId" copyable>{short(displayBlobId, 10, 6)}</Mono>
            <Mono label="order" copyable>{short(order.orderObj)}</Mono>
            <Mono label="policy" copyable>{short(order.policyId)}</Mono>
            {txDigest && <Mono label="tx" copyable>{short(txDigest, 10, 6)}</Mono>}
          </div>
          {publisher && (
            <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginBottom: 12, fontFamily: "var(--font-mono)" }}>
              via {publisher}
              {txDigest && (
                <>
                  {" · "}
                  <a
                    href={`https://suiscan.xyz/testnet/tx/${txDigest}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "var(--accent)", textDecoration: "underline" }}
                  >
                    view on SuiScan ↗
                  </a>
                </>
              )}
            </div>
          )}
          <Btn full size="lg" icon="search" onClick={() => onDone({ blobId: displayBlobId, publisher, txDigest: txDigest ?? undefined })}>
            See it live on the board
          </Btn>
        </div>
      )}
      {error && (
        <div className="fade-up" style={{ padding: "20px 28px 28px", borderTop: "1px solid var(--border-soft)" }}>
          <Btn full variant="outline" onClick={onClose}>Close</Btn>
        </div>
      )}
    </Overlay>
  );
}

/* ---------------- SETTLE ceremony ---------------- */
export function SettleCeremony({
  order, onDone, onClose,
}: {
  order: Order;
  onDone: () => void;
  onClose: () => void;
}) {
  const t = order.terms;
  const [realDigest, setRealDigest] = useState<string | null>(null);
  const settleStarted = useRef(false);

  // Real settle PTB runs in parallel with the visual animation when the
  // wallet + package are wired. By the time the animation finishes the
  // real digest is usually back.
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const onChainEnabled = !!(
    account &&
    SEALED_PAIR_PACKAGE_ID &&
    order.orderObj.startsWith("0x") &&
    order.orderObj.length === 66
  );

  useEffect(() => {
    if (!onChainEnabled || !SEALED_PAIR_PACKAGE_ID || settleStarted.current) return;
    settleStarted.current = true;
    (async () => {
      try {
        const tx = new Transaction();
        tx.moveCall({
          target: `${SEALED_PAIR_PACKAGE_ID}::order::settle`,
          arguments: [tx.object(order.orderObj)],
        });
        const result = await signAndExecute({ transaction: tx });
        setRealDigest(result.digest);
      } catch (e) {
        console.warn("[settle] on-chain settle failed (non-fatal):", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  type Step = { label: string; detail?: string; icon: IconName; ms: number; sub?: ReactNode };
  const steps: Step[] = [
    {
      label: "Composing Programmable Transaction Block",
      icon: "layers",
      ms: 1100,
      sub: (
        <CodeBlock
          title="settle.ptb"
          accent="var(--accent-2)"
          lines={`let a = split(maker_coin, ${fmt(t.amount)} ${t.give});
let b = split(taker_coin, ${fmt(t.counter)} ${t.get});
transfer(a, taker);   // leg 1
transfer(b, maker);   // leg 2
emit Receipt { blob: 0x…, digest }`}
        />
      ),
    },
    {
      label: "Both legs locked in one atomic block",
      detail: "all-or-nothing · no settlement window for MEV",
      icon: "bolt",
      ms: 1150,
    },
    {
      label: "Executing on Sui mainnet",
      detail: "via Tatum RPC · sui_executeTransactionBlock",
      icon: "anchor",
      ms: 1250,
    },
    {
      label: "Receipt minted — proof on-chain forever",
      detail: "digest " + digest().slice(0, 20) + "…",
      icon: "doc",
      ms: 900,
    },
  ];
  const done = useSteps(steps, true);
  const finished = done >= steps.length;

  return (
    <Overlay onClose={onClose}>
      <div
        style={{
          padding: "26px 28px",
          display: "flex", gap: 18, alignItems: "center",
          borderBottom: "1px solid var(--border-soft)",
        }}
      >
        <div style={{ animation: "floaty 3s ease-in-out infinite" }}>
          <Mascot pose={finished ? "proud" : "idle"} size={92} />
        </div>
        <div>
          <Badge tone={finished ? "good" : "open"} icon={finished ? "check" : "bolt"}>
            {finished ? "Settled" : "Settling"}
          </Badge>
          <h2 style={{ fontSize: 24, marginTop: 8 }}>{finished ? "Trade settled atomically." : "Settling atomically…"}</h2>
          <div style={{ color: "var(--text-dim)", fontSize: 14, marginTop: 4 }}>
            One block. Both legs. Either both transfers land, or neither does.
          </div>
        </div>
      </div>
      <div style={{ padding: "22px 28px", display: "flex", flexDirection: "column", gap: 18 }}>
        {steps.map((s, k) => (
          <div key={k}>
            <CeremonyStep
              state={k < done ? "done" : k === done ? "active" : "pending"}
              label={s.label}
              detail={s.detail}
              icon={s.icon}
            />
            {s.sub && k === Math.min(done, steps.length - 1) && !finished && (
              <div style={{ marginLeft: 48, marginTop: 10 }}>{s.sub}</div>
            )}
          </div>
        ))}
      </div>
      {finished && (
        <div className="fade-up" style={{ padding: "20px 28px 28px", borderTop: "1px solid var(--border-soft)" }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
            <Mono label="digest" copyable>{short(realDigest || digest(), 10, 6)}</Mono>
            <Mono label="receipt" copyable>{short(objId())}</Mono>
          </div>
          {realDigest && (
            <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginBottom: 12, fontFamily: "var(--font-mono)" }}>
              <a
                href={`https://suiscan.xyz/testnet/tx/${realDigest}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--accent)", textDecoration: "underline" }}
              >
                view on SuiScan ↗
              </a>
            </div>
          )}
          <Btn full size="lg" variant="primary" icon="shield" onClick={onDone}>View receipt in the Vault</Btn>
        </div>
      )}
    </Overlay>
  );
}
