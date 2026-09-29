import crypto from "node:crypto";
import bs58 from "bs58";
import nacl from "tweetnacl";

type Challenge = { nonce: string; message: string; expiresAt: number };
const challenges = new Map<string, Challenge>();

export function createChallenge(walletAddress: string, ttlMinutes = 10): Challenge {
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
  challenges.set(walletAddress, challenge);
  return challenge;
}

export function verifyChallenge(walletAddress: string, nonce: string, signatureBase58: string): boolean {
  const challenge = challenges.get(walletAddress);
  if (!challenge || challenge.nonce !== nonce || challenge.expiresAt < Date.now()) return false;

  try {
    const publicKey = bs58.decode(walletAddress);
    const signature = bs58.decode(signatureBase58);
    const ok = nacl.sign.detached.verify(
      new TextEncoder().encode(challenge.message),
      signature,
      publicKey
    );
    if (ok) challenges.delete(walletAddress); // one-time challenge
    return ok;
  } catch {
    return false;
  }
}
