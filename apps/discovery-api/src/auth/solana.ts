import crypto from "node:crypto";
import bs58 from "bs58";
import nacl from "tweetnacl";
import type { ChallengeStore } from "./challenge-store.js";
import { InMemoryChallengeStore } from "./challenge-store.js";

export type { AuthChallenge, ChallengeStore } from "./challenge-store.js";
export { InMemoryChallengeStore } from "./challenge-store.js";

let store: ChallengeStore = new InMemoryChallengeStore();

/** Inject memory or Postgres challenge persistence. Defaults to in-memory. */
export function setChallengeStore(next: ChallengeStore): void {
  store = next;
}

export function getChallengeStore(): ChallengeStore {
  return store;
}

export async function createChallenge(walletAddress: string, ttlMinutes = 10) {
  // Validate early so malformed public keys never become session identifiers.
  const publicKey = bs58.decode(walletAddress);
  if (publicKey.length !== nacl.sign.publicKeyLength) throw new Error("Invalid Solana wallet address");

  const nonce = crypto.randomBytes(16).toString("hex");
  const expiresAt = Date.now() + ttlMinutes * 60_000;
  const message = [
    "ValueCurator Discovery Agent",
    "",
    "Sign this message to authenticate your research session.",
    "This signature does not authorize a transaction or financial action.",
    "",
    `Wallet: ${walletAddress}`,
    `Nonce: ${nonce}`,
    `Expires: ${new Date(expiresAt).toISOString()}`
  ].join("\n");

  const challenge = { nonce, message, expiresAt };
  await store.put(walletAddress, challenge);
  return challenge;
}

export async function verifyChallenge(
  walletAddress: string,
  nonce: string,
  signatureBase58: string,
): Promise<boolean> {
  const challenge = await store.get(walletAddress);
  if (!challenge || challenge.nonce !== nonce || challenge.expiresAt < Date.now()) return false;

  try {
    const publicKey = bs58.decode(walletAddress);
    const signature = bs58.decode(signatureBase58);
    const ok = nacl.sign.detached.verify(
      new TextEncoder().encode(challenge.message),
      signature,
      publicKey
    );
    if (ok) await store.delete(walletAddress); // one-time challenge
    return ok;
  } catch {
    return false;
  }
}
