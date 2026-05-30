# Sealed Pair — Brand & Design Tokens

Source of truth ported from **Claude Design handoff** (`.handoff/sealed-pair/`). All UI must defer to these values.

## Concept

**Sealed Pair** — Sealed P2P OTC trading on Sui. Sea-horse → sealed pair (pair-bonded mascot literally encodes the P2P pattern). Mascot **Pip** the cel-shaded anime seahorse hosts the entire experience.

**Tagline:** *"Move size without tipping your hand."*

## Theme

Default theme: **Lagoon** (light Sui-aquatic). Two alternative themes ship in `globals.css` for tweak experimentation: `abyss` (deep-sea dark) and `pop` (anime candy). Switch by setting `data-theme` on `<html>`.

## Lagoon Tokens (canonical)

| Token | Value | Use |
|---|---|---|
| `--bg` | `#eef6fb` | Page background |
| `--bg-2` | `#e2eef7` | Alternating sections |
| `--deep` | `#dbe9f3` | Inputs, sunken surfaces |
| `--surface` | `#ffffff` | Card foreground |
| `--surface-2` | `#f2f8fc` | Card secondary |
| `--surface-3` | `#e7f1f8` | Card tertiary / pill bg |
| `--border` | `#cfe0ed` | Default border |
| `--border-soft` | `#e0ebf4` | Subtle divider |
| `--text` | `#0e2c43` | Primary text |
| `--text-dim` | `#4f718d` | Body text |
| `--text-faint` | `#90a9bd` | Tertiary text |
| `--accent` | `#1f8fd1` | Brand blue (Sui-aligned) |
| `--accent-2` | `#f86a44` | Coral (sell side, danger) |
| `--seal` | `#5a4cf0` | Sealed/encrypted state |
| `--good` | `#13955f` | Settled, verified |
| `--warn` | `#c47e00` | Locked, funding |
| `--bad` | `#d8385c` | Error, refused |

## Typography

| Use | Font (next/font Google) | Weight |
|---|---|---|
| Display (headings, buttons) | **Baloo 2** | 500/600/700/800 |
| Body | **Plus Jakarta Sans** | 400-800 + italic |
| Mono (hashes, blobIds, code) | **Space Mono** | 400/700 |
| Italic accent (hero) | Georgia (system) | italic |

CSS vars: `--font-display` / `--font-body` / `--font-mono`.

## Mascot Pip

`components/mascot.tsx` — hand-built SVG seahorse, anime eyes (big glossy iris + lash + sparkle on reveal).

**Poses:** `idle` · `sealing` (lock+tail curl) · `sealed` · `reveal` (sparkle eyes) · `proud` (green check) · `thinking` (look up + dots).

**Palettes:** `coral` (default) · `jelly` · `mint` · `gold`. Set globally via component prop.

## Routes

| Route | What |
|---|---|
| `/` | Marketing landing — Nav, immersive lagoon hero, Problem, How (5-step), Why, Security, Stack, Footer CTA |
| `/app` | Interactive prototype — header (logo, top nav, network pill, role toggle), Board / Seal / Deal / Vault views with state machine + Seal/Settle ceremonies |

## Voice

Trader-direct, not corporate. Not "Where X meets Y" template. Use concrete verbs ("Move size", "Stop trusting the desk"). Pip narrates with personality but never breaks the financial credibility.

## Animations

All defined in `globals.css`: `floaty` · `rise` · `sway` · `popIn` · `pulseGlow` · `spin` · `bob` · `driftA/B` · `fishSwim` · `glowPulse`.

## Future Work

When integrating real backend (Sui Seal + Walrus + Tatum RPC):
- Replace `lib/data.ts` mock data with API calls
- `SealCeremony` / `SettleCeremony` step durations should drive from actual on-chain progress events
- `TermsPanel` decrypt animation should trigger from real Seal key release callback
- Mock identifiers (`blobId()`, `digest()`, `objId()`) should be replaced with real ones
