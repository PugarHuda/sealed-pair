// scripts/render-video.mjs
//
// Render two videos:
//   1. pitch.mp4  — 10-slide pitch deck (auto-advance, narrated)
//   2. demo.mp4   — live walkthrough of sealed-pair.vercel.app (narrated)
//
// Pipeline per video:
//   - Playwright opens the live site
//   - Per scene: navigate, wait, take a high-res screenshot
//   - Each scene gets the matching pre-rendered WAV (from scripts/out/audio/)
//   - ffmpeg makes a per-scene mp4 (still image + audio, duration = audio length)
//   - ffmpeg concats them into a single output mp4
//
// Why this design: we DON'T need to record live mouse movement to make a
// convincing pitch — screenshots of the live site + matched narration is
// what "demo" videos actually do. The output looks like a hand-edited
// walkthrough; it's fully reproducible.
//
// Run:
//   node scripts/render-video.mjs            # both videos
//   node scripts/render-video.mjs --only=pitch
//   node scripts/render-video.mjs --only=demo
//   node scripts/render-video.mjs --base=https://sealed-pair.vercel.app
//
// Outputs land in scripts/out/

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

const FFMPEG = ffmpegInstaller.path;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(__dirname, "out");
const SHOTS_DIR = path.join(OUT_DIR, "shots");
const AUDIO_DIR = path.join(OUT_DIR, "audio");
const SCENES_DIR = path.join(OUT_DIR, "scenes");
[OUT_DIR, SHOTS_DIR, SCENES_DIR].forEach((d) => fs.mkdirSync(d, { recursive: true }));

const argv = process.argv.slice(2);
const arg = (n, d) => { const m = argv.find((a) => a.startsWith(`${n}=`)); return m ? m.split("=")[1] : d; };
const BASE = arg("--base", "https://sealed-pair.vercel.app");
const ONLY = arg("--only", "");

const SIZE = { width: 1920, height: 1080 };

const log = (s) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${s}`);

/** Spawn ffmpeg, resolve on exit 0. */
function ff(args) {
  return new Promise((resolve, reject) => {
    const p = spawn(FFMPEG, args, { stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => { err += d.toString(); });
    p.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exit ${code}: ${err.slice(-400)}`));
    });
  });
}

/** Build one scene clip: still image + audio → mp4 (duration == audio length). */
async function buildScene({ id, imagePath, audioPath, outPath, fallbackSeconds }) {
  const haveAudio = fs.existsSync(audioPath);
  if (haveAudio) {
    await ff([
      "-y", "-loglevel", "error",
      "-loop", "1", "-i", imagePath,
      "-i", audioPath,
      "-c:v", "libx264", "-tune", "stillimage", "-pix_fmt", "yuv420p",
      "-r", "30", "-vf", "scale=1920:1080,format=yuv420p",
      "-c:a", "aac", "-b:a", "192k",
      "-shortest",
      outPath,
    ]);
  } else {
    log(`  no audio for ${id} — using ${fallbackSeconds}s of silence`);
    await ff([
      "-y", "-loglevel", "error",
      "-loop", "1", "-i", imagePath,
      "-f", "lavfi", "-t", String(fallbackSeconds), "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
      "-c:v", "libx264", "-tune", "stillimage", "-pix_fmt", "yuv420p",
      "-r", "30", "-vf", "scale=1920:1080,format=yuv420p",
      "-c:a", "aac", "-b:a", "192k",
      "-t", String(fallbackSeconds),
      outPath,
    ]);
  }
}

/** Concat scene clips into one mp4 (re-encode to ensure clean joins). */
async function concatScenes(sceneFiles, outPath) {
  const listPath = path.join(SCENES_DIR, `_concat_${Date.now()}.txt`);
  fs.writeFileSync(listPath, sceneFiles.map((f) => `file '${f.replace(/\\/g, "/")}'`).join("\n"));
  await ff([
    "-y", "-loglevel", "error",
    "-f", "concat", "-safe", "0", "-i", listPath,
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "30",
    "-c:a", "aac", "-b:a", "192k",
    outPath,
  ]);
  fs.unlinkSync(listPath);
}

/* ============== PITCH DECK ============== */

const PITCH_SCENES = [
  { id: "01-cover",   slide: 1,  fallback: 7 },
  { id: "02-problem", slide: 2,  fallback: 9 },
  { id: "03-shape",   slide: 3,  fallback: 11 },
  { id: "04-why",     slide: 4,  fallback: 9 },
  { id: "05-tatum",   slide: 5,  fallback: 9 },
  { id: "06-walrus",  slide: 6,  fallback: 9 },
  { id: "07-shipped", slide: 7,  fallback: 7 },
  { id: "08-mcp",     slide: 8,  fallback: 9 },
  { id: "09-judge",   slide: 9,  fallback: 7 },
  { id: "10-cta",     slide: 10, fallback: 5 },
];

async function renderPitch(browser) {
  log("=== PITCH DECK ===");
  const ctx = await browser.newContext({ viewport: SIZE, deviceScaleFactor: 1 });
  const page = await ctx.newPage();

  const sceneFiles = [];
  for (const s of PITCH_SCENES) {
    const url = `${BASE}/slide?n=${s.slide}`;
    log(`  scene ${s.id} → ${url}`);
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    // Hide the bottom nav strip and the top hint pill for clean screenshots.
    await page.addStyleTag({
      content: `
        footer, [aria-label*="navigate"], [aria-label*="fullscreen"], [aria-label="Previous slide"], [aria-label="Next slide"] { display: none !important; }
        body > div > div:last-child { display: none !important; }  /* footer controls */
      `,
    }).catch(() => {});
    await page.waitForTimeout(400);

    const shot = path.join(SHOTS_DIR, `pitch-${s.id}.png`);
    await page.screenshot({ path: shot, fullPage: false });

    const audio = path.join(AUDIO_DIR, `${s.id}.wav`);
    const scene = path.join(SCENES_DIR, `pitch-${s.id}.mp4`);
    await buildScene({ id: s.id, imagePath: shot, audioPath: audio, outPath: scene, fallbackSeconds: s.fallback });
    sceneFiles.push(scene);
  }

  await ctx.close();
  const outPath = path.join(OUT_DIR, "pitch.mp4");
  log("  concatenating scenes → " + outPath);
  await concatScenes(sceneFiles, outPath);
  log(`  ✓ pitch.mp4 ready (${fs.statSync(outPath).size} bytes)`);
}

/* ============== LIVE DEMO ============== */

const DEMO_SCENES = [
  {
    id: "demo-01-landing",
    fallback: 7,
    nav: async (page) => { await page.goto(`${BASE}/`, { waitUntil: "networkidle" }); await page.waitForTimeout(800); },
  },
  {
    id: "demo-02-board",
    fallback: 9,
    nav: async (page) => {
      await page.goto(`${BASE}/app`, { waitUntil: "networkidle" });
      await page.waitForTimeout(3000);  // let event polling settle
      await page.evaluate(() => window.scrollTo({ top: 280, behavior: "instant" }));
      await page.waitForTimeout(600);
    },
  },
  {
    id: "demo-03-pair",
    fallback: 7,
    nav: async (page) => {
      // Already on /app — scroll to pair depth widget if present.
      await page.evaluate(() => window.scrollTo({ top: 700, behavior: "instant" }));
      await page.waitForTimeout(600);
    },
  },
  {
    id: "demo-04-deal",
    fallback: 7,
    nav: async (page) => {
      // Click first order card. If selector fails, stay on board.
      try {
        await page.locator('a, button').filter({ hasText: /Inspect & fund escrow|Manage offer/ }).first().click({ timeout: 4000 });
        await page.waitForTimeout(2000);
      } catch {
        await page.evaluate(() => window.scrollTo({ top: 1200, behavior: "instant" }));
      }
      await page.waitForTimeout(800);
    },
  },
  {
    id: "demo-05-vault",
    fallback: 9,
    nav: async (page) => {
      await page.goto(`${BASE}/app?view=vault`, { waitUntil: "networkidle" });
      await page.waitForTimeout(3500);
      await page.evaluate(() => window.scrollTo({ top: 400, behavior: "instant" }));
      await page.waitForTimeout(600);
    },
  },
  {
    id: "demo-06-mcp",
    fallback: 7,
    nav: async (page) => {
      await page.goto(`${BASE}/api/mcp`, { waitUntil: "networkidle" });
      await page.waitForTimeout(800);
    },
  },
  {
    id: "demo-07-end",
    fallback: 5,
    nav: async (page) => {
      await page.goto(`${BASE}/slide?n=10`, { waitUntil: "networkidle" });
      await page.waitForTimeout(600);
    },
  },
];

async function renderDemo(browser) {
  log("=== LIVE DEMO ===");
  const ctx = await browser.newContext({ viewport: SIZE, deviceScaleFactor: 1 });
  const page = await ctx.newPage();

  const sceneFiles = [];
  for (const s of DEMO_SCENES) {
    log(`  scene ${s.id}`);
    try { await s.nav(page); } catch (e) { log(`    nav error (continuing): ${e.message}`); }
    const shot = path.join(SHOTS_DIR, `${s.id}.png`);
    await page.screenshot({ path: shot, fullPage: false });

    const audio = path.join(AUDIO_DIR, `${s.id}.wav`);
    const scene = path.join(SCENES_DIR, `${s.id}.mp4`);
    await buildScene({ id: s.id, imagePath: shot, audioPath: audio, outPath: scene, fallbackSeconds: s.fallback });
    sceneFiles.push(scene);
  }

  await ctx.close();
  const outPath = path.join(OUT_DIR, "demo.mp4");
  log("  concatenating scenes → " + outPath);
  await concatScenes(sceneFiles, outPath);
  log(`  ✓ demo.mp4 ready (${fs.statSync(outPath).size} bytes)`);
}

/* ============== MAIN ============== */

(async () => {
  log(`base URL: ${BASE}`);
  log(`ffmpeg:   ${FFMPEG}`);
  log(`output:   ${OUT_DIR}`);

  const browser = await chromium.launch({ headless: true });
  try {
    if (!ONLY || ONLY === "pitch") await renderPitch(browser);
    if (!ONLY || ONLY === "demo")  await renderDemo(browser);
  } finally {
    await browser.close();
  }
  log("done.");
})().catch((e) => { console.error(e); process.exit(1); });
