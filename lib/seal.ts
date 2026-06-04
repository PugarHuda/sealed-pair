// Sui Seal threshold-encryption client (scaffold).
//
// What this file does today:
//   - Imports @mysten/seal types so TypeScript stays valid.
//   - Exports a clean interface (`encryptForOrder` / `decryptForOrder`) that
//     other code can call. The current implementation defers to the AES-GCM
//     baseline in lib/crypto.ts.
//   - Has the full Seal wiring documented inline as commented-out code,
//     ready to flip on once:
//       (a) the Move package is deployed with the `seal_approve` function
//           (already added in move/sources/order.move),
//       (b) the user can sign a personal message with their wallet to
//           create a SessionKey, and
//       (c) we pick a key-server config for testnet (Mysten operators —
//           see https://seal-docs.wal.app/ for the canonical objectIds).
//
// Why scaffold instead of full wire: D4's hard gate is 18:00 WIB. Seal
// real-wiring requires (a) wallet message-signature flow, (b) on-chain
// re-deploy with seal_approve exposed, (c) verified key-server objectIds.
// Any one of those slipping eats D5/D6. The scaffold ships the *contract*
// to Seal and lets us flip to it later without touching call sites.
//
// Public API mirrors lib/crypto.ts so call sites swap with a one-line
// import change.

// SEALED_PAIR_PACKAGE_ID is imported by the commented-out Seal target
// branch below. Keep the comment so the wiring path stays readable.
import {
  encryptText as aesEncrypt,
  decryptText as aesDecrypt,
  generateKey as aesGenerateKey,
  stashKey as aesStashKey,
  loadKey as aesLoadKey,
} from "@/lib/crypto";

// Same key abstraction for both backends; Web Crypto's CryptoKey is
// available in both browser and Node runtimes that Next.js targets.
type AnyKey = CryptoKey;

/** Identifier scheme for Seal: each Order gets a unique `id` namespace. */
export function sealIdentityFor(orderId: number, blobId: string): string {
  // Seal `id` is opaque bytes within a packageId namespace. We use the
  // tuple (orderId, blobId) so two different orders can never share a key.
  return `${orderId}:${blobId}`;
}

/**
 * Encrypt the JSON-serialised terms for an Order. Returns ciphertext bytes.
 *
 * Today: AES-GCM with a sessionStorage-stashed key (lib/crypto.ts path).
 * Tomorrow: SealClient.encrypt(...) returning a threshold-encrypted blob
 * decryptable only when seal_approve(...) on-chain returns true.
 */
export async function encryptForOrder(
  plaintext: string,
  _identity: string,
): Promise<{ ciphertext: Uint8Array; key: AnyKey; backend: "aes" | "seal" }> {
  // ---- AES baseline (active today) ----
  const key = await aesGenerateKey();
  const ciphertext = await aesEncrypt(plaintext, key);
  return { ciphertext, key, backend: "aes" };

  // ---- Seal target (commented until D4 gate clears) ----
  /*
  if (!SEALED_PAIR_PACKAGE_ID) throw new Error("Package not deployed");
  const sealClient = new SealClient({
    suiClient,                 // from dApp Kit's useSuiClient()
    serverConfigs: KEY_SERVERS,
    verifyKeyServers: true,
  });
  const { encryptedObject, key } = await sealClient.encrypt({
    kemType: KemType.BonehFranklinBLS12381,
    demType: DemType.AesGcm,
    threshold: 2,              // 2-of-N key servers required to decrypt
    packageId: SEALED_PAIR_PACKAGE_ID,
    id: identity,              // sealIdentityFor(orderId, blobId)
    data: new TextEncoder().encode(plaintext),
  });
  return { ciphertext: encryptedObject, key, backend: "seal" };
  */
}

/**
 * Decrypt a previously-sealed Order back to its JSON terms.
 *
 * Today: AES-GCM with key from sessionStorage (must have been stashed by the
 * same browser session that encrypted).
 * Tomorrow: build a PTB calling `seal_approve(order, sender)`, sign with the
 * wallet to mint a SessionKey, hand both to SealClient.decrypt — works
 * across browsers/devices.
 */
export async function decryptForOrder(
  ciphertext: ArrayBuffer | Uint8Array,
  blobId: string,
  _identity: string,
): Promise<string> {
  // ---- AES baseline ----
  const key = await aesLoadKey(blobId);
  if (!key) throw new Error("no key in sessionStorage; needs Seal SDK wired");
  return aesDecrypt(ciphertext, key);

  // ---- Seal target ----
  /*
  const sessionKey = new SessionKey({
    address: account.address,
    packageId: SEALED_PAIR_PACKAGE_ID!,
    ttlMin: 10,
  });
  const personalMessage = sessionKey.getPersonalMessage();
  const signature = await signPersonalMessage({ message: personalMessage });
  sessionKey.setPersonalMessageSignature(signature.signature);

  const tx = new Transaction();
  tx.moveCall({
    target: `${SEALED_PAIR_PACKAGE_ID}::order::seal_approve`,
    arguments: [tx.object(orderObjectId), tx.pure.address(account.address)],
  });
  const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: true });

  return new TextDecoder().decode(
    await sealClient.decrypt({ data: new Uint8Array(ciphertext), sessionKey, txBytes }),
  );
  */
}

/** Compatibility helper for SealCeremony's stash step. */
export async function stashForOrder(blobId: string, key: AnyKey): Promise<void> {
  return aesStashKey(blobId, key as CryptoKey);
}

/**
 * Testnet Seal key servers, harvested from Mysten Labs operator announcements.
 * Replace `objectId` with the actual canonical values from
 * https://seal-docs.wal.app/ before flipping to the Seal backend.
 */
export const KEY_SERVERS_TESTNET: { objectId: string; weight: number }[] = [
  // { objectId: "0x...", weight: 1 },   // Ruby Nodes
  // { objectId: "0x...", weight: 1 },   // NodeInfra
  // { objectId: "0x...", weight: 1 },   // Studio Mirai
  // { objectId: "0x...", weight: 1 },   // Overclock
  // { objectId: "0x...", weight: 1 },   // H2O Nodes
  // { objectId: "0x...", weight: 1 },   // Triton One
  // { objectId: "0x...", weight: 1 },   // Enoki by Mysten Labs
];
