// Mock data + helpers — ported from data.jsx
import type { AssetSym, Maker, Order, Persona, Side } from "./types";

const HEX = "0123456789abcdef";
export const rnd = (n: number) => Array.from({ length: n }, () => HEX[Math.floor(Math.random() * 16)]).join("");
export const blobId = () => "bafyk" + rnd(46);
export const digest = () => rnd(44);
export const suiAddr = () => "0x" + rnd(40);
export const objId = () => "0x" + rnd(40);

export const short = (s: string, a = 6, b = 4) =>
  s.length > a + b + 2 ? `${s.slice(0, a)}…${s.slice(-b)}` : s;

export const fmt = (n: number) => n.toLocaleString("en-US");

export const PERSONAS: Record<"marina" | "theo", Persona> = {
  marina: {
    name: "Marina",
    handle: "marina.sui",
    role: "Market Maker",
    addr: "0x7f3a…c41d",
    full: "0x7f3a9e2b1c8d4f6a0b5e9d2c7a1f8e3b4d6c5a2",
    blurb: "Liquidity provider · 8.4M SUI lifetime volume",
    avatar: "#ff8f63",
  },
  theo: {
    name: "Theo",
    handle: "theo.reef.dao",
    role: "Treasury Manager",
    addr: "0x2b9c…7e10",
    full: "0x2b9c4d1a8f3e6b2c9d0a5e8f1b4c7d3a6e90",
    blurb: "Reef Protocol DAO · governance-audited treasury",
    avatar: "#5fe0ff",
  },
};

export const MAKERS: Maker[] = [
  { name: "Kelp Capital", handle: "kelp.sui", color: "#4dd6a8" },
  { name: "Abyssal Desk", handle: "abyssal.sui", color: "#7b8cff" },
  { name: "Nautilus OTC", handle: "nautilus.sui", color: "#ffb24a" },
  { name: "Mariana Holdings", handle: "mariana.sui", color: "#ff6fae" },
  { name: "Tide Treasury", handle: "tide.dao", color: "#5fe0ff" },
];

export type AssetInfo = { sym: AssetSym; name: string; color: string; glyph: string };
export const ASSETS: Record<AssetSym, AssetInfo> = {
  SUI: { sym: "SUI", name: "Sui", color: "#4da2ff", glyph: "◆" },
  USDC: { sym: "USDC", name: "USD Coin", color: "#2775ca", glyph: "$" },
  USDT: { sym: "USDT", name: "Tether", color: "#26a17b", glyph: "₮" },
  WAL: { sym: "WAL", name: "Walrus", color: "#28c2b8", glyph: "≈" },
  DEEP: { sym: "DEEP", name: "DeepBook", color: "#8b6cff", glyph: "❖" },
};

export function bandFor(n: number): string {
  if (n >= 100_000) return "100k+";
  if (n >= 50_000) return "50k–100k";
  if (n >= 25_000) return "25k–50k";
  if (n >= 10_000) return "10k–25k";
  return "<10k";
}

let _seq = 1000;
type MakeOrderArgs = {
  maker: Order["maker"];
  side: Side;
  give: AssetSym;
  get: AssetSym;
  amount: number;
  price: number;
  sizeBand?: string;
  expiresIn?: string;
  createdAgo?: string;
  state?: Order["state"];
};
export function makeOrder(args: MakeOrderArgs): Order {
  const id = ++_seq;
  const counter = Math.round(args.amount * args.price);
  return {
    id,
    code: "SP-" + id.toString(36).toUpperCase(),
    maker: args.maker,
    side: args.side,
    give: args.give,
    get: args.get,
    sizeBand: args.sizeBand || bandFor(args.amount),
    terms: {
      amount: args.amount,
      price: args.price,
      counter,
      give: args.give,
      get: args.get,
      minFill: Math.round(args.amount * 0.25),
      slippage: 0,
      note: "",
    },
    blobId: blobId(),
    keyId: objId(),
    policyId: objId(),
    orderObj: objId(),
    walEpochs: 6,
    state: args.state || "OPEN",
    escrow: { funded: false, by: null, byAddr: null, amount: Math.round(counter * 0.02), asset: args.get },
    createdAgo: args.createdAgo || "4m",
    expiresIn: args.expiresIn || "11h 40m",
    settleDigest: null,
    revealed: false,
  };
}

export const SEED_ORDERS: Order[] = [
  makeOrder({ maker: MAKERS[0], side: "SELL", give: "SUI", get: "USDC", amount: 50_000, price: 3.92, createdAgo: "2m", expiresIn: "11h 52m" }),
  makeOrder({ maker: MAKERS[1], side: "BUY", give: "USDC", get: "SUI", amount: 120_000, price: 0.255, createdAgo: "9m", expiresIn: "5h 12m" }),
  makeOrder({ maker: MAKERS[2], side: "SELL", give: "WAL", get: "USDC", amount: 80_000, price: 0.61, createdAgo: "14m", expiresIn: "22h 03m" }),
  makeOrder({ maker: MAKERS[3], side: "SELL", give: "SUI", get: "USDT", amount: 32_000, price: 3.9, createdAgo: "31m", expiresIn: "2h 41m" }),
  makeOrder({ maker: MAKERS[4], side: "BUY", give: "USDC", get: "DEEP", amount: 240_000, price: 0.041, createdAgo: "48m", expiresIn: "18h 20m" }),
];

export const SETTLED_SEED: Order = (() => {
  const o = makeOrder({
    maker: MAKERS[1],
    side: "SELL",
    give: "SUI",
    get: "USDC",
    amount: 75_000,
    price: 3.88,
    createdAgo: "1d",
    expiresIn: "—",
    state: "SETTLED",
  });
  o.revealed = true;
  o.escrow = { funded: true, by: "Theo", byAddr: PERSONAS.theo.addr, amount: Math.round(o.terms.counter * 0.02), asset: "USDC" };
  o.settleDigest = digest();
  o.settledAt = "Yesterday · 14:08";
  o.taker = { name: "Theo", handle: "theo.reef.dao" };
  return o;
})();

export const VOLUME_STATS = { volume: 4_280_000, settled: 38, avgSettle: "2.4s", sealed: 12 };
