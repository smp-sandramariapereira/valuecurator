import { PublicKey } from "@solana/web3.js";
import type { AIMode } from "./advisor.js";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

export const DEFAULT_PROGRAM_ID = "6owAcXj4FxJom96cEX9CSFjGrg6zp4U8atTjrpCUMiW5";
export const DEFAULT_RPC_URL = "https://api.devnet.solana.com";
export const DEFAULT_POLL_MS = 10_000;
export const DEFAULT_JUPITER_API_URL = "https://api.jup.ag";
export const DEFAULT_PYTH_HERMES_URL = "https://pyth.dourolabs.app/hermes";
export const DEFAULT_PYTH_PRO_URL = "https://pyth-lazer.dourolabs.app";
export const DEFAULT_XSTOCKS_API_URL = "https://api.xstocks.fi/api/v2";

export type AgentConfig = {
  rpcUrl: string; programId: PublicKey; nodeOwner: PublicKey; operatorKeyPath: string;
  mint: PublicKey; pollMs: number; sweepExisting: boolean; jupiterApiUrl: string;
  jupiterApiKey: string | undefined; strategySlippageBps: number; strategyMaxAccounts: number;
  pythHermesUrl: string; pythApiKey: string; xstocksApiUrl: string;
  xstockSymbol: string; pythFeedId: string; marketMaxPriceAgeMs: number;
  marketMaxConfidenceBps: number; marketMaxDeviationBps: number;
  aiMode: AIMode; aiEndpoint: string | undefined; aiApiKey: string | undefined;
  aiMinimumConfidence: number; aiTimeoutMs: number; telemetryPath: string;
  riskStatePath: string; maxSwapAmount: bigint; maxDailyInput: bigint;
  maxConsecutiveFailures: number; circuitCooldownMs: number;
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required env var ${name}`);
  return value;
}

function expandHome(path: string): string {
  return path.startsWith("~/") ? resolve(homedir(), path.slice(2)) : resolve(path);
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  return value === "1" || value.toLowerCase() === "true";
}

function positiveBigInt(name: string, fallback: string): bigint {
  const raw = process.env[name]?.trim() || fallback;
  if (!/^\d+$/.test(raw) || BigInt(raw) <= 0n) throw new Error(`${name} must be a positive integer in raw token units`);
  return BigInt(raw);
}

function boundedInt(name: string, fallback: string, min: number, max: number): number {
  const value = Number.parseInt(process.env[name] ?? fallback, 10);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be between ${min} and ${max}`);
  }
  return value;
}

function loadDotEnv(): void {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export function loadConfig(): AgentConfig {
  loadDotEnv();
  const aiModeRaw = process.env.KAIROS_AI_MODE?.trim() || "off";
  if (aiModeRaw !== "off" && aiModeRaw !== "shadow" && aiModeRaw !== "enforce") throw new Error("KAIROS_AI_MODE must be off, shadow, or enforce");
  const aiMode: AIMode = aiModeRaw;
  const aiEndpoint = process.env.KAIROS_AI_ENDPOINT?.trim() || undefined;
  if (aiMode !== "off" && !aiEndpoint) throw new Error("KAIROS_AI_ENDPOINT is required when AI is enabled");
  const aiMinimumConfidence = Number.parseFloat(process.env.KAIROS_AI_MIN_CONFIDENCE ?? "0.8");
  if (!Number.isFinite(aiMinimumConfidence) || aiMinimumConfidence < 0.5 || aiMinimumConfidence > 1) throw new Error("KAIROS_AI_MIN_CONFIDENCE must be between 0.5 and 1");
  const aiTimeoutMs = boundedInt("KAIROS_AI_TIMEOUT_MS", "5000", 500, 30_000);
  const pollMs = boundedInt("KAIROS_POLL_MS", String(DEFAULT_POLL_MS), 1_000, 3_600_000);
  const slippageBps = boundedInt("KAIROS_STRATEGY_SLIPPAGE_BPS", "100", 1, 500);
  const maxAccounts = boundedInt("KAIROS_STRATEGY_MAX_ACCOUNTS", "32", 8, 48);
  const maxSwapAmount = positiveBigInt("KAIROS_MAX_SWAP_AMOUNT", "1000000");
  const maxDailyInput = positiveBigInt("KAIROS_MAX_DAILY_INPUT", "5000000");
  if (maxDailyInput < maxSwapAmount) throw new Error("KAIROS_MAX_DAILY_INPUT must be >= KAIROS_MAX_SWAP_AMOUNT");
  const pythFeedId = required("KAIROS_PYTH_FEED_ID");
  const pythDefaultUrl = /^\\d+$/.test(pythFeedId) ? DEFAULT_PYTH_PRO_URL : DEFAULT_PYTH_HERMES_URL;
  const pythApiUrl = process.env.KAIROS_PYTH_API_URL?.trim() ||
    process.env.KAIROS_PYTH_HERMES_URL?.trim() || pythDefaultUrl;

  return {
    rpcUrl: process.env.KAIROS_RPC_URL?.trim() || DEFAULT_RPC_URL,
    programId: new PublicKey(process.env.KAIROS_PROGRAM_ID?.trim() || DEFAULT_PROGRAM_ID),
    nodeOwner: new PublicKey(required("KAIROS_NODE_OWNER")),
    operatorKeyPath: expandHome(required("KAIROS_OPERATOR_KEY")),
    mint: new PublicKey(required("KAIROS_MINT")),
    pollMs, sweepExisting: parseBool(process.env.KAIROS_SWEEP_EXISTING, false),
    jupiterApiUrl: process.env.KAIROS_JUPITER_API_URL?.trim() || DEFAULT_JUPITER_API_URL,
    jupiterApiKey: process.env.KAIROS_JUPITER_API_KEY?.trim() || undefined,
    strategySlippageBps: slippageBps, strategyMaxAccounts: maxAccounts,
    // Retain the field name for compatibility; it now accepts either Hermes or Pyth Pro REST.
    pythHermesUrl: pythApiUrl,
    pythApiKey: required("KAIROS_PYTH_API_KEY"),
    xstocksApiUrl: process.env.KAIROS_XSTOCKS_API_URL?.trim() || DEFAULT_XSTOCKS_API_URL,
    xstockSymbol: required("KAIROS_XSTOCK_SYMBOL"),
    pythFeedId,
    marketMaxPriceAgeMs: boundedInt("KAIROS_MARKET_MAX_PRICE_AGE_MS", "30000", 1_000, 300_000),
    marketMaxConfidenceBps: boundedInt("KAIROS_MARKET_MAX_CONFIDENCE_BPS", "100", 0, 10_000),
    marketMaxDeviationBps: boundedInt("KAIROS_MARKET_MAX_DEVIATION_BPS", "200", 0, 10_000),
    aiMode, aiEndpoint, aiApiKey: process.env.KAIROS_AI_API_KEY?.trim() || undefined,
    aiMinimumConfidence, aiTimeoutMs,
    telemetryPath: expandHome(process.env.KAIROS_TELEMETRY_PATH?.trim() || "data/decisions.jsonl"),
    riskStatePath: expandHome(process.env.KAIROS_RISK_STATE_PATH?.trim() || "data/risk-state.json"),
    maxSwapAmount, maxDailyInput,
    maxConsecutiveFailures: boundedInt("KAIROS_MAX_CONSECUTIVE_FAILURES", "3", 1, 100),
    circuitCooldownMs: boundedInt("KAIROS_CIRCUIT_COOLDOWN_MS", "300000", 1_000, 86_400_000),
  };
}
