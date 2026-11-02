/**
 * Process entry used by the Next.js server. The policy key is read here and
 * stays inside the gateway closure. This module must not run in the browser.
 */
import { readFileSync } from "node:fs";
import { Keypair } from "@solana/web3.js";
import { createLabGateway } from "./gateway.mjs";

let cached = null;

export function openLabGateway(researchAssets = []) {
  if (cached) return cached;
  const env = {
    LAB_MODE: process.env.LAB_MODE ?? "",
    LAB_RPC_URL: process.env.LAB_RPC_URL ?? "",
    LAB_EXECUTION_ENABLED: process.env.LAB_EXECUTION_ENABLED ?? "",
    LAB_PROGRAM_ID: process.env.LAB_PROGRAM_ID ?? "",
  };
  const keyPath = process.env.LAB_POLICY_KEYPAIR_PATH;
  const runtimePath = process.env.LAB_RUNTIME_PATH;
  if (!keyPath || !runtimePath) {
    cached = { gateway: null, reason: "Lab runtime is not configured." };
    return cached;
  }
  let runtime;
  let secret;
  try {
    runtime = JSON.parse(readFileSync(runtimePath, "utf8"));
    secret = JSON.parse(readFileSync(keyPath, "utf8"));
  } catch {
    cached = { gateway: null, reason: "Lab runtime files are missing. Provision the local Surfpool first." };
    return cached;
  }
  if (!Array.isArray(secret) || secret.length !== 64) {
    cached = { gateway: null, reason: "Policy signer file is not a keypair." };
    return cached;
  }
  const policySigner = Keypair.fromSecretKey(Uint8Array.from(secret));
  cached = {
    gateway: createLabGateway({
      env,
      policySigner,
      runtime,
      researchAssets,
    }),
    reason: null,
  };
  return cached;
}
