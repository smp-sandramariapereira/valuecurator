import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createLivePythEvidence, writeEvidenceAtomically } from "./pyth-evidence.js";
import { DEFAULT_PYTH_PRO_URL, fetchPythProPrice } from "./pyth-pro.js";

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

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function usd(micros: string): string {
  const value = BigInt(micros);
  return `${value / 1_000_000n}.${(value % 1_000_000n).toString().padStart(6, "0")}`;
}

loadLocalEnv();

const feedId = required("KAIROS_PYTH_FEED_ID");
const apiKey = required("KAIROS_PYTH_API_KEY");
const apiUrl = process.env.KAIROS_PYTH_API_URL?.trim() || DEFAULT_PYTH_PRO_URL;
const symbol = process.env.KAIROS_XSTOCK_SYMBOL?.trim() || "AAPLx";
const outputPath = argument("--output");

const price = await fetchPythProPrice({
  feedId,
  apiKey,
  apiUrl,
  signal: AbortSignal.timeout(10_000),
});
const report = createLivePythEvidence({
  price,
  symbol,
  maximumPriceAgeMs: boundedInt("KAIROS_MARKET_MAX_PRICE_AGE_MS", 30_000, 1_000, 300_000),
  maximumConfidenceBps: boundedInt("KAIROS_MARKET_MAX_CONFIDENCE_BPS", 100, 0, 10_000),
  maximumDeviationBps: boundedInt("KAIROS_MARKET_MAX_DEVIATION_BPS", 200, 0, 10_000),
});

console.log("Mode: LIVE READ-ONLY");
console.log("Source: PYTH PRO");
console.log(`Asset: ${report.symbol}`);
console.log(`Reference feed: ${report.referenceFeedId}`);
console.log(`Reference price: $${usd(report.referencePriceMicros)}`);
console.log(`Price age: ${report.priceAgeMs} ms / limit ${report.maximumPriceAgeMs} ms`);
console.log(`Confidence: ${report.confidenceBps} bps / limit ${report.maximumConfidenceBps} bps`);
console.log("Executable quote: UNAVAILABLE (not requested)");
console.log(`Decision: ${report.decision}`);
console.log(`Reasons: ${report.reasons.join("; ")}`);
console.log("Wallet loaded: NO");
console.log("Transaction submitted: NO");

if (outputPath) {
  console.log(`Report: ${writeEvidenceAtomically(outputPath, report)}`);
}
