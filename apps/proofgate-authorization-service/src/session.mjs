import { randomBytes } from "node:crypto";
import nacl from "tweetnacl";
import { PublicKey } from "@solana/web3.js";

const CHALLENGE_TTL_SECONDS = 120;
const MAX_PER_MINUTE = 20;

export function signWalletMessage(message, secretKey) {
  return Buffer.from(nacl.sign.detached(Buffer.from(message), Uint8Array.from(secretKey))).toString("base64");
}

export function walletMessage({ host, owner, nonce, expiresAt }) {
  return [
    "valuecurator-proofgate-lab/wallet-v1",
    `domain:${host}`,
    `owner:${owner}`,
    `nonce:${nonce}`,
    `expires:${expiresAt}`,
  ].join("\n");
}

export function createSessionStore({ now = () => Date.now() } = {}) {
  const challenges = new Map();
  const hits = new Map();

  function seconds() {
    return Math.floor(now() / 1000);
  }

  function allow(key) {
    const windowStart = seconds() - 60;
    const recent = (hits.get(key) ?? []).filter((stamp) => stamp >= windowStart);
    if (recent.length >= MAX_PER_MINUTE) {
      hits.set(key, recent);
      return false;
    }
    recent.push(seconds());
    hits.set(key, recent);
    return true;
  }

  function issue({ owner, host }) {
    let publicKey;
    try {
      publicKey = new PublicKey(owner);
      if (publicKey.toBase58() !== owner) return { ok: false, error: "owner is not canonical base58" };
    } catch {
      return { ok: false, error: "owner is not a public key" };
    }
    const nonce = randomBytes(16).toString("hex");
    const expiresAt = seconds() + CHALLENGE_TTL_SECONDS;
    const message = walletMessage({ host, owner, nonce, expiresAt });
    challenges.set(nonce, { owner, host, expiresAt, message, used: false });
    return { ok: true, nonce, expiresAt, message, domain: host };
  }

  function consume({ owner, host, nonce, signature }) {
    const record = challenges.get(nonce);
    if (!record) return { ok: false, error: "authentication challenge is unknown" };
    if (record.used) return { ok: false, error: "authentication challenge was already used" };
    if (record.owner !== owner || record.host !== host) return { ok: false, error: "authentication challenge does not match this owner" };
    if (record.expiresAt < seconds()) return { ok: false, error: "authentication challenge expired" };
    let signatureBytes;
    try {
      signatureBytes = Buffer.from(signature, "base64");
    } catch {
      return { ok: false, error: "authentication signature is not base64" };
    }
    if (signatureBytes.length !== 64) return { ok: false, error: "authentication signature has the wrong length" };
    const verified = nacl.sign.detached.verify(
      Buffer.from(record.message),
      signatureBytes,
      new PublicKey(owner).toBytes(),
    );
    if (!verified) return { ok: false, error: "authentication signature does not match the owner" };
    record.used = true;
    return { ok: true, owner };
  }

  return { allow, issue, consume, challengeTtlSeconds: CHALLENGE_TTL_SECONDS };
}
