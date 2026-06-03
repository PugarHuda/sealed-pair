// Watchlist — Diam-style alerting on incoming orders. User picks (pair, side)
// criteria; every refresh cycle compares fresh-arrived orders against the
// criteria and surfaces matches via in-app toast + browser Notification.

import type { AssetSym, Order } from "./types";

export type Watch = {
  id: string;
  give: AssetSym;
  get: AssetSym;
  side?: "SELL" | "BUY";          // undefined = either
  createdAt: number;
};

const KEY = "sealedpair:watchlist";
const SEEN_KEY = "sealedpair:watchlist-seen";

function readJson<T>(k: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(k);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(k: string, v: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* quota — best effort */
  }
}

export function listWatches(): Watch[] {
  return readJson<Watch[]>(KEY, []);
}

export function addWatch(w: Omit<Watch, "id" | "createdAt">): Watch {
  const all = listWatches();
  // Dedupe by (give, get, side) so a user clicking the same pair twice
  // doesn't end up firing two notifications.
  const dup = all.find(
    (x) => x.give === w.give && x.get === w.get && x.side === w.side,
  );
  if (dup) return dup;
  const entry: Watch = {
    ...w,
    id: `w_${Date.now()}_${Math.floor(Math.random() * 0xffff).toString(16)}`,
    createdAt: Date.now(),
  };
  writeJson(KEY, [...all, entry]);
  return entry;
}

export function removeWatch(id: string) {
  writeJson(KEY, listWatches().filter((w) => w.id !== id));
}

/** Does this order satisfy at least one watch? Returns matched watches. */
export function matchingWatches(order: Order, watches: Watch[]): Watch[] {
  if (watches.length === 0) return [];
  return watches.filter(
    (w) =>
      w.give === order.give &&
      w.get === order.get &&
      (w.side === undefined || w.side === order.side),
  );
}

/* ----- seen-order memory: prevents re-notifying about the same order ----- */

export function loadSeenOrderIds(): Set<string> {
  return new Set(readJson<string[]>(SEEN_KEY, []));
}

export function persistSeenOrderIds(seen: Set<string>) {
  // Cap at 500 — newest wins. We just need enough memory to avoid
  // re-notifying within a typical session.
  const arr = Array.from(seen).slice(-500);
  writeJson(SEEN_KEY, arr);
}

/* ----- browser Notification helpers (silent no-op on unsupported envs) ----- */

export async function ensureNotifyPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) return "denied";
  if (Notification.permission === "default") {
    try {
      return await Notification.requestPermission();
    } catch {
      return "denied";
    }
  }
  return Notification.permission;
}

export function fireSystemNotification(opts: { title: string; body: string }) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(opts.title, { body: opts.body, icon: "/icon.png", silent: false });
  } catch {
    /* swallow — some browsers throw on focus restrictions */
  }
}
