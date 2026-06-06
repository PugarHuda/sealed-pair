"use client";
import { CSSProperties, useEffect, useRef, useState } from "react";
import type { Order } from "@/lib/types";
import { PERSONAS, short, fmt } from "@/lib/data";
import { Badge, Btn, Card, Mono, Row } from "@/components/ui/primitives";
import { AssetIcon, Pair } from "@/components/ui/asset";
import Icon from "@/components/ui/icon";
import Mascot from "@/components/mascot";
import { MakerTag, lblS, valS } from "@/components/app/shared";
import { decryptText, loadKey } from "@/lib/crypto";
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { SEALED_PAIR_PACKAGE_ID, computeEscrowMist, SUI_NETWORK_FOR_EVENTS, SUISCAN_HOST } from "@/lib/sui-orders";
import { CounterOfferModal, CounterOffersPanel } from "@/components/app/counter-offer";
import BlobInspector from "@/components/app/blob-inspector";
import OrderTimeline from "@/components/app/order-timeline";

const useTimeout = (fn: () => void, ms: number | null) => {
  useEffect(() => {
    if (ms == null) return;
    const t = setTimeout(fn, ms);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};

type Phase = "sealed" | "funding" | "revealing" | "revealed" | "settled";

function PolicyCheckLine({ ok, delay, children }: { ok?: boolean; delay: number; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  useTimeout(() => setShow(true), delay);
  if (!show) return null;
  return (
    <div
      className="fade-up"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        fontFamily: "var(--font-mono)",
        fontSize: 12.5,
        color: ok ? "var(--good)" : "var(--text-dim)",
      }}
    >
      {ok ? (
        <Icon name="check" size={14} sw={2.6} />
      ) : (
        <span
          className="spin"
          style={{
            width: 11, height: 11, border: "2px solid var(--accent)",
            borderTopColor: "transparent", borderRadius: "50%",
          }}
        />
      )}
      {children}
    </div>
  );
}

type RevealStyle = "decrypt" | "wave" | "pop";

function TermsPanel({
  order, revealed, revealing, revealStyle, decryptFailed,
}: {
  order: Order;
  revealed: boolean;
  revealing: boolean;
  revealStyle: RevealStyle;
  decryptFailed?: boolean;
}) {
  const t = order.terms;
  // When the on-chain reveal succeeded but the AES key isn't in this browser
  // session, we have nothing to fill the encrypted fields with. Show an
  // em-dash instead of a misleading "0".
  const enc = (v: React.ReactNode) =>
    decryptFailed ? (
      <span title="Terms encrypted — AES key not available in this browser session">
        <b style={{ fontFamily: "var(--font-display)", fontSize: 30, color: "var(--text-faint)" }}>—</b>
      </span>
    ) : (
      v
    );
  const encInline = (v: React.ReactNode) =>
    decryptFailed ? (
      <span title="Terms encrypted — AES key not available in this browser session" style={{ color: "var(--text-faint)" }}>—</span>
    ) : (
      v
    );
  const revealTransitions: Record<RevealStyle, CSSProperties> = {
    decrypt: { filter: revealed ? "blur(0)" : "blur(13px)", opacity: revealed ? 1 : 0.5, transition: "filter .9s var(--ease), opacity .9s" },
    wave:    { clipPath: revealed ? "inset(0 0 0 0)" : "inset(0 0 100% 0)", filter: revealed ? "none" : "blur(6px)", transition: "clip-path 1s var(--ease), filter 1s" },
    pop:     { transform: revealed ? "scale(1)" : "scale(.82)", opacity: revealed ? 1 : 0, filter: revealed ? "none" : "blur(8px)", transition: "all .8s var(--ease-back)" },
  };
  const revealTransition = revealTransitions[revealStyle];

  const big = (v: string, unit: string) => (
    <span>
      <b style={{ fontFamily: "var(--font-display)", fontSize: 34, letterSpacing: "-.02em" }}>{v}</b>{" "}
      <span style={{ color: "var(--text-faint)", fontSize: 16, fontWeight: 600 }}>{unit}</span>
    </span>
  );

  return (
    <Card pad={0} style={{ overflow: "hidden", position: "relative" }}>
      <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border-soft)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10, fontWeight: 800, fontFamily: "var(--font-display)", fontSize: 16 }}>
          {revealed ? <Icon name="unlock" size={18} style={{ color: "var(--good)" }} /> : <Icon name="lock" size={18} style={{ color: "var(--seal-glow)" }} />}
          {revealed ? "Terms revealed" : "Sealed terms"}
        </span>
        {revealed ? <Badge tone="good" icon="check">Decrypted by Seal</Badge> : <Badge tone="seal" icon="lock">Encrypted</Badge>}
      </div>

      {revealing && !revealed && (
        <div style={{ padding: "18px 24px", display: "flex", flexDirection: "column", gap: 9, background: "var(--deep)", borderBottom: "1px solid var(--border-soft)" }}>
          <PolicyCheckLine delay={0}>seal_approve(order, requester) — evaluating…</PolicyCheckLine>
          <PolicyCheckLine delay={500} ok>order.state == LOCKED</PolicyCheckLine>
          <PolicyCheckLine delay={850} ok>escrow.funded == true</PolicyCheckLine>
          <PolicyCheckLine delay={1150} ok>requester ∈ {"{maker, taker}"}</PolicyCheckLine>
          <PolicyCheckLine delay={1450} ok>epoch &lt; expiry_epoch</PolicyCheckLine>
          <PolicyCheckLine delay={1850}>assembling 2-of-3 key shares…</PolicyCheckLine>
          <PolicyCheckLine delay={2250} ok>decrypting {short(order.blobId, 9, 5)}</PolicyCheckLine>
        </div>
      )}

      <div style={{ position: "relative", padding: "26px 24px" }}>
        {!revealed && !revealing && (
          <div
            style={{
              position: "absolute", inset: 0, zIndex: 2,
              display: "grid", placeItems: "center",
              background: "color-mix(in oklab, var(--surface) 30%, transparent)",
            }}
          >
            <div style={{ textAlign: "center", color: "var(--text-dim)" }}>
              <div
                style={{
                  display: "inline-grid", placeItems: "center",
                  width: 54, height: 54, borderRadius: "50%",
                  background: "color-mix(in oklab, var(--seal) 22%, transparent)",
                  color: "var(--seal-glow)", marginBottom: 10,
                }}
              >
                <Icon name="lock" size={24} />
              </div>
              <div style={{ fontWeight: 700, color: "var(--text)" }}>Fund escrow to unlock</div>
              <div style={{ fontSize: 12.5, maxWidth: 230, marginTop: 4 }}>
                Seal releases the key automatically the moment the policy is satisfied.
              </div>
            </div>
          </div>
        )}
        <div style={{ ...revealTransition, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "22px 18px" }}>
          <div>
            <div style={lblS}>{order.side === "SELL" ? "Maker delivers" : "You deliver"}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
              <AssetIcon sym={t.give} size={30} />
              {big(fmt(t.amount), t.give)}
            </div>
          </div>
          <div>
            <div style={lblS}>Taker delivers</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
              <AssetIcon sym={t.get} size={30} />
              {enc(big(fmt(t.counter), t.get))}
            </div>
          </div>
          <div style={{ gridColumn: "1 / -1", height: 1, background: "var(--border-soft)" }} />
          <div><div style={lblS}>Price</div><div style={valS}>{encInline(<>{t.price} {t.get}/{t.give}</>)}</div></div>
          <div><div style={lblS}>Minimum fill</div><div style={valS}>{encInline(<>{fmt(t.minFill)} {t.give}</>)}</div></div>
          {t.note && (
            <div style={{ gridColumn: "1 / -1" }}>
              <div style={lblS}>Memo</div>
              <div style={{ ...valS, fontWeight: 500, fontSize: 14 }}>{t.note}</div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function pipGuide(phase: string, isMine: boolean) {
  if (phase === "funding")   return "Locking your deposit into the Order object…";
  if (phase === "revealing") return "Policy satisfied! Pulling key shares from the Seal servers…";
  if (phase === "revealed")  return "Ta-da! The terms are out. Like what you see? Settle it.";
  if (phase === "settled")   return "Done and dusted — proof lives on-chain forever. 🐚";
  if (isMine)                return "Your quote is live and sealed. I’ll guard the terms until someone commits.";
  return "These terms are sealed tight. Fund escrow and I’ll have Seal pop them open for you.";
}

export default function DealScreen({
  order, role, isMine, revealStyle, onSettle, onBack, onUpdate, onRoleSwitch,
}: {
  order: Order;
  role: "marina" | "theo";
  isMine: boolean;
  revealStyle: RevealStyle;
  onSettle: (o: Order) => void;
  onBack: (to?: "board" | "vault") => void;
  onUpdate: (id: number, patch: Partial<Order>) => void;
  onRoleSwitch?: (r: "marina" | "theo") => void;
}) {
  const [phase, setPhase] = useState<Phase>(
    order.state === "SETTLED" ? "settled" : order.revealed ? "revealed" : "sealed",
  );
  const [lockTxDigest, setLockTxDigest] = useState<string | null>(null);
  const revealed = phase === "revealed" || phase === "settled";
  const revealing = phase === "revealing";

  // Wallet hooks for real on-chain transitions (D2/D3). Falls back to mock
  // sleeps when wallet not connected or NEXT_PUBLIC_SEALED_PAIR_PACKAGE_ID
  // hasn't been set yet.
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const onChainEnabled = !!(account && SEALED_PAIR_PACKAGE_ID && order.orderObj.startsWith("0x") && order.orderObj.length === 66);

  const [fundError, setFundError] = useState<string | null>(null);
  const [decryptFailed, setDecryptFailed] = useState(false);
  const [walletBalanceMist, setWalletBalanceMist] = useState<bigint | null>(null);
  const [counterModalOpen, setCounterModalOpen] = useState(false);
  const [counterCount, setCounterCount] = useState(0);
  const [blobInspectorOpen, setBlobInspectorOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelDigest, setCancelDigest] = useState<string | null>(null);
  const [reaping, setReaping] = useState(false);
  const [reapError, setReapError] = useState<string | null>(null);
  const [reapDigest, setReapDigest] = useState<string | null>(null);
  // Unmount guard: long-running flows (fund, cancel, reap) await multiple
  // network round-trips. If the user navigates away mid-flight, we must
  // not call setPhase / setFundError on the dead component — and
  // particularly must not call onUpdate, which mutates parent state for
  // a card the user is no longer looking at.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  // Live "is this order past its deadline?" check — re-runs every minute.
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  const isExpired = !!order.expiresAtMs && order.expiresAtMs <= nowMs;

  // Pre-flight balance check: read the connected wallet's SUI balance so we
  // can warn the user *before* the wallet popup if their escrow can't fit.
  // Tx would still broadcast and revert; this saves them from burning
  // gas + a confusing Move abort.
  useEffect(() => {
    if (!account?.address) {
      setWalletBalanceMist(null);
      return;
    }
    let cancelled = false;
    suiClient
      .getBalance({ owner: account.address })
      .then((b) => { if (!cancelled) setWalletBalanceMist(BigInt(b.totalBalance)); })
      .catch(() => { if (!cancelled) setWalletBalanceMist(null); });
    return () => { cancelled = true; };
  }, [account?.address, suiClient]);

  const requiredEscrowMist = onChainEnabled && order.escrowRequiredMist
    ? BigInt(order.escrowRequiredMist)
    : null;
  // Private-offer gating: maker scoped this order to a specific wallet. We
  // block the Fund action client-side. V2 would enforce this inside Move's
  // lock_with_escrow so a CLI bypass also reverts.
  const walletLower = account?.address?.toLowerCase() ?? null;
  const targetMismatch =
    !!order.targetTaker &&
    !isMine &&
    (!walletLower || walletLower !== order.targetTaker);
  const targetedForMe =
    !!order.targetTaker && !!walletLower && walletLower === order.targetTaker;
  // Reserve ~0.05 SUI for gas. If escrow + reserve > balance, can't fund.
  const GAS_RESERVE_MIST = 50_000_000n;
  const balanceIssue =
    onChainEnabled && requiredEscrowMist && walletBalanceMist !== null
      ? walletBalanceMist < requiredEscrowMist + GAS_RESERVE_MIST
        ? {
            short: walletBalanceMist,
            need: requiredEscrowMist + GAS_RESERVE_MIST,
            requiredSui: Number(requiredEscrowMist) / 1e9,
            balanceSui: Number(walletBalanceMist) / 1e9,
          }
        : null
      : null;

  const fund = async () => {
    setFundError(null);
    setDecryptFailed(false);
    setPhase("funding");

    // ---- Pre-flight state check ----
    // Read the live Order state BEFORE asking the wallet to sign so a
    // stale board card surfaces a friendly error instead of a confusing
    // post-signature MoveAbort. Only treat as stale when we actually
    // observed a state number — RPC failures fall through to the real tx.
    if (onChainEnabled) {
      try {
        const res = await fetch("/api/sui", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            method: "sui_getObject",
            params: [order.orderObj, { showContent: true }],
            network: SUI_NETWORK_FOR_EVENTS,
          }),
        });
        if (res.ok) {
          const json = (await res.json()) as {
            result?: { data?: { content?: { fields?: { state?: unknown; expiry_epoch?: unknown } } } };
          };
          const rawState = json.result?.data?.content?.fields?.state;
          const state = typeof rawState === "string" || typeof rawState === "number" ? Number(rawState) : NaN;
          if (Number.isFinite(state) && state !== 0) {
            if (!mountedRef.current) return;
            const label = state === 1 ? "LOCKED" : state === 2 ? "REVEALED" : state === 3 ? "SETTLED" : state === 4 ? "CANCELLED" : "non-OPEN";
            setFundError(
              `Order is no longer OPEN on-chain (state=${label}). The board card is stale — refresh in a moment and pick a different sealed order.`,
            );
            setPhase("sealed");
            return;
          }
          // Expiry pre-flight. The on-chain `expiry_epoch` is the source of
          // truth; the card's "27d 21h" countdown is a human estimate from
          // a different field and can disagree (notably for seed orders
          // posted on devnet with short epoch windows). If we discover the
          // order already expired here, surface that BEFORE the wallet
          // signs — the Move call would otherwise abort with code 3 (EExpired)
          // and the user pays gas for nothing.
          const rawExpiry = json.result?.data?.content?.fields?.expiry_epoch;
          const expiryEpoch =
            typeof rawExpiry === "string" || typeof rawExpiry === "number" ? Number(rawExpiry) : NaN;
          if (Number.isFinite(expiryEpoch)) {
            try {
              const sysRes = await fetch("/api/sui", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  method: "sui_getLatestSuiSystemState",
                  params: [],
                  network: SUI_NETWORK_FOR_EVENTS,
                }),
              });
              if (sysRes.ok) {
                const sysJson = (await sysRes.json()) as { result?: { epoch?: unknown } };
                const epochRaw = sysJson.result?.epoch;
                const currentEpoch =
                  typeof epochRaw === "string" || typeof epochRaw === "number" ? Number(epochRaw) : NaN;
                if (Number.isFinite(currentEpoch) && currentEpoch >= expiryEpoch) {
                  if (!mountedRef.current) return;
                  setFundError(
                    `This order expired at epoch ${expiryEpoch} (current epoch ${currentEpoch}). The card's countdown was estimated from posting time, not the on-chain expiry — try a fresher sealed order from the board.`,
                  );
                  setPhase("sealed");
                  return;
                }
              }
            } catch {
              // System-state RPC blip — fall through to the real tx; if it
              // really IS expired, MoveAbort(3) will still be caught below.
            }
          }
        }
      } catch {
        // RPC blip — proceed and let the real tx error guide the user.
      }
    }

    // ---- Atomic lock + mark_revealed in ONE PTB ----
    // Why combined: doing them as two separate signAndExecute calls hits a
    // race where Slush's dry-run for mark_revealed runs against a fullnode
    // that hasn't seen the lock yet, so the assert state==LOCKED fails with
    // a MoveAbort 0 before the user even gets a chance to sign. Bundling
    // both Move calls into one PTB makes state transitions sequential
    // within the same tx, so the dry-run simulates lock → reveal cleanly
    // and only one wallet popup appears. If a previous attempt already
    // landed the lock (lockTxDigest set from prior retry), we omit the lock
    // step and only fire mark_revealed to avoid a double-lock abort.
    if (onChainEnabled && SEALED_PAIR_PACKAGE_ID) {
      try {
        const tx = new Transaction();
        if (!lockTxDigest) {
          const escrowMist = order.escrowRequiredMist
            ? BigInt(order.escrowRequiredMist)
            : computeEscrowMist(order.terms, order.give);
          const [escrowCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(escrowMist)]);
          tx.moveCall({
            target: `${SEALED_PAIR_PACKAGE_ID}::order::lock_with_escrow`,
            arguments: [tx.object(order.orderObj), escrowCoin, tx.object("0x6")],
          });
        }
        tx.moveCall({
          target: `${SEALED_PAIR_PACKAGE_ID}::order::mark_revealed`,
          arguments: [tx.object(order.orderObj)],
        });
        const result = await signAndExecute({ transaction: tx });
        // signAndExecute resolves on broadcast — a Move-aborted tx still
        // returns here with a digest. We must wait for effects + inspect
        // status before treating this as a real success.
        const full = await suiClient.waitForTransaction({
          digest: result.digest,
          options: { showEffects: true },
        });
        const status = full.effects?.status?.status;
        if (status !== "success") {
          throw new Error(full.effects?.status?.error ?? "Move execution aborted");
        }
        if (!mountedRef.current) return;
        if (!lockTxDigest) setLockTxDigest(result.digest);
      } catch (e) {
        if (!mountedRef.current) return;
        const msg = e instanceof Error ? e.message : "Lock + reveal failed";
        const hint =
          msg.includes("Insufficient") || msg.toLowerCase().includes("insufficient gas") || msg.toLowerCase().includes("balance")
            ? "Wallet doesn't have enough SUI for this order's escrow. Pick a smaller order (Suiscan shows escrow_required)."
            : msg.includes("abort code: 0")
            ? "Order isn't in a state we can act on — already locked by someone else, already revealed, or expired. Pick a different unlocked card."
            : msg.includes("abort code: 1")
            ? "Escrow amount doesn't match what the maker set."
            : msg.includes("abort code: 2")
            ? "Your wallet isn't a party to this order — only maker or taker can reveal."
            : msg.includes("abort code: 3")
            ? "This order expired on-chain. Card's countdown was estimated from posting time, not the on-chain expiry epoch — pick a fresher sealed order from the board."
            : msg.slice(0, 200);
        setFundError(hint);
        setPhase("sealed");
        return;
      }
    } else {
      await new Promise((r) => setTimeout(r, 1300));
    }

    // Resolve the on-chain taker address: prefer the real connected wallet,
    // fall back to the demo persona only when the dapp is in mock mode.
    const takerName = account?.address ? "You" : PERSONAS[role].name;
    const takerAddr = account?.address ?? PERSONAS[role].addr;

    onUpdate(order.id, {
      state: "LOCKED",
      escrow: { ...order.escrow, funded: true, by: takerName, byAddr: takerAddr },
    });
    setPhase("revealing");

    // ---- Real Walrus fetch + AES-GCM decrypt (when key available) ----
    // The key only lives in this browser's sessionStorage when this session
    // sealed the order. Pre-existing CLI-seeded orders will hit the no-key
    // branch and we surface that as decryptFailed (UI keeps real on-chain
    // state but warns that displayed terms are placeholders).
    let revealPatch: Partial<Order> = { revealed: true, state: "REVEALED" };
    let foundKey = false;
    try {
      const key = await loadKey(order.blobId);
      if (key) {
        foundKey = true;
        const res = await fetch(`/api/walrus/blob/${encodeURIComponent(order.blobId)}`, { cache: "force-cache" });
        if (res.ok) {
          const buf = await res.arrayBuffer();
          const plaintext = await decryptText(buf, key);
          const decoded = JSON.parse(plaintext) as {
            amount: number; price: number; counter: number; minFill: number; note?: string;
          };
          revealPatch = {
            ...revealPatch,
            terms: {
              ...order.terms,
              amount: decoded.amount,
              price: decoded.price,
              counter: decoded.counter,
              minFill: decoded.minFill,
              note: decoded.note ?? order.terms.note,
            },
          };
        }
      }
    } catch (e) {
      console.debug("[reveal] decrypt skipped:", e);
    }
    if (!foundKey) setDecryptFailed(true);

    // (mark_revealed already executed atomically in the same PTB as the
    // lock above. No second signAndExecute needed — that was the source of
    // the cross-fullnode race condition.)

    // Match the existing policy-check animation runtime (~2.5s of streaming lines)
    await new Promise((r) => setTimeout(r, 2600));
    if (!mountedRef.current) return;          // user navigated away mid-flight
    onUpdate(order.id, revealPatch);
    setPhase("revealed");
  };

  // Anyone-can-call expiry reaper: invokes cancel_expired which transitions
  // OPEN/LOCKED orders past their deadline to CANCELLED, refunding any
  // locked escrow back to the taker. Permissionless ecosystem hygiene.
  const reapExpired = async () => {
    setReaping(true);
    setReapError(null);
    // Same logic as cancelOffer: don't silently fall back to local-only state
    // flip if the wallet-gate was bypassed. A no-op-that-looks-like-success
    // is the canonical silent failure.
    if (onChainEnabled && SEALED_PAIR_PACKAGE_ID && !account) {
      setReapError("Connect a wallet first.");
      setReaping(false);
      return;
    }
    if (!(onChainEnabled && SEALED_PAIR_PACKAGE_ID && account)) {
      onUpdate(order.id, { state: "CANCELLED" as Order["state"] });
      setReaping(false);
      return;
    }
    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${SEALED_PAIR_PACKAGE_ID}::order::cancel_expired`,
        arguments: [tx.object(order.orderObj)],
      });
      const result = await signAndExecute({ transaction: tx });
      const full = await suiClient.waitForTransaction({
        digest: result.digest,
        options: { showEffects: true },
      });
      const status = full.effects?.status?.status;
      if (status !== "success") {
        throw new Error(full.effects?.status?.error ?? "cancel_expired aborted");
      }
      setReapDigest(result.digest);
      onUpdate(order.id, { state: "CANCELLED" as Order["state"] });
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Reap failed";
      // Move package error constants (move/sources/order.move):
      //   0 = EWrongState   3 = EExpired (used inside lock_with_escrow)
      //   4 = ENotExpired   (asserted by cancel_expired when epoch < expiry)
      const hint = raw.includes("abort code: 4")
        ? "Not expired yet — current epoch hasn't reached expiry_epoch on-chain."
        : raw.includes("abort code: 0")
        ? "Order is no longer in OPEN or LOCKED state."
        : raw.slice(0, 200);
      setReapError(hint);
    } finally {
      setReaping(false);
    }
  };

  // Cancel-open flow: lifts the order from OPEN → CANCELLED via a real
  // Move PTB. Only valid while still sealed (not yet locked). Errors map
  // to readable hints; success updates local state so the badge flips.
  const cancelOffer = async () => {
    setCancelling(true);
    setCancelError(null);
    // If the wallet-gate UI was bypassed (devtools), don't silently flip the
    // local state to CANCELLED — that would *look* like success but produce
    // zero on-chain effect. Surface a real error so the user notices.
    if (onChainEnabled && SEALED_PAIR_PACKAGE_ID && !account) {
      setCancelError("Connect a wallet first.");
      setCancelling(false);
      return;
    }
    if (!(onChainEnabled && SEALED_PAIR_PACKAGE_ID && account)) {
      // True demo path — package never deployed, mock UI only.
      onUpdate(order.id, { state: "CANCELLED" as Order["state"] });
      setCancelling(false);
      return;
    }
    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${SEALED_PAIR_PACKAGE_ID}::order::cancel_open`,
        arguments: [tx.object(order.orderObj)],
      });
      const result = await signAndExecute({ transaction: tx });
      const full = await suiClient.waitForTransaction({
        digest: result.digest,
        options: { showEffects: true },
      });
      const status = full.effects?.status?.status;
      if (status !== "success") {
        throw new Error(full.effects?.status?.error ?? "cancel_open aborted");
      }
      setCancelDigest(result.digest);
      onUpdate(order.id, { state: "CANCELLED" as Order["state"] });
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Cancel failed";
      const hint = raw.includes("abort code: 0")
        ? "Cancel blocked — order is no longer OPEN (already locked, revealed, or settled)."
        : raw.includes("abort code: 2")
        ? "Cancel blocked — only the maker can cancel."
        : raw.slice(0, 200);
      setCancelError(hint);
    } finally {
      setCancelling(false);
    }
  };

  const pipPose =
    phase === "funding" ? "sealing" :
    revealing ? "thinking" :
    phase === "revealed" ? "reveal" :
    phase === "settled" ? "proud" : "idle";

  const [linkCopied, setLinkCopied] = useState(false);
  const copyShareLink = () => {
    if (typeof window === "undefined" || !order.orderObj.startsWith("0x")) return;
    const url = `${window.location.origin}/app?order=${order.orderObj}`;
    navigator.clipboard?.writeText(url).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1800);
    }).catch(() => {/* clipboard blocked */});
  };

  return (
    <div className="fade-up" style={{ maxWidth: 1080, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, gap: 12 }}>
        <button
          onClick={() => onBack("board")}
          style={{
            background: "none", border: "none", color: "var(--text-dim)",
            display: "inline-flex", alignItems: "center", gap: 7,
            fontSize: 14, fontWeight: 600, cursor: "pointer",
            transform: "scaleX(-1)",
          }}
        >
          <Icon name="chev" size={16} /> <span style={{ transform: "scaleX(-1)" }}>Back to board</span>
        </button>
        {/* Share-link only meaningful for orders that exist on-chain. Demo /
            mock seed orders don't survive a fresh navigation. */}
        {order.orderObj.startsWith("0x") && order.orderObj.length === 66 && (
          <button
            onClick={copyShareLink}
            style={{
              background: linkCopied ? "color-mix(in oklab, var(--good) 14%, var(--deep))" : "var(--deep)",
              border: `1px solid ${linkCopied ? "var(--good)" : "var(--border)"}`,
              color: linkCopied ? "var(--good)" : "var(--text-dim)",
              display: "inline-flex", alignItems: "center", gap: 7,
              fontSize: 12.5, fontWeight: 700, cursor: "pointer",
              padding: "7px 14px", borderRadius: 99,
              transition: "all .15s",
            }}
            title="Copy direct link to this order — useful for sharing private offers"
          >
            <Icon name={linkCopied ? "check" : "copy"} size={13} sw={2.4} />
            {linkCopied ? "Link copied" : "Share link"}
          </button>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <Pair give={order.give} get={order.get} size={42} />
          <div>
            <h1 style={{ fontSize: 26 }}>
              {order.give} → {order.get}{" "}
              <span style={{ color: "var(--text-faint)", fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 400 }}>
                {order.code}
              </span>
            </h1>
            <div style={{ marginTop: 6 }}><MakerTag maker={order.maker} size={24} /></div>
          </div>
        </div>
        <Badge
          tone={phase === "settled" ? "good" : revealed ? "seal" : phase === "sealed" ? "open" : "locked"}
          icon={phase === "settled" ? "check" : revealed ? "unlock" : "lock"}
          size="md"
        >
          {{ sealed: "Sealed", funding: "Funding escrow", revealing: "Revealing", revealed: "Revealed", settled: "Settled" }[phase]}
        </Badge>
      </div>

      {/* Centralized transaction status strip. Shows the most recent action's
          outcome at the top of the deal room so success/failed/pending isn't
          buried in a corner. Priority order: error > pending > success.
          Auto-fades nothing — the user can re-read the digest later. */}
      <TxStatusStrip
        phase={phase}
        lockTxDigest={lockTxDigest}
        cancelDigest={cancelDigest}
        reapDigest={reapDigest}
        fundError={fundError}
        cancelError={cancelError}
        reapError={reapError}
        cancelling={cancelling}
        reaping={reaping}
      />

      <div className="deal-grid">
        <TermsPanel order={order} revealed={revealed} revealing={revealing} revealStyle={revealStyle} decryptFailed={decryptFailed} />

        <div style={{ display: "flex", flexDirection: "column", gap: 18, position: "sticky", top: 20 }}>
          <Card pad={20} glow>
            <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 14 }}>
              <div style={{ animation: revealing ? "sway 2s infinite" : "floaty 4s infinite" }}>
                <Mascot pose={pipPose} size={64} />
              </div>
              <div style={{ fontSize: 13.5, color: "var(--text-dim)", lineHeight: 1.4 }}>{pipGuide(phase, isMine)}</div>
            </div>

            {/* Permissionless expiry reaper. Any wallet can clean up an
                expired OPEN/LOCKED order via Move's cancel_expired. Outranks
                the maker/taker branches when the deadline has passed. */}
            {isExpired && (phase === "sealed" || phase === "funding") && (
              <div
                className="fade-up"
                style={{
                  background: "color-mix(in oklab, var(--warn) 18%, transparent)",
                  border: "1px solid var(--warn)",
                  borderRadius: "var(--r-sm)",
                  padding: 14, marginBottom: 14,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, color: "var(--warn)" }}>
                  <Icon name="clock" size={14} /> Past deadline
                </div>
                <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 6, lineHeight: 1.5 }}>
                  Anyone can reap this order via <span className="mono">cancel_expired</span>.
                  Locked escrow (if any) refunds to the taker.
                </div>
                {reapError && (
                  <div style={{ marginTop: 10, fontSize: 12, color: "var(--bad)", fontWeight: 600 }}>
                    {reapError}
                  </div>
                )}
                {reapDigest ? (
                  <div style={{ marginTop: 10, fontSize: 12, color: "var(--good)", fontWeight: 700 }}>
                    Reaped ·{" "}
                    <a
                      href={`${SUISCAN_HOST}/tx/${reapDigest}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "var(--good)", textDecoration: "underline" }}
                    >
                      view tx ↗
                    </a>
                  </div>
                ) : (
                  <Btn
                    full
                    variant="outline"
                    icon="bolt"
                    style={{ marginTop: 10 }}
                    disabled={reaping}
                    onClick={reapExpired}
                  >
                    {reaping ? "Reaping…" : "Reap expired order"}
                  </Btn>
                )}
              </div>
            )}
            {isMine && phase === "sealed" && (
              <>
                <div style={{ background: "var(--deep)", borderRadius: "var(--r-sm)", padding: 14, marginBottom: 14 }}>
                  <div style={lblS}>Status</div>
                  <div style={{ fontWeight: 700, marginTop: 4 }}>Posted · waiting for a taker</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-faint)", marginTop: 6 }}>
                    You can walk away — if a taker funds escrow, Seal reveals your terms without you. No ghosting possible, by either side.
                  </div>
                </div>
                {cancelError && (
                  <div
                    className="fade-up"
                    style={{
                      padding: "10px 12px",
                      background: "color-mix(in oklab, var(--bad) 14%, transparent)",
                      border: "1px solid var(--bad)",
                      borderRadius: "var(--r-sm)",
                      color: "var(--bad)",
                      fontSize: 12.5,
                      fontWeight: 600,
                      marginBottom: 12,
                    }}
                  >
                    <b>Cancel failed.</b> {cancelError}
                  </div>
                )}
                {cancelDigest && (
                  <div
                    className="fade-up"
                    style={{
                      padding: "10px 12px",
                      background: "color-mix(in oklab, var(--good) 14%, transparent)",
                      border: "1px solid var(--good)",
                      borderRadius: "var(--r-sm)",
                      color: "var(--good)",
                      fontSize: 12.5,
                      fontWeight: 600,
                      marginBottom: 12,
                    }}
                  >
                    Order cancelled on-chain ·{" "}
                    <a
                      href={`${SUISCAN_HOST}/tx/${cancelDigest}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "var(--good)", textDecoration: "underline" }}
                    >
                      view tx ↗
                    </a>
                  </div>
                )}
                {/* "View as taker (Theo)" persona-switch lived here as a
                    pre-wallet demo affordance. Gone now: identity comes from
                    the connected wallet. To take your own order, the user
                    connects a different wallet and opens the same deep-link. */}
                <Btn
                  full
                  variant="quiet"
                  disabled={cancelling || !!cancelDigest || !account}
                  onClick={cancelOffer}
                >
                  {!account
                    ? "Connect wallet to cancel"
                    : cancelDigest
                    ? "Cancelled"
                    : cancelling
                    ? "Cancelling…"
                    : onChainEnabled
                    ? "Cancel offer (on-chain)"
                    : "Cancel offer"}
                </Btn>
              </>
            )}

            {!isMine && (phase === "sealed" || phase === "funding") && (
              <>
                {fundError && (
                  <div
                    className="fade-up"
                    style={{
                      padding: "10px 12px",
                      background: "color-mix(in oklab, var(--bad) 14%, transparent)",
                      border: "1px solid var(--bad)",
                      borderRadius: "var(--r-sm)",
                      color: "var(--bad)",
                      fontSize: 12.5,
                      fontWeight: 600,
                      marginBottom: 12,
                      wordBreak: "break-word",
                    }}
                  >
                    <b>Tx failed — escrow not posted.</b> {fundError.slice(0, 160)}
                  </div>
                )}
                {balanceIssue && (
                  <div
                    className="fade-up"
                    style={{
                      padding: "10px 12px",
                      background: "color-mix(in oklab, var(--warn) 18%, transparent)",
                      border: "1px solid var(--warn)",
                      borderRadius: "var(--r-sm)",
                      color: "var(--warn)",
                      fontSize: 12.5,
                      fontWeight: 600,
                      marginBottom: 12,
                      lineHeight: 1.5,
                    }}
                  >
                    <b>Wallet too low for this escrow.</b> Need {balanceIssue.requiredSui.toFixed(3)} SUI
                    (+gas), you have {balanceIssue.balanceSui.toFixed(3)} SUI. Pick a smaller order or
                    top up at <a href="https://faucet.sui.io" target="_blank" rel="noopener noreferrer" style={{ color: "var(--warn)", textDecoration: "underline" }}>faucet.sui.io</a>.
                  </div>
                )}
                <div style={{ background: "var(--deep)", borderRadius: "var(--r-sm)", padding: 14, marginBottom: 14, display: "grid", gap: 10 }}>
                  <Row label="Good-faith escrow">
                    <b>
                      {requiredEscrowMist
                        ? `${(Number(requiredEscrowMist) / 1e9).toFixed(3)} SUI`
                        : `${fmt(order.escrow.amount)} ${order.escrow.asset}`}
                    </b>
                  </Row>
                  <Row label="Refundable"><Badge tone="good" size="sm">Yes, if maker bails</Badge></Row>
                  <div style={{ fontSize: 12, color: "var(--text-faint)", lineHeight: 1.5 }}>
                    Funding escrow is what satisfies the Seal policy — it’s the key that unlocks the terms. Cancel after reveal and you forfeit the fee.
                  </div>
                </div>
                {targetMismatch && (
                  <div
                    className="fade-up"
                    style={{
                      padding: "10px 12px",
                      background: "color-mix(in oklab, var(--seal) 18%, transparent)",
                      border: "1px solid var(--seal)",
                      borderRadius: "var(--r-sm)",
                      color: "var(--seal-glow)",
                      fontSize: 12.5,
                      fontWeight: 600,
                      marginBottom: 12,
                      lineHeight: 1.5,
                    }}
                  >
                    <b>Private offer.</b> Only{" "}
                    <span className="mono">{(order.targetTaker || "").slice(0, 10)}…{(order.targetTaker || "").slice(-6)}</span>{" "}
                    can fund this order.
                  </div>
                )}
                {targetedForMe && (
                  <div
                    className="fade-up"
                    style={{
                      padding: "10px 12px",
                      background: "color-mix(in oklab, var(--accent) 14%, transparent)",
                      border: "1px solid var(--accent)",
                      borderRadius: "var(--r-sm)",
                      color: "var(--accent)",
                      fontSize: 12.5,
                      fontWeight: 700,
                      marginBottom: 12,
                    }}
                  >
                    <Icon name="check" size={13} sw={2.6} /> Targeted at your wallet — exclusive deal.
                  </div>
                )}
                <Btn
                  full
                  size="lg"
                  variant="seal"
                  icon="unlock"
                  disabled={phase === "funding" || !!balanceIssue || targetMismatch || !account}
                  onClick={fund}
                >
                  {!account
                    ? "Connect wallet to fund escrow"
                    : phase === "funding"
                    ? "Funding…"
                    : targetMismatch
                    ? "Not for this wallet"
                    : balanceIssue
                    ? "Insufficient SUI for escrow"
                    : fundError
                    ? "Retry — fund escrow & request reveal"
                    : "Fund escrow & request reveal"}
                </Btn>
                {/* Counter-offer entry — only meaningful when wallet connected
                    AND we have a real on-chain orderId (the localStorage index
                    keys off it). Disabled in mock mode. */}
                {account?.address && order.orderObj.startsWith("0x") && phase === "sealed" && (
                  <Btn
                    full
                    variant="outline"
                    icon="bolt"
                    style={{ marginTop: 10 }}
                    onClick={() => setCounterModalOpen(true)}
                  >
                    Counter-offer instead →
                  </Btn>
                )}
              </>
            )}

            {revealed && phase !== "settled" && (
              <>
                <div style={{ background: "var(--deep)", borderRadius: "var(--r-sm)", padding: 14, marginBottom: 14, display: "grid", gap: 10 }}>
                  <Row label="You receive">
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                      <AssetIcon sym={order.side === "SELL" ? order.give : order.get} size={20} />
                      <b>
                        {decryptFailed && order.side !== "SELL"
                          ? <span style={{ color: "var(--text-faint)" }} title="Encrypted — key not in session">—</span>
                          : fmt(order.side === "SELL" ? order.terms.amount : order.terms.counter)}
                      </b>
                    </span>
                  </Row>
                  <Row label="You deliver">
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                      <AssetIcon sym={order.side === "SELL" ? order.get : order.give} size={20} />
                      <b>
                        {decryptFailed && order.side === "SELL"
                          ? <span style={{ color: "var(--text-faint)" }} title="Encrypted — key not in session">—</span>
                          : fmt(order.side === "SELL" ? order.terms.counter : order.terms.amount)}
                      </b>
                    </span>
                  </Row>
                </div>
                <Btn
                  full
                  size="lg"
                  variant="primary"
                  icon="bolt"
                  disabled={!account}
                  onClick={() => onSettle(order)}
                >
                  {account ? "Confirm & settle atomically" : "Connect wallet to settle"}
                </Btn>
                <div style={{ fontSize: 12, color: "var(--text-faint)", textAlign: "center", marginTop: 8 }}>
                  One PTB · both legs · no MEV window
                </div>
              </>
            )}

            {phase === "settled" && (
              <div style={{ textAlign: "center", padding: "8px 0" }}>
                <Badge tone="good" icon="check">Settled on-chain</Badge>
                <div style={{ marginTop: 14 }}>
                  <Btn full variant="primary" icon="shield" onClick={() => onBack("vault")}>Open the Vault</Btn>
                </div>
              </div>
            )}
          </Card>

          {/* Counter-offers panel — shows received counters for the maker,
              and outgoing ones for the taker. Renders nothing when no
              counters exist for this orderId. Key bumps on counterCount so a
              fresh submission re-reads localStorage. */}
          {order.orderObj.startsWith("0x") && (
            <CounterOffersPanel
              key={`co-${counterCount}`}
              orderId={order.orderObj}
              isMaker={isMine}
            />
          )}

          {/* Real on-chain lifetime — every event emitted for this order id. */}
          <OrderTimeline orderId={order.orderObj} />

          <Card pad={18}>
            <div style={{ ...lblS, marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>Cryptographic commitment</span>
              <button
                type="button"
                onClick={() => setBlobInspectorOpen(true)}
                style={{
                  background: "var(--deep)", border: "1px solid var(--border)",
                  borderRadius: 99, padding: "3px 10px",
                  fontSize: 10.5, fontWeight: 700, color: "var(--accent-2)",
                  cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4,
                  textTransform: "none", letterSpacing: 0,
                }}
              >
                <Icon name="eye" size={11} sw={2.4} /> Inspect blob
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Mono label="blobId" copyable>{short(order.blobId, 11, 6)}</Mono>
              <Mono label="order" copyable>{short(order.orderObj, 10, 6)}</Mono>
              <Mono label="policy" copyable>{short(order.policyId, 10, 6)}</Mono>
              {order.escrow.funded && (
                <Mono label="escrow by" copyable>{order.escrow.byAddr || PERSONAS[role].addr}</Mono>
              )}
              {lockTxDigest && (
                <a
                  href={`${SUISCAN_HOST}/tx/${lockTxDigest}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 12, color: "var(--accent)", textDecoration: "underline", marginTop: 6, fontFamily: "var(--font-mono)" }}
                >
                  lock tx: {short(lockTxDigest, 10, 6)} ↗
                </a>
              )}
            </div>
            {decryptFailed && revealed && (
              <div
                style={{
                  marginTop: 14,
                  padding: "10px 12px",
                  background: "color-mix(in oklab, var(--warn) 14%, transparent)",
                  border: "1px solid var(--warn)",
                  borderRadius: "var(--r-sm)",
                  color: "var(--warn)",
                  fontSize: 12,
                  fontWeight: 600,
                  lineHeight: 1.5,
                }}
              >
                <b>Lock + reveal are real on-chain</b> — see the lock tx above. But the AES key
                for this seeded order lives in another session's storage, so the encrypted fields
                (taker delivers, price, min fill) render as "—". Real decrypt works for orders
                you seal yourself in this browser via "Seal a quote".
              </div>
            )}
          </Card>
        </div>
      </div>
      {counterModalOpen && account?.address && (
        <CounterOfferModal
          order={order}
          proposerAddr={account.address}
          onClose={() => setCounterModalOpen(false)}
          onDone={() => {
            setCounterModalOpen(false);
            setCounterCount((n) => n + 1);
          }}
        />
      )}
      {blobInspectorOpen && (
        <BlobInspector blobId={order.blobId} onClose={() => setBlobInspectorOpen(false)} />
      )}
    </div>
  );
}

/* ============== TxStatusStrip ==============
 *
 * Centralized "what just happened?" surface for the Deal Room. Replaces the
 * problem where success/pending/fail signals were scattered across the page:
 * lockTxDigest down at line 1025, cancelDigest inside the cancel button,
 * fundError in a banner inside the fund section, etc. Users had to hunt for
 * the indicator that mattered.
 *
 * Priority resolution (only ONE state renders at a time):
 *   1. Any error (red)
 *   2. Any "pending" intent (yellow, with spinner)
 *   3. Any success digest (green, with SuiScan link)
 *   4. Nothing — strip hidden, no chrome.
 *
 * Why a single strip beats per-action toasts: the deal room only ever runs
 * ONE PTB at a time (fund OR cancel OR reap; settle is in a modal). No
 * stacking, no queue management, no z-index battles. Just one row at the
 * top that always means "the most recent thing you did".                    */
function TxStatusStrip({
  phase, lockTxDigest, cancelDigest, reapDigest,
  fundError, cancelError, reapError,
  cancelling, reaping,
}: {
  phase: Phase;
  lockTxDigest: string | null;
  cancelDigest: string | null;
  reapDigest: string | null;
  fundError: string | null;
  cancelError: string | null;
  reapError: string | null;
  cancelling: boolean;
  reaping: boolean;
}) {
  // --- 1. Errors first (red) ---
  const error = fundError || cancelError || reapError;
  if (error) {
    return (
      <StripShell tone="bad" icon="bolt">
        <b>Transaction failed.</b>
        <span style={{ opacity: 0.85, marginLeft: 6 }}>{error.slice(0, 180)}</span>
      </StripShell>
    );
  }

  // --- 2. Pending signers (yellow, spinning) ---
  if (phase === "funding") {
    return (
      <StripShell tone="warn" spinning>
        <b>Funding escrow…</b>
        <span style={{ opacity: 0.85, marginLeft: 6 }}>
          Signing lock_with_escrow + mark_revealed in your wallet · single PTB
        </span>
      </StripShell>
    );
  }
  if (cancelling) {
    return (
      <StripShell tone="warn" spinning>
        <b>Cancelling offer…</b>
        <span style={{ opacity: 0.85, marginLeft: 6 }}>Signing cancel_open in your wallet</span>
      </StripShell>
    );
  }
  if (reaping) {
    return (
      <StripShell tone="warn" spinning>
        <b>Reaping expired order…</b>
        <span style={{ opacity: 0.85, marginLeft: 6 }}>Signing cancel_expired</span>
      </StripShell>
    );
  }
  if (phase === "revealing") {
    return (
      <StripShell tone="seal" spinning>
        <b>Revealing terms…</b>
        <span style={{ opacity: 0.85, marginLeft: 6 }}>
          Policy satisfied — pulling key shares from Seal servers
        </span>
      </StripShell>
    );
  }

  // --- 3. Success states (green with SuiScan link) ---
  if (cancelDigest) {
    return <SuccessStrip label="Offer cancelled" digest={cancelDigest} />;
  }
  if (reapDigest) {
    return <SuccessStrip label="Expired order reaped" digest={reapDigest} />;
  }
  if (phase === "settled") {
    return <SuccessStrip label="Settled on-chain — open the Vault for the receipt" />;
  }
  if (lockTxDigest) {
    // Lock landed but not yet settled — celebrate the lock specifically.
    return <SuccessStrip label="Escrow locked on-chain" digest={lockTxDigest} />;
  }

  // --- 4. Nothing to announce ---
  return null;
}

function StripShell({
  tone, icon, spinning, children,
}: {
  tone: "bad" | "warn" | "good" | "seal";
  icon?: "bolt" | "check" | "clock";
  spinning?: boolean;
  children: React.ReactNode;
}) {
  const color = `var(--${tone})`;
  return (
    <div
      className="fade-up"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "11px 16px",
        marginBottom: 18,
        background: `color-mix(in oklab, ${color} 12%, var(--surface))`,
        border: `1px solid ${color}`,
        borderRadius: "var(--r-sm)",
        color,
        fontSize: 13.5,
        fontWeight: 600,
      }}
      role="status"
      aria-live="polite"
    >
      {spinning ? (
        <span
          aria-hidden
          style={{
            width: 14, height: 14,
            border: `2px solid color-mix(in oklab, ${color} 35%, transparent)`,
            borderTopColor: color,
            borderRadius: "50%",
            animation: "spin .9s linear infinite",
            flex: "0 0 auto",
          }}
        />
      ) : (
        <span style={{ color, flex: "0 0 auto" }}>
          <Icon name={icon ?? "check"} size={15} sw={2.6} />
        </span>
      )}
      <div style={{ color: "var(--text)", flex: 1, lineHeight: 1.45 }}>{children}</div>
    </div>
  );
}

function SuccessStrip({ label, digest }: { label: string; digest?: string }) {
  return (
    <StripShell tone="good" icon="check">
      <b>{label}</b>
      {digest && (
        <a
          href={`${SUISCAN_HOST}/tx/${digest}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            marginLeft: 10,
            fontFamily: "var(--font-mono)",
            fontSize: 12.5,
            color: "var(--good)",
            textDecoration: "underline",
          }}
          title="View transaction on SuiScan"
        >
          {digest.slice(0, 10)}…{digest.slice(-6)} ↗
        </a>
      )}
    </StripShell>
  );
}
