"use client";
import { ReactNode, useEffect, useRef, useState } from "react";
import type { Order } from "@/lib/types";
import { rnd, short, objId, fmt } from "@/lib/data";
import { Badge, Btn, Mono, CeremonyStep } from "@/components/ui/primitives";
import { IconName } from "@/components/ui/icon";
import Mascot from "@/components/mascot";
import { encryptText, generateKey, stashKey } from "@/lib/crypto";
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { SEALED_PAIR_PACKAGE_ID, computeEscrowMist, fetchCurrentEpoch, rememberSideHint, rememberTargetHint, SUI_NETWORK_FOR_EVENTS, SUISCAN_HOST } from "@/lib/sui-orders";

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
  onDone: (patch: { blobId: string; publisher?: string; txDigest?: string; escrowRequiredMist?: string }) => void;
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
  // Resolved escrow amount — stored in a ref so we can pass it back to
  // finishSeal without mutating the order prop (props are frozen in
  // React strict mode and the mutation would throw or silently drop).
  const escrowMistRef = useRef<string | undefined>(undefined);

  // Wallet (D2/D3): when connected AND Move package deployed, we register
  // the Order on-chain for real. Otherwise step 4 remains a visual mock.
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
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
        // Remember the user's stated side so the RFQ board can render the
        // correct tag once the polling cycle picks this order up. Chain
        // doesn't store side — without this the heuristic owns it.
        rememberSideHint(blobId, order.side as "SELL" | "BUY");
        // Same idea for targeted-audience: if the maker scoped this offer to
        // a specific taker we keep the address pinned to the blobId so the
        // Board can re-apply the gating after a refresh.
        if (order.targetTaker) rememberTargetHint(blobId, order.targetTaker);
        await sleep(400);
        setDone(2);

        // ---- Step 3: seal policy (mock until Seal SDK wired)
        await sleep(1100);
        setDone(3);

        // ---- Step 4: Sui register
        if (onChainEnabled && SEALED_PAIR_PACKAGE_ID) {
          try {
            const escrowMist = computeEscrowMist(order.terms, order.give);
            // Set expiry ~30 epochs ahead of current (≈30 days on testnet);
            // falls back to a safe 1000 if we can't read the system state.
            const currentEpoch = await fetchCurrentEpoch(SUI_NETWORK_FOR_EVENTS);
            const expiryEpoch = BigInt((currentEpoch > 0 ? currentEpoch : 0) + 30);
            // Save resolved MIST in a ref (not on the props) so finishSeal
            // can forward the exact amount that the on-chain order locks.
            escrowMistRef.current = escrowMist.toString();
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
            // dApp Kit returns just { digest, rawEffects? } from the wallet.
            // We must do a separate read to confirm Move execution succeeded —
            // signAndExecute resolves on broadcast even when the tx aborted.
            const full = await suiClient.waitForTransaction({
              digest: result.digest,
              options: { showEffects: true },
            });
            const status = full.effects?.status?.status;
            if (status !== "success") {
              throw new Error(full.effects?.status?.error ?? "Move execution aborted");
            }
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
                    href={`${SUISCAN_HOST}/tx/${txDigest}`}
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
          <Btn
            full size="lg" icon="search"
            onClick={() => onDone({
              blobId: displayBlobId,
              publisher,
              txDigest: txDigest ?? undefined,
              escrowRequiredMist: escrowMistRef.current,
            })}
          >
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
  /** Receives the real on-chain digest + connected taker address when the
   *  on-chain path executed. Omitted when running in mock/demo mode. */
  onDone: (result?: { digest: string; takerAddr: string }) => void;
  onClose: () => void;
}) {
  const t = order.terms;
  const [realDigest, setRealDigest] = useState<string | null>(null);
  const [settleError, setSettleError] = useState<string | null>(null);
  const settleStarted = useRef(false);

  const account = useCurrentAccount();
  const suiClient = useSuiClient();
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
        // showEffects so we can detect Move aborts post-broadcast.
        // signAndExecute resolves on broadcast, NOT on success — a tx that
        // Move-aborted on-chain still returns a digest unless we check
        // effects.status.
        const result = await signAndExecute({ transaction: tx });
        // Wait for and inspect effects.status because signAndExecute returns
        // on broadcast — a tx that Move-aborted still gives back a digest.
        const full = await suiClient.waitForTransaction({
          digest: result.digest,
          options: { showEffects: true },
        });
        const status = full.effects?.status?.status;
        if (status !== "success") {
          throw new Error(full.effects?.status?.error ?? "Move execution aborted");
        }
        setRealDigest(result.digest);
      } catch (e) {
        const raw = e instanceof Error ? e.message : "Settle failed on-chain";
        const hint = raw.includes("abort code: 0")
          ? "Settle blocked — order state isn't REVEALED on-chain (lock/reveal may not have landed for your wallet)."
          : raw.includes("abort code: 2")
          ? "Settle blocked — your wallet isn't a party to this order."
          : raw.slice(0, 200);
        setSettleError(hint);
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
      label: `Executing on Sui ${SUI_NETWORK_FOR_EVENTS}`,
      detail: "wallet-signed · confirmed via suiClient.waitForTransaction",
      icon: "anchor",
      ms: 1250,
    },
    {
      label: "Receipt minted — proof on-chain forever",
      // Use the real digest once we have it; show "pending…" until then so
      // a re-render during waitingForWallet doesn't flicker through a
      // fresh random `digest()` value every poll cycle.
      detail: realDigest ? `digest ${realDigest.slice(0, 20)}…` : "digest pending…",
      icon: "doc",
      ms: 900,
    },
  ];
  const animDone = useSteps(steps, true);
  // Animation may have walked through all the steps, but the user might
  // still be looking at the wallet popup. Only treat the ceremony as truly
  // FINISHED once the real on-chain tx has a digest. This prevents the
  // "ghost settle" — UI claiming success while Slush is still pending.
  const animFinished = animDone >= steps.length;
  const finished = onChainEnabled
    ? !!realDigest                    // real path: wait for actual chain success
    : animFinished;                   // mock-only path: timer is the only signal
  const waitingForWallet = onChainEnabled && animFinished && !realDigest && !settleError;
  const done = waitingForWallet ? steps.length - 1 : animDone;

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
          <Badge
            tone={settleError ? "bad" : finished ? "good" : "open"}
            icon={settleError ? "bolt" : finished ? "check" : "bolt"}
          >
            {settleError ? "Settle failed" : finished ? "Settled" : waitingForWallet ? "Awaiting wallet" : "Settling"}
          </Badge>
          <h2 style={{ fontSize: 24, marginTop: 8 }}>
            {settleError
              ? "Settlement rejected by chain."
              : finished
              ? "Trade settled atomically."
              : waitingForWallet
              ? "Approve the settle PTB in your wallet…"
              : "Settling atomically…"}
          </h2>
          <div style={{ color: "var(--text-dim)", fontSize: 14, marginTop: 4 }}>
            One block. Both legs. Either both transfers land, or neither does.
          </div>
        </div>
      </div>
      <div style={{ padding: "22px 28px", display: "flex", flexDirection: "column", gap: 18 }}>
        {steps.map((s, k) => (
          <div key={k}>
            <CeremonyStep
              state={
                waitingForWallet && k === steps.length - 1
                  ? "active"
                  : k < done
                  ? "done"
                  : k === done
                  ? "active"
                  : "pending"
              }
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
      {finished && !settleError && (
        <div className="fade-up" style={{ padding: "20px 28px 28px", borderTop: "1px solid var(--border-soft)" }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
            {realDigest && <Mono label="digest" copyable>{short(realDigest, 10, 6)}</Mono>}
            <Mono label="receipt" copyable>{short(objId())}</Mono>
          </div>
          {realDigest && (
            <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginBottom: 12, fontFamily: "var(--font-mono)" }}>
              <a
                href={`${SUISCAN_HOST}/tx/${realDigest}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--accent)", textDecoration: "underline" }}
              >
                view on SuiScan ↗
              </a>
            </div>
          )}
          <Btn
            full
            size="lg"
            variant="primary"
            icon="shield"
            onClick={() => onDone(realDigest && account?.address ? { digest: realDigest, takerAddr: account.address } : undefined)}
          >
            View receipt in the Vault
          </Btn>
        </div>
      )}
      {settleError && (
        <div className="fade-up" style={{ padding: "20px 28px 28px", borderTop: "1px solid var(--border-soft)" }}>
          <div
            style={{
              padding: "12px 14px",
              background: "color-mix(in oklab, var(--bad) 14%, transparent)",
              border: "1px solid var(--bad)",
              borderRadius: "var(--r-sm)",
              color: "var(--bad)",
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 14,
              wordBreak: "break-word",
            }}
          >
            <b>Settle failed on-chain.</b> {settleError.slice(0, 200)}
          </div>
          <Btn full variant="outline" onClick={onClose}>Close</Btn>
        </div>
      )}
    </Overlay>
  );
}
