/**
 * Lab execution is allowed only for an explicit local Surfpool profile.
 * A true flag is not enough. Loopback is not a cryptographic network identity:
 * Surfpool does not expose a genesis hash the program can read.
 */
import { SETTLEMENT_PROGRAM_ID } from "./canonical.mjs";

const MAINNET_HOSTS = new Set([
  "api.mainnet-beta.solana.com",
  "api.mainnet.solana.com",
]);

export function assertLabEnvironment(env) {
  const mode = env.LAB_MODE;
  const rpcUrl = env.LAB_RPC_URL;
  const enabled = env.LAB_EXECUTION_ENABLED;
  const programId = env.LAB_PROGRAM_ID;
  const reasons = [];
  if (mode !== "surfpool-local") reasons.push("lab mode is not surfpool-local");
  if (enabled !== "true") reasons.push("lab execution is not enabled");
  let parsed = null;
  try {
    parsed = new URL(rpcUrl);
  } catch {
    reasons.push("lab RPC URL is invalid");
  }
  if (parsed) {
    const host = parsed.hostname;
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") reasons.push("lab RPC protocol is not http");
    if (host !== "127.0.0.1" && host !== "localhost") reasons.push("lab RPC is not loopback");
    if (MAINNET_HOSTS.has(host) || host.includes("mainnet")) reasons.push("mainnet RPC cannot execute");
  }
  if (programId !== SETTLEMENT_PROGRAM_ID.toBase58()) reasons.push("lab program id is not the Settlement Lab");
  return { ok: reasons.length === 0, reasons, rpcUrl, programId };
}

export function assertSameOrigin(origin, expectedHost) {
  if (!origin) return true;
  try {
    return new URL(origin).host === expectedHost;
  } catch {
    return false;
  }
}
