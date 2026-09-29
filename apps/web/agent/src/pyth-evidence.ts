import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { PythPrice } from "./pyth.js";

export type ExecutableQuoteEvidence = {
  mint: string;
  source: "jupiter";
  network: "mainnet-beta";
  inputMint: string;
  inputAmount: bigint;
  inputDecimals?: number;
  expectedOutputAmount: bigint;
  minimumOutputAmount: bigint;
  outputDecimals?: number;
  multiplierNano: bigint;
  executablePriceMicros: bigint;
  priceImpactBps: number;
  routeHops: number;
};

export type LivePythEvidenceReport = {
  schemaVersion: 1;
  source: "pyth-pro";
  simulated: false;
  transactionSubmitted: false;
  generatedAt: string;
  symbol: string;
  mint: string | null;
  marketNetwork: "mainnet-beta" | null;
  executableSource: "jupiter" | null;
  quoteInputMint: string | null;
  quoteInputAmount: string | null;
  quoteInputDecimals?: number | null;
  quoteExpectedOutputAmount: string | null;
  quoteMinimumOutputAmount: string | null;
  quoteOutputDecimals?: number | null;
  multiplierNano: string | null;
  priceImpactBps: number | null;
  routeHops: number | null;
  referenceFeedId: string;
  referencePriceMicros: string;
  executablePriceMicros: string | null;
  confidenceMicros: string;
  publishTimeMs: number;
  priceAgeMs: number;
  deviationBps: number | null;
  confidenceBps: number;
  maximumPriceAgeMs: number;
  maximumDeviationBps: number;
  maximumConfidenceBps: number;
  maximumPriceImpactBps: number;
  calculationPolicyVersion: "kairos-market-policy-v1";
  calculations: readonly CalculationTrace[];
  decision: "APPROVED" | "BLOCKED";
  reasons: readonly string[];
};

export type CalculationTrace = {
  id: "price_age" | "confidence_ratio" | "price_deviation" | "price_impact";
  label: string;
  formula: string;
  operands: Readonly<Record<string, string | null>>;
  result: { value: string | null; unit: "ms" | "bps" };
  threshold: { operator: "<="; value: string; unit: "ms" | "bps" } | null;
  passed: boolean | null;
};

function ratioBps(numerator: bigint, denominator: bigint): number {
  if (denominator <= 0n) return 0;
  return Number((numerator * 1_000_000n) / denominator) / 100;
}

export function createLivePythEvidence(options: {
  price: PythPrice;
  symbol: string;
  executableQuote?: ExecutableQuoteEvidence;
  additionalReasons?: readonly string[];
  nowMs?: number;
  maximumPriceAgeMs?: number;
  maximumConfidenceBps?: number;
  maximumDeviationBps?: number;
  maximumPriceImpactBps?: number;
}): LivePythEvidenceReport {
  const nowMs = options.nowMs ?? Date.now();
  const maximumPriceAgeMs = options.maximumPriceAgeMs ?? 30_000;
  const maximumConfidenceBps = options.maximumConfidenceBps ?? 100;
  const maximumDeviationBps = options.maximumDeviationBps ?? 200;
  const maximumPriceImpactBps = options.maximumPriceImpactBps ?? 200;
  const priceAgeMs = nowMs - options.price.publishTimeMs;
  const confidenceBps = ratioBps(options.price.confidenceMicros, options.price.priceMicros);
  const quote = options.executableQuote;
  const deviationBps = quote
    ? ratioBps(
        quote.executablePriceMicros >= options.price.priceMicros
          ? quote.executablePriceMicros - options.price.priceMicros
          : options.price.priceMicros - quote.executablePriceMicros,
        options.price.priceMicros,
      )
    : null;
  const reasons: string[] = [];

  if (priceAgeMs < 0) reasons.push("market observation publish time is in the future");
  else if (priceAgeMs > maximumPriceAgeMs) reasons.push("market observation is stale");
  if (options.price.priceMicros <= 0n) reasons.push("reference price must be positive");
  if (confidenceBps > maximumConfidenceBps) reasons.push("market confidence interval is too wide");
  if (!quote) reasons.push("executable quote is unavailable in read-only check");
  else if (quote.executablePriceMicros <= 0n) reasons.push("executable price must be positive");
  else if (deviationBps !== null && deviationBps > maximumDeviationBps) {
    reasons.push("executable price deviation is too high");
  }
  if (quote && quote.priceImpactBps > maximumPriceImpactBps) {
    reasons.push("Jupiter price impact exceeds the configured limit");
  }
  for (const reason of options.additionalReasons ?? []) {
    if (reason.trim() && !reasons.includes(reason)) reasons.push(reason);
  }

  const calculations: CalculationTrace[] = [
    {
      id: "price_age",
      label: "Price age",
      formula: "nowMs - publishTimeMs",
      operands: {
        nowMs: nowMs.toString(),
        publishTimeMs: options.price.publishTimeMs.toString(),
      },
      result: { value: priceAgeMs.toString(), unit: "ms" },
      threshold: { operator: "<=", value: maximumPriceAgeMs.toString(), unit: "ms" },
      passed: priceAgeMs >= 0 && priceAgeMs <= maximumPriceAgeMs,
    },
    {
      id: "confidence_ratio",
      label: "Feed confidence",
      formula: "(confidenceMicros * 10000) / referencePriceMicros",
      operands: {
        confidenceMicros: options.price.confidenceMicros.toString(),
        referencePriceMicros: options.price.priceMicros.toString(),
      },
      result: { value: confidenceBps.toString(), unit: "bps" },
      threshold: { operator: "<=", value: maximumConfidenceBps.toString(), unit: "bps" },
      passed: confidenceBps <= maximumConfidenceBps,
    },
    {
      id: "price_deviation",
      label: "Price deviation",
      formula: "(abs(executablePriceMicros - referencePriceMicros) * 10000) / referencePriceMicros",
      operands: {
        executablePriceMicros: quote?.executablePriceMicros.toString() ?? null,
        referencePriceMicros: options.price.priceMicros.toString(),
      },
      result: { value: deviationBps?.toString() ?? null, unit: "bps" },
      threshold: { operator: "<=", value: maximumDeviationBps.toString(), unit: "bps" },
      passed: deviationBps === null ? null : deviationBps <= maximumDeviationBps,
    },
    {
      id: "price_impact",
      label: "Trade impact",
      formula: "Jupiter priceImpactPct * 100",
      operands: { priceImpactBps: quote?.priceImpactBps.toString() ?? null },
      result: { value: quote?.priceImpactBps.toString() ?? null, unit: "bps" },
      threshold: { operator: "<=", value: maximumPriceImpactBps.toString(), unit: "bps" },
      passed: quote ? quote.priceImpactBps <= maximumPriceImpactBps : null,
    },
  ];

  return {
    schemaVersion: 1,
    source: "pyth-pro",
    simulated: false,
    transactionSubmitted: false,
    generatedAt: new Date(nowMs).toISOString(),
    symbol: options.symbol,
    mint: quote?.mint ?? null,
    marketNetwork: quote?.network ?? null,
    executableSource: quote?.source ?? null,
    quoteInputMint: quote?.inputMint ?? null,
    quoteInputAmount: quote?.inputAmount.toString() ?? null,
    quoteInputDecimals: quote?.inputDecimals ?? null,
    quoteExpectedOutputAmount: quote?.expectedOutputAmount.toString() ?? null,
    quoteMinimumOutputAmount: quote?.minimumOutputAmount.toString() ?? null,
    quoteOutputDecimals: quote?.outputDecimals ?? null,
    multiplierNano: quote?.multiplierNano.toString() ?? null,
    priceImpactBps: quote?.priceImpactBps ?? null,
    routeHops: quote?.routeHops ?? null,
    referenceFeedId: options.price.feedId,
    referencePriceMicros: options.price.priceMicros.toString(),
    executablePriceMicros: quote?.executablePriceMicros.toString() ?? null,
    confidenceMicros: options.price.confidenceMicros.toString(),
    publishTimeMs: options.price.publishTimeMs,
    priceAgeMs,
    deviationBps,
    confidenceBps,
    maximumPriceAgeMs,
    maximumDeviationBps,
    maximumConfidenceBps,
    maximumPriceImpactBps,
    calculationPolicyVersion: "kairos-market-policy-v1",
    calculations,
    decision: reasons.length === 0 ? "APPROVED" : "BLOCKED",
    reasons,
  };
}

export function writeEvidenceAtomically(path: string, report: LivePythEvidenceReport): string {
  const destination = resolve(path);
  mkdirSync(dirname(destination), { recursive: true });
  const temporary = `${destination}.tmp-${process.pid}`;
  writeFileSync(temporary, `${JSON.stringify(report, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  renameSync(temporary, destination);
  return destination;
}
