import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { MarketObservation } from "./mandate.js";
import { evaluateMarketObservation, type PolicyDecision } from "./policy.js";

type UnknownRecord = Record<string, unknown>;

export type MarketFixture = {
  schemaVersion: 1;
  symbol: string;
  mint: string;
  referenceFeedId: string;
  referencePriceMicros: bigint;
  executablePriceMicros: bigint;
  confidenceMicros: bigint;
  ageMs: number;
};

export type MarketEvidenceReport = {
  schemaVersion: 1;
  source: "fixture";
  simulated: true;
  transactionSubmitted: false;
  generatedAt: string;
  symbol: string;
  mint: string;
  referenceFeedId: string;
  referencePriceMicros: string;
  executablePriceMicros: string;
  confidenceMicros: string;
  publishTimeMs: number;
  priceAgeMs: number;
  deviationBps: number;
  confidenceBps: number;
  maximumPriceAgeMs: number;
  maximumDeviationBps: number;
  maximumConfidenceBps: number;
  decision: "APPROVED" | "BLOCKED";
  reasons: readonly string[];
};

function record(value: unknown, label: string): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`invalid ${label}`);
  return value as UnknownRecord;
}

function nonEmpty(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`invalid ${label}`);
  return value.trim();
}

function positiveBigInt(value: unknown, label: string, allowZero = false): bigint {
  if (typeof value !== "string" || !/^\d+$/.test(value)) throw new Error(`invalid ${label}`);
  const parsed = BigInt(value);
  if (allowZero ? parsed < 0n : parsed <= 0n) throw new Error(`invalid ${label}`);
  return parsed;
}

function nonNegativeInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`invalid ${label}`);
  }
  return value;
}

export function loadMarketFixture(path: string): MarketFixture {
  const body = record(JSON.parse(readFileSync(resolve(path), "utf8")), "market fixture");
  if (body.schemaVersion !== 1 || body.source !== "fixture") {
    throw new Error("market fixture must declare schemaVersion 1 and source fixture");
  }
  return {
    schemaVersion: 1,
    symbol: nonEmpty(body.symbol, "fixture symbol"),
    mint: nonEmpty(body.mint, "fixture mint"),
    referenceFeedId: nonEmpty(body.referenceFeedId, "fixture reference feed id"),
    referencePriceMicros: positiveBigInt(body.referencePriceMicros, "fixture reference price"),
    executablePriceMicros: positiveBigInt(body.executablePriceMicros, "fixture executable price"),
    confidenceMicros: positiveBigInt(body.confidenceMicros, "fixture confidence", true),
    ageMs: nonNegativeInteger(body.ageMs, "fixture age"),
  };
}

function ratioBps(numerator: bigint, denominator: bigint): number {
  if (denominator <= 0n) return 0;
  return Number((numerator * 1_000_000n) / denominator) / 100;
}

export function evaluateMarketFixture(options: {
  fixture: MarketFixture;
  nowMs?: number;
  maximumPriceAgeMs?: number;
  maximumConfidenceBps?: number;
  maximumDeviationBps?: number;
}): { observation: MarketObservation; decision: PolicyDecision; report: MarketEvidenceReport } {
  const nowMs = options.nowMs ?? Date.now();
  const maximumPriceAgeMs = options.maximumPriceAgeMs ?? 30_000;
  const maximumConfidenceBps = options.maximumConfidenceBps ?? 100;
  const maximumDeviationBps = options.maximumDeviationBps ?? 200;
  const observation: MarketObservation = {
    mint: options.fixture.mint,
    referenceFeedId: options.fixture.referenceFeedId,
    referencePriceMicros: options.fixture.referencePriceMicros,
    onchainPriceMicros: options.fixture.executablePriceMicros,
    confidenceMicros: options.fixture.confidenceMicros,
    publishTimeMs: nowMs - options.fixture.ageMs,
  };
  const decision = evaluateMarketObservation({
    asset: {
      mint: options.fixture.mint,
      referenceFeedId: options.fixture.referenceFeedId,
      targetAllocationBps: 10_000,
      maxAllocationBps: 10_000,
      maxPriceDeviationBps: maximumDeviationBps,
    },
    observation,
    maxPriceAgeMs: maximumPriceAgeMs,
    maxConfidenceBps: maximumConfidenceBps,
    nowMs,
  });
  const difference = observation.onchainPriceMicros >= observation.referencePriceMicros
    ? observation.onchainPriceMicros - observation.referencePriceMicros
    : observation.referencePriceMicros - observation.onchainPriceMicros;
  const report: MarketEvidenceReport = {
    schemaVersion: 1,
    source: "fixture",
    simulated: true,
    transactionSubmitted: false,
    generatedAt: new Date(nowMs).toISOString(),
    symbol: options.fixture.symbol,
    mint: options.fixture.mint,
    referenceFeedId: options.fixture.referenceFeedId,
    referencePriceMicros: observation.referencePriceMicros.toString(),
    executablePriceMicros: observation.onchainPriceMicros.toString(),
    confidenceMicros: observation.confidenceMicros.toString(),
    publishTimeMs: observation.publishTimeMs,
    priceAgeMs: options.fixture.ageMs,
    deviationBps: ratioBps(difference, observation.referencePriceMicros),
    confidenceBps: ratioBps(observation.confidenceMicros, observation.referencePriceMicros),
    maximumPriceAgeMs,
    maximumDeviationBps,
    maximumConfidenceBps,
    decision: decision.allowed ? "APPROVED" : "BLOCKED",
    reasons: decision.reasons,
  };
  return { observation, decision, report };
}
