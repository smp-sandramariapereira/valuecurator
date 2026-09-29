import { PublicKey } from "@solana/web3.js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { writeEvidenceAtomically } from "./pyth-evidence.js";
import { DEFAULT_PYTH_PRO_URL } from "./pyth-pro.js";
import { refreshMarketEvidence } from "./market-refresh.js";
import { DEFAULT_XSTOCKS_API_URL } from "./xstocks.js";

const DEFAULT_MAINNET_RPC_URL = "https://api.mainnet-beta.solana.com";
const MAINNET_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

function loadLocalEnv(): void {
  const path = resolve(process.cwd(), ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equals = trimmed.indexOf("=");
    if (equals <= 0) continue;
    const key = trimmed.slice(0, equals).trim();
    let value = trimmed.slice(equals + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required env var ${name}`);
  return value;
}

function boundedInt(name: string, fallback: number, min: number, max: number): number {
  const value = Number.parseInt(process.env[name] ?? String(fallback), 10);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be between ${min} and ${max}`);
  }
  return value;
}

function positiveBigInt(name: string, fallback: string): bigint {
  const raw = process.env[name]?.trim() || fallback;
  if (!/^\d+$/.test(raw) || BigInt(raw) <= 0n) throw new Error(`${name} must be a positive integer`);
  return BigInt(raw);
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function usd(micros: string): string {
  const value = BigInt(micros);
  return `${value / 1_000_000n}.${(value % 1_000_000n).toString().padStart(6, "0")}`;
}

loadLocalEnv();

const result = await refreshMarketEvidence({
  feedId: required("KAIROS_PYTH_FEED_ID"),
  pythApiKey: required("KAIROS_PYTH_API_KEY"),
  pythApiUrl: process.env.KAIROS_PYTH_API_URL?.trim() || DEFAULT_PYTH_PRO_URL,
  xstocksApiUrl: process.env.KAIROS_XSTOCKS_API_URL?.trim() || DEFAULT_XSTOCKS_API_URL,
  symbol: process.env.KAIROS_XSTOCK_SYMBOL?.trim() || "AAPLx",
  marketRpcUrl: process.env.KAIROS_MARKET_RPC_URL?.trim() || DEFAULT_MAINNET_RPC_URL,
  jupiterApiUrl: process.env.KAIROS_JUPITER_API_URL?.trim() || "https://api.jup.ag",
  ...(process.env.KAIROS_JUPITER_API_KEY?.trim()
    ? { jupiterApiKey: process.env.KAIROS_JUPITER_API_KEY.trim() }
    : {}),
  inputMint: new PublicKey(process.env.KAIROS_QUOTE_INPUT_MINT?.trim() || MAINNET_USDC_MINT),
  inputAmount: positiveBigInt("KAIROS_QUOTE_INPUT_AMOUNT", "100000000"),
  inputDecimals: boundedInt("KAIROS_QUOTE_INPUT_DECIMALS", 6, 0, 18),
  slippageBps: boundedInt("KAIROS_STRATEGY_SLIPPAGE_BPS", 100, 1, 10_000),
  maxAccounts: boundedInt("KAIROS_STRATEGY_MAX_ACCOUNTS", 32, 1, 64),
  maxPriceImpactBps: boundedInt("KAIROS_MARKET_MAX_PRICE_IMPACT_BPS", 200, 0, 10_000),
  activationGuardMs: boundedInt("KAIROS_MULTIPLIER_ACTIVATION_GUARD_MS", 900_000, 0, 86_400_000),
  maximumPriceAgeMs: boundedInt("KAIROS_MARKET_MAX_PRICE_AGE_MS", 30_000, 1_000, 300_000),
  maximumConfidenceBps: boundedInt("KAIROS_MARKET_MAX_CONFIDENCE_BPS", 100, 0, 10_000),
  maximumDeviationBps: boundedInt("KAIROS_MARKET_MAX_DEVIATION_BPS", 200, 0, 10_000),
});
const report = result.report;

console.log("Mode: LIVE READ-ONLY");
console.log("Network: MAINNET-BETA MARKET EVIDENCE");
console.log(`Asset: ${report.symbol}`);
console.log(`Mint: ${result.asset?.solanaMint.toBase58() ?? "UNAVAILABLE"}`);
console.log(`Reference feed: ${report.referenceFeedId}`);
console.log(`Reference price: $${usd(report.referencePriceMicros)}`);
console.log(`Executable price: ${report.executablePriceMicros === null ? "UNAVAILABLE" : `$${usd(report.executablePriceMicros)}`}`);
console.log(`Price age: ${report.priceAgeMs} ms / limit ${report.maximumPriceAgeMs} ms`);
console.log(`Confidence: ${report.confidenceBps} bps / limit ${report.maximumConfidenceBps} bps`);
console.log(`Deviation: ${report.deviationBps ?? "UNAVAILABLE"} bps / limit ${report.maximumDeviationBps} bps`);
console.log(`Multiplier (nano): ${result.multiplier?.currentMultiplierNano ?? "UNAVAILABLE"}`);
console.log(`Jupiter route hops: ${report.routeHops ?? "UNAVAILABLE"}`);
console.log(`Decision: ${report.decision}`);
if (report.reasons.length) console.log(`Reasons: ${report.reasons.join("; ")}`);
console.log("Wallet loaded: NO");
console.log("Transaction constructed: NO");
console.log("Transaction submitted: NO");

const outputPath = argument("--output");
if (outputPath) console.log(`Report: ${writeEvidenceAtomically(outputPath, report)}`);
