"use client";
// Self-recording pitch deck. The user clicks one button, the browser asks
// them to "share this tab WITH audio", then a 10-slide auto-advance + TTS
// narration runs for ~2:45. The whole thing is captured via MediaRecorder
// and downloaded as a single .webm at the end.
//
// Why this works without ffmpeg/Playwright/server-side TTS:
// - SpeechSynthesisUtterance plays audio through the page's tab
// - getDisplayMedia({video, audio}) with "Share tab audio" checked
//   captures BOTH the visuals and the TTS audio in one MediaStream
// - MediaRecorder serializes that stream to a Blob
// - URL.createObjectURL + auto-click <a download> triggers the save
//
// User flow:
//   1. Open /slide/record
//   2. Click "Start recording"
//   3. Browser prompt: pick "Chrome Tab" → THIS tab → check "Share tab audio"
//   4. Watch (don't switch tabs) for ~3 min
//   5. Auto-download as sealed-pair-pitch.webm

import { useCallback, useEffect, useRef, useState } from "react";

type Slide = {
  duration: number; // ms — how long to show this slide
  narration: string; // what the TTS engine reads aloud
  visual: React.ReactNode; // what's painted
};

// Narration mirrors docs/SLIDE_SCRIPT.md. Each duration is generous on
// purpose so the TTS engine reliably finishes speaking before we advance.
const SLIDES: Slide[] = [
  {
    duration: 16_000,
    narration:
      "OTC trading on Sui today forces a brutal trade-off. Post on a DEX and the mempool front-runs your size. Call a desk and trust them with the spread. Both leak information. Neither leaves an audit trail. Sealed Pair is a third option.",
    visual: <Cover />,
  },
  {
    duration: 20_000,
    narration:
      "DEXes leak. Mempool sees your order before it fills, slippage takes the rest. OTC desks ghost. They see the spread. Settlement drags for days. And after the trade, try proving to your DAO what you agreed to. The paper trail sits off-chain, if it exists at all.",
    visual: <Problem />,
  },
  {
    duration: 22_000,
    narration:
      "Maker encrypts the terms locally and uploads the ciphertext to Walrus. The blob ID is the cryptographic commitment. A sealed quote hits the public RFQ board — takers see only the size band, never the price. Taker funds a refundable escrow on Sui. The escrow is what satisfies the Seal access policy. The instant the policy is met, the key releases. Terms decrypt for both sides. A single atomic transaction settles both legs.",
    visual: <Shape />,
  },
  {
    duration: 16_000,
    narration:
      "We surveyed all 599 Sui Overflow 2025 submissions. Plenty use one of these primitives. Nobody combines commit-reveal, plus Seal-style selective disclosure, plus Walrus content addressing, plus atomic settlement, for OTC. This is the gap we filled.",
    visual: <WhyWins />,
  },
  {
    duration: 18_000,
    narration:
      "Fourteen distinct Sui RPC methods through the Tatum gateway. Three networks, devnet, testnet, mainnet, auto-switching. Four Tatum products wired end-to-end. Sixty-nine millisecond median latency, probed live every thirty seconds.",
    visual: <TatumDepth />,
  },
  {
    duration: 18_000,
    narration:
      "The insight that drove this build: blob ID is the BLAKE2b hash of the ciphertext. Storing it on-chain in the Move Order object turns Walrus from a CDN into a content-addressed cryptographic commitment. Swap the bytes anywhere, and the commitment provably breaks.",
    visual: <WalrusDepth />,
  },
  {
    duration: 14_000,
    narration:
      "Forty features in fourteen days. Solo build. Seventy-plus QA findings across eleven rounds, all patched. Five Move atomic transactions wired live. Two settled trades on-chain right now.",
    visual: <Features />,
  },
  {
    duration: 18_000,
    narration:
      "Tatum's official MCP server ships ten Blockchain Data tools across twenty-plus chains. EVM, Bitcoin, Solana, Cardano. Sui is not one of them yet. Our four read-only MCP tools fill that gap with Sui-native semantics. Compose both servers, an AI agent gets first-class Sui plus twenty-two other chains in one config.",
    visual: <McpGap />,
  },
  {
    duration: 14_000,
    narration:
      "Mapped to every judging weight. Walrus and Tatum integration. Technical quality. Creativity. Presentation. Best Walrus Integration: blob ID as on-chain commitment. Best Use of Tatum Tools: fourteen methods plus the MCP gap-fill.",
    visual: <Judging />,
  },
  {
    duration: 12_000,
    narration:
      "Stop trusting the desk. Sealed Pair. Private quotes. Public settlement. On Sui.",
    visual: <CTA />,
  },
];

export default function RecordPage() {
  const [phase, setPhase] = useState<"idle" | "recording" | "done" | "error">("idle");
  const [slideIdx, setSlideIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const cancelRef = useRef(false);

  // Pre-warm TTS: some browsers don't load voices until the first speak() call.
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.speechSynthesis?.getVoices();
  }, []);

  const speak = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (typeof window === "undefined" || !window.speechSynthesis) {
        resolve();
        return;
      }
      const u = new SpeechSynthesisUtterance(text);
      // Pick an English voice if available; the default is often a robotic one.
      const voices = window.speechSynthesis.getVoices();
      const en = voices.find((v) => v.lang.startsWith("en") && v.name.toLowerCase().includes("natural"))
        ?? voices.find((v) => v.lang.startsWith("en"));
      if (en) u.voice = en;
      u.rate = 1.0;
      u.pitch = 1.0;
      u.onend = () => resolve();
      u.onerror = () => resolve(); // never block
      window.speechSynthesis.speak(u);
    });
  }, []);

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const runDeck = useCallback(async () => {
    for (let i = 0; i < SLIDES.length; i++) {
      if (cancelRef.current) return;
      setSlideIdx(i);
      // Kick off speech and a slide-duration timer in parallel; whichever
      // completes later determines when we advance.
      await Promise.all([
        speak(SLIDES[i].narration),
        sleep(SLIDES[i].duration),
      ]);
    }
  }, [speak]);

  const start = useCallback(async () => {
    setError(null);
    setDownloadUrl(null);
    cancelRef.current = false;

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getDisplayMedia) {
      setError("Your browser doesn't expose getDisplayMedia. Use latest Chrome or Edge.");
      setPhase("error");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: true,
        // selfBrowserSurface + preferCurrentTab hint the picker to allow this
        // tab; not in the type definitions yet so cast to bypass strictness.
        ...(({ selfBrowserSurface: "include", preferCurrentTab: true }) as object),
      } as DisplayMediaStreamOptions);
    } catch (e) {
      setError(
        "Screen-share was cancelled. Click Start, pick THIS tab, and check \"Share tab audio\" so the narration is captured.",
      );
      setPhase("error");
      return;
    }

    // Wait for the picker to settle and audio track to be ready.
    const hasAudio = stream.getAudioTracks().length > 0;
    if (!hasAudio) {
      setError(
        "No audio in the captured stream — re-run and tick \"Share tab audio\" in the picker (it's the checkbox at the bottom of the Chrome Tab dialog).",
      );
      stream.getTracks().forEach((t) => t.stop());
      setPhase("error");
      return;
    }

    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : "video/webm";
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2_500_000 });
    chunksRef.current = [];
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunksRef.current, { type: mime });
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setPhase("done");
      // Trigger save right away so the user doesn't have to hunt for the
      // button — they can still re-download via the link below.
      const a = document.createElement("a");
      a.href = url;
      a.download = "sealed-pair-pitch.webm";
      document.body.appendChild(a);
      a.click();
      a.remove();
    };
    recorderRef.current = rec;
    rec.start();
    setPhase("recording");

    // Run the deck; when done, stop recording.
    await runDeck();
    if (cancelRef.current) {
      rec.stop();
      return;
    }
    // Tiny tail so the last word of narration lands inside the file.
    await sleep(1500);
    rec.stop();
  }, [runDeck]);

  const stop = () => {
    cancelRef.current = true;
    recorderRef.current?.stop();
  };

  const slide = SLIDES[slideIdx];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        color: "var(--text)",
        display: "grid",
        placeItems: "center",
        padding: "40px 20px",
      }}
    >
      {phase === "idle" || phase === "error" ? (
        <div style={{ maxWidth: 720, textAlign: "center" }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 48, marginBottom: 12 }}>
            Self-recording pitch
          </h1>
          <p style={{ color: "var(--text-dim)", fontSize: 16, lineHeight: 1.55, marginBottom: 24 }}>
            Click Start. When Chrome asks, pick <b>this tab</b> and <b>check &quot;Share tab audio&quot;</b>.
            The 10-slide deck auto-plays with narration for ~2:45 and downloads as a .webm.
            Don&apos;t switch tabs during recording.
          </p>
          <ol style={{ textAlign: "left", display: "inline-block", color: "var(--text-dim)", fontSize: 14, lineHeight: 1.8 }}>
            <li>Click <b>Start recording</b></li>
            <li>Picker opens → click <b>Chrome Tab</b></li>
            <li>Pick this tab (its title contains &quot;Self-recording&quot;)</li>
            <li>Check ✅ <b>Share tab audio</b> at the bottom</li>
            <li>Click <b>Share</b></li>
            <li>Wait ~2:45 — file downloads when done</li>
          </ol>
          {error && (
            <div
              style={{
                marginTop: 22, padding: "12px 16px",
                background: "color-mix(in oklab, var(--bad) 12%, var(--surface))",
                border: "1px solid var(--bad)", color: "var(--bad)",
                borderRadius: 8, fontSize: 14,
              }}
            >
              {error}
            </div>
          )}
          <button
            onClick={start}
            style={{
              marginTop: 24,
              background: "var(--accent)", color: "var(--accent-ink)",
              border: "none", padding: "16px 32px", borderRadius: 999,
              fontSize: 16, fontWeight: 800, cursor: "pointer",
            }}
          >
            ▶ Start recording
          </button>
        </div>
      ) : phase === "recording" ? (
        <div style={{ width: "100%", maxWidth: 1100 }}>
          <div
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: 20, fontSize: 13, color: "var(--text-faint)",
              fontFamily: "var(--font-mono)",
            }}
          >
            <span>
              🔴 Recording · slide {slideIdx + 1} / {SLIDES.length}
            </span>
            <button onClick={stop} style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text-dim)", padding: "6px 14px", borderRadius: 99, fontSize: 12, cursor: "pointer" }}>
              Stop early
            </button>
          </div>
          <div
            style={{
              aspectRatio: "16 / 9",
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: 16, padding: 40, overflow: "hidden",
              display: "flex", flexDirection: "column", justifyContent: "center",
            }}
          >
            {slide.visual}
          </div>
          <div
            style={{
              marginTop: 16, padding: 18,
              background: "var(--deep)", border: "1px solid var(--border-soft)",
              borderRadius: 12, color: "var(--text-dim)", fontSize: 14, lineHeight: 1.55,
              fontStyle: "italic",
            }}
          >
            {slide.narration}
          </div>
        </div>
      ) : (
        <div style={{ textAlign: "center", maxWidth: 600 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 40, marginBottom: 12, color: "var(--good)" }}>
            ✓ Done — file downloaded
          </h1>
          <p style={{ color: "var(--text-dim)", fontSize: 15, lineHeight: 1.6, marginBottom: 22 }}>
            <code>sealed-pair-pitch.webm</code> should be in your Downloads folder. Upload to
            YouTube (set Unlisted) for the hackathon form. If the auto-download didn&apos;t fire,
            use the button below.
          </p>
          {downloadUrl && (
            <a
              href={downloadUrl}
              download="sealed-pair-pitch.webm"
              style={{
                display: "inline-block",
                background: "var(--accent)", color: "var(--accent-ink)",
                padding: "12px 24px", borderRadius: 999, fontWeight: 800,
                textDecoration: "none",
              }}
            >
              Download again
            </a>
          )}
          <div style={{ marginTop: 30 }}>
            <button
              onClick={() => { setPhase("idle"); setSlideIdx(0); setDownloadUrl(null); }}
              style={{
                background: "transparent", border: "1px solid var(--border)",
                color: "var(--text-dim)", padding: "10px 22px", borderRadius: 99,
                cursor: "pointer",
              }}
            >
              ↻ Record another take
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* =============== inline slide visuals — minimal, deck-style =============== */

function Cover() {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 14, color: "var(--text-faint)", fontFamily: "var(--font-mono)", letterSpacing: ".18em", textTransform: "uppercase", marginBottom: 12 }}>
        Tatum × Walrus · Build on Sui · June 2026
      </div>
      <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 88, letterSpacing: "-.04em", lineHeight: 1, margin: 0 }}>
        Sealed Pair
      </h1>
      <div style={{ marginTop: 22, fontSize: 22, color: "var(--text-dim)", maxWidth: 720, margin: "22px auto 0" }}>
        Sealed peer-to-peer OTC trading on Sui.
      </div>
    </div>
  );
}

function Problem() {
  return (
    <div>
      <Kicker>The problem</Kicker>
      <H>OTC trading today is a brutal trade-off</H>
      <Grid cols={3}>
        <Card title="Trade it on a DEX" tone="var(--bad)" body="The mempool front-runs you. Slippage takes the rest." />
        <Card title="Call an OTC desk" tone="var(--warn)" body="Now you trust a middleman. They see the spread." />
        <Card title="No audit trail" tone="var(--text-faint)" body="Try proving to your DAO what you agreed to." />
      </Grid>
    </div>
  );
}

function Shape() {
  return (
    <div>
      <Kicker>The shape</Kicker>
      <H>Sealed Pair: a third option</H>
      <Grid cols={5}>
        {["Seal", "Discover", "Escrow", "Reveal", "Settle"].map((n, i) => (
          <Card key={n} num={`0${i + 1}`} title={n} tone="var(--accent)" body="" />
        ))}
      </Grid>
    </div>
  );
}

function WhyWins() {
  return (
    <div>
      <Kicker>Why it wins</Kicker>
      <H>Nobody else built this combination</H>
      <ul style={{ marginTop: 30, fontSize: 22, color: "var(--text)", lineHeight: 1.7 }}>
        <li>✓ Commit-reveal — blobId IS the commitment</li>
        <li>✓ Seal-style selective disclosure</li>
        <li>✓ Walrus content addressing</li>
        <li>✓ Atomic PTB settlement</li>
      </ul>
    </div>
  );
}

function TatumDepth() {
  return (
    <div>
      <Kicker>Tatum integration</Kicker>
      <H>14 Sui RPC methods · 4 product surfaces</H>
      <Grid cols={4}>
        <Stat n="14" label="distinct Sui RPC methods" />
        <Stat n="3" label="networks · dev / test / main" />
        <Stat n="4" label="Tatum products wired" />
        <Stat n="69ms" label="median gateway latency" />
      </Grid>
    </div>
  );
}

function WalrusDepth() {
  return (
    <div>
      <Kicker>Walrus integration</Kicker>
      <H>Walrus as cryptographic commitment</H>
      <div style={{ marginTop: 26, padding: "22px 28px", background: "color-mix(in oklab, var(--accent-2) 10%, var(--surface))", border: "1px solid var(--accent-2)", borderRadius: 12, fontSize: 22, lineHeight: 1.5 }}>
        <b style={{ color: "var(--accent-2)" }}>The insight:</b> blobId is the BLAKE2b hash of the ciphertext.
        Stored on-chain → Walrus becomes a content-addressed cryptographic commitment, not a CDN.
      </div>
    </div>
  );
}

function Features() {
  return (
    <div>
      <Kicker>What we shipped</Kicker>
      <H>40 features, 14 days, one solo build</H>
      <Grid cols={4}>
        <Stat n="70+" label="QA findings · 11 rounds" />
        <Stat n="5" label="Move PTBs wired live" />
        <Stat n="2" label="settled on-chain right now" />
        <Stat n="15" label="backend routes · all green" />
      </Grid>
    </div>
  );
}

function McpGap() {
  return (
    <div>
      <Kicker>AI surface</Kicker>
      <H>Sui-native MCP — filling a real gap</H>
      <div style={{ marginTop: 22, padding: "18px 22px", background: "color-mix(in oklab, var(--seal-glow) 10%, var(--surface))", border: "1px solid var(--seal-glow)", borderRadius: 12, fontSize: 18 }}>
        <b style={{ color: "var(--seal-glow)" }}>The gap:</b> Tatum&apos;s official MCP ships 10 Blockchain Data tools across 22+ chains — but Sui isn&apos;t one of them. We ship the Sui-native layer.
      </div>
    </div>
  );
}

function Judging() {
  return (
    <div>
      <Kicker>Judging criteria</Kicker>
      <H>Mapped to every weight</H>
      <ul style={{ marginTop: 26, fontSize: 18, color: "var(--text-dim)", lineHeight: 1.85 }}>
        <li>Walrus + Tatum integration · 30% · 14 RPC · commitment-grade Walrus</li>
        <li>Technical quality · 30% · strict TS, atomic PTBs, 70+ QA fixes</li>
        <li>Creativity · 20% · the combination nobody else built</li>
        <li>Presentation · 20% · live demo, README, this deck</li>
      </ul>
    </div>
  );
}

function CTA() {
  return (
    <div style={{ textAlign: "center" }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 60, lineHeight: 1.05, margin: 0 }}>
        Stop trusting the desk.
      </h1>
      <div style={{ marginTop: 28, fontSize: 20, color: "var(--text-dim)" }}>
        sealed-pair.vercel.app · github.com/PugarHuda/sealed-pair
      </div>
      <div style={{ marginTop: 32, fontSize: 13, color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
        Sealed Pair · Tatum · Walrus · Sui
      </div>
    </div>
  );
}

/* =============== tiny visual atoms =============== */

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 14, color: "var(--seal-glow)", letterSpacing: ".14em", textTransform: "uppercase", fontWeight: 700, marginBottom: 12 }}>
      {children}
    </div>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 48, lineHeight: 1.05, margin: 0 }}>{children}</h2>;
}

function Grid({ cols, children }: { cols: number; children: React.ReactNode }) {
  return (
    <div
      style={{
        marginTop: 30,
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: 16,
      }}
    >
      {children}
    </div>
  );
}

function Card({ title, body, tone, num }: { title: string; body: string; tone: string; num?: string }) {
  return (
    <div style={{ background: "var(--deep)", border: `1px solid ${tone}`, borderRadius: 12, padding: "18px 16px" }}>
      {num && <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: tone, fontWeight: 800, marginBottom: 8 }}>{num}</div>}
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, marginBottom: 6 }}>{title}</div>
      {body && <div style={{ fontSize: 13.5, color: "var(--text-dim)", lineHeight: 1.45 }}>{body}</div>}
    </div>
  );
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div style={{ background: "var(--deep)", border: "1px solid var(--accent)", borderRadius: 12, padding: "18px 14px" }}>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 38, color: "var(--accent)", lineHeight: 1 }}>{n}</div>
      <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 8 }}>{label}</div>
    </div>
  );
}
