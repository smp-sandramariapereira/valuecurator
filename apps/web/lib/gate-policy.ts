export type GatePolicyLimits = {
  maximumPriceAgeMs: number;
  maximumConfidenceBps: number;
  maximumDeviationBps: number;
  maximumPriceImpactBps: number;
};

const POLICY_REASONS = new Set([
  "market observation is stale",
  "market confidence interval is too wide",
  "executable price deviation is too high",
  "Jupiter price impact exceeds the configured limit",
]);

type PolicyCalculation = {
  id: string;
  threshold: { operator: "<="; value: string; unit: "ms" | "bps" } | null;
  passed: boolean | null;
};

type PolicyEvidence = {
  priceAgeMs: number;
  confidenceBps: number;
  deviationBps: number | null;
  priceImpactBps?: number | null;
  reasons: readonly string[];
  decision: "APPROVED" | "BLOCKED";
  maximumPriceAgeMs: number;
  maximumConfidenceBps: number;
  maximumDeviationBps: number;
  maximumPriceImpactBps?: number;
  calculations?: readonly PolicyCalculation[];
};

function retuneCalculation<C extends PolicyCalculation>(
  calculation: C,
  limits: GatePolicyLimits,
  evidence: PolicyEvidence,
): C {
  if (calculation.id === "price_age") {
    return {
      ...calculation,
      threshold: { operator: "<=", value: String(limits.maximumPriceAgeMs), unit: "ms" },
      passed: evidence.priceAgeMs >= 0 && evidence.priceAgeMs <= limits.maximumPriceAgeMs,
    };
  }
  if (calculation.id === "confidence_ratio") {
    return {
      ...calculation,
      threshold: { operator: "<=", value: String(limits.maximumConfidenceBps), unit: "bps" },
      passed: evidence.confidenceBps <= limits.maximumConfidenceBps,
    };
  }
  if (calculation.id === "price_deviation") {
    return {
      ...calculation,
      threshold: { operator: "<=", value: String(limits.maximumDeviationBps), unit: "bps" },
      passed: evidence.deviationBps === null ? null : evidence.deviationBps <= limits.maximumDeviationBps,
    };
  }
  if (calculation.id === "price_impact") {
    const impact = evidence.priceImpactBps;
    return {
      ...calculation,
      threshold: { operator: "<=", value: String(limits.maximumPriceImpactBps), unit: "bps" },
      passed: impact === null || impact === undefined ? null : impact <= limits.maximumPriceImpactBps,
    };
  }
  return calculation;
}

/** Re-score a market read with the current draft mandate. Prices stay the same. */
export function applyGatePolicy<T extends PolicyEvidence>(evidence: T, limits: GatePolicyLimits): T {
  const reasons = evidence.reasons.filter((reason) => !POLICY_REASONS.has(reason));
  if (evidence.priceAgeMs > limits.maximumPriceAgeMs) reasons.push("market observation is stale");
  if (evidence.confidenceBps > limits.maximumConfidenceBps) reasons.push("market confidence interval is too wide");
  if (evidence.deviationBps !== null && evidence.deviationBps > limits.maximumDeviationBps) {
    reasons.push("executable price deviation is too high");
  }
  if (
    evidence.priceImpactBps !== null
    && evidence.priceImpactBps !== undefined
    && evidence.priceImpactBps > limits.maximumPriceImpactBps
  ) {
    reasons.push("Jupiter price impact exceeds the configured limit");
  }
  return {
    ...evidence,
    maximumPriceAgeMs: limits.maximumPriceAgeMs,
    maximumConfidenceBps: limits.maximumConfidenceBps,
    maximumDeviationBps: limits.maximumDeviationBps,
    maximumPriceImpactBps: limits.maximumPriceImpactBps,
    reasons,
    decision: reasons.length === 0 ? "APPROVED" : "BLOCKED",
    calculations: evidence.calculations?.map((calculation) => retuneCalculation(calculation, limits, evidence)),
  };
}
