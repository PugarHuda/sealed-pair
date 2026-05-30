// Domain types — ported from data.jsx

export type AssetSym = "SUI" | "USDC" | "USDT" | "WAL" | "DEEP";
export type Side = "SELL" | "BUY";
export type OrderState = "OPEN" | "LOCKED" | "REVEALED" | "SETTLED" | "EXPIRED" | "CANCELLED";

export type Persona = {
  name: string;
  handle: string;
  role: string;
  addr: string;
  full: string;
  blurb: string;
  avatar: string; // hex color
};

export type Maker = { name: string; handle: string; color: string };

export type OrderTerms = {
  amount: number;
  price: number;
  counter: number;
  give: AssetSym;
  get: AssetSym;
  minFill: number;
  slippage?: number;
  note?: string;
};

export type Order = {
  id: number;
  code: string;
  maker: Maker | "marina" | "theo";
  side: Side;
  give: AssetSym;
  get: AssetSym;
  sizeBand: string;
  terms: OrderTerms;
  blobId: string;
  keyId: string;
  policyId: string;
  orderObj: string;
  walEpochs: number;
  state: OrderState;
  escrow: { funded: boolean; by: string | null; byAddr: string | null; amount: number; asset: AssetSym };
  createdAgo: string;
  expiresIn: string;
  settleDigest: string | null;
  revealed: boolean;
  settledAt?: string;
  taker?: { name: string; handle: string };
};

export type Pose = "idle" | "sealing" | "sealed" | "reveal" | "proud" | "thinking";
export type MascotPaletteKey = "coral" | "jelly" | "mint" | "gold";
