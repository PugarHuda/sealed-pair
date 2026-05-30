// Web Crypto AES-256-GCM helpers. Browser-only (uses globalThis.crypto.subtle).
// This is a placeholder for the demo: a real Seal integration will replace the
// key custody story — but the encryption primitive (AES-GCM) stays the same.
//
// Why AES-GCM:
//   - authenticated (tampering detected on decrypt)
//   - random nonce per encryption (we prepend it to the ciphertext)
//   - matches what Seal documents using under the hood

const IV_LEN = 12;

function getCrypto(): Crypto {
  // Works in browsers and modern Node (server). Throws if neither is available.
  // We default to globalThis.crypto which is standard across both.
  if (typeof crypto !== "undefined" && crypto.subtle) return crypto;
  throw new Error("Web Crypto API unavailable");
}

export async function generateKey(): Promise<CryptoKey> {
  return getCrypto().subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
}

export async function exportKeyBase64(key: CryptoKey): Promise<string> {
  const raw = await getCrypto().subtle.exportKey("raw", key);
  return bytesToBase64(new Uint8Array(raw));
}

export async function importKeyBase64(b64: string): Promise<CryptoKey> {
  const bytes = base64ToBytes(b64);
  return getCrypto().subtle.importKey(
    "raw",
    toArrayBuffer(bytes),
    { name: "AES-GCM" },
    true,
    ["encrypt", "decrypt"],
  );
}

/** Encrypt plaintext (string) → bytes (IV || ciphertext). */
export async function encryptText(text: string, key: CryptoKey): Promise<Uint8Array> {
  const iv = getCrypto().getRandomValues(new Uint8Array(IV_LEN));
  const ptBytes = new TextEncoder().encode(text);
  const cipher = await getCrypto().subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(ptBytes),
  );
  const out = new Uint8Array(iv.byteLength + cipher.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(cipher), iv.byteLength);
  return out;
}

/** Decrypt bytes (IV || ciphertext) → plaintext (string). */
export async function decryptText(packed: ArrayBuffer | Uint8Array, key: CryptoKey): Promise<string> {
  const bytes = packed instanceof Uint8Array ? packed : new Uint8Array(packed);
  if (bytes.byteLength <= IV_LEN) throw new Error("ciphertext too short");
  const iv = bytes.slice(0, IV_LEN);
  const ct = bytes.slice(IV_LEN);
  const plain = await getCrypto().subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(ct),
  );
  return new TextDecoder().decode(plain);
}

/** Convert any Uint8Array into a plain ArrayBuffer (avoids SharedArrayBuffer ambiguity for Web Crypto). */
function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(view.byteLength);
  new Uint8Array(out).set(view);
  return out;
}

/* ---------------- base64 helpers ---------------- */
export function bytesToBase64(b: Uint8Array): string {
  if (typeof window === "undefined") {
    // server (Node) path — wouldn't normally be hit since this file is client-leaning
    return Buffer.from(b).toString("base64");
  }
  let s = "";
  for (let i = 0; i < b.byteLength; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
}

export function base64ToBytes(s: string): Uint8Array {
  if (typeof window === "undefined") {
    return new Uint8Array(Buffer.from(s, "base64"));
  }
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* ---------------- session storage for demo key custody ---------------- */
// In production this will be replaced by Sui Seal threshold encryption.
// For the demo, both maker and taker run in the same browser session, so we
// can stash the symmetric key in sessionStorage keyed by blobId.
const KEY_PREFIX = "sp:key:";

export async function stashKey(blobId: string, key: CryptoKey): Promise<void> {
  const b64 = await exportKeyBase64(key);
  sessionStorage.setItem(KEY_PREFIX + blobId, b64);
}

export async function loadKey(blobId: string): Promise<CryptoKey | null> {
  const b64 = sessionStorage.getItem(KEY_PREFIX + blobId);
  if (!b64) return null;
  return importKeyBase64(b64);
}
