export const VERIFIED_ASSET = {
  symbol: "AAPLx",
  mint: "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp",
  pythFeedId: "922",
  network: "mainnet-beta" as const,
  issuer: "Backed Assets",
  origin: "xStocks tokenized equity",
} as const;

export const INPUT_ASSET = {
  symbol: "USDC",
  mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  decimals: 6,
} as const;

export const MANDATE_POLICY_CAPS = {
  maximumTradeUsdc: 10_000,
  maximumDailyUsdc: 100_000,
  maximumPriceAgeSeconds: 300,
  maximumConfidenceBps: 1_000,
  maximumDeviationBps: 2_000,
  maximumSlippageBps: 1_000,
  maximumValidityDays: 90,
} as const;

export type MandateDraft = {
  maximumTradeUsdc: number;
  maximumDailyUsdc: number;
  maximumAllocationPercent: number;
  maximumPriceAgeSeconds: number;
  maximumConfidenceBps: number;
  maximumDeviationBps: number;
  maximumSlippageBps: number;
  validFrom: string;
  validUntil: string;
  advisorMode: "shadow";
};

export type CanonicalMandate = {
  version: 1;
  owner: string;
  network: "mainnet-beta";
  inputAsset: { symbol: "USDC"; mint: string };
  allowedAssets: readonly [{ symbol: "AAPLx"; mint: string; pythFeedId: "922" }];
  limits: {
    maximumTradeUsdMicros: string;
    maximumDailyUsdMicros: string;
    maximumAllocationBps: number;
    maximumPriceAgeMs: number;
    maximumConfidenceBps: number;
    maximumDeviationBps: number;
    maximumSlippageBps: number;
  };
  advisorMode: "shadow";
  validFrom: string;
  validUntil: string;
  strategyVersion: "guarded-aaplx-v1";
};

export type MandateArtifact = {
  schemaVersion: 1;
  kind: "PROOFGATE_EXECUTION_MANDATE";
  status: "DRAFT";
  mandateId: string;
  mandateHash: string;
  mandate: CanonicalMandate;
  attestation: null;
  transactionConstructed: false;
  transactionSubmitted: false;
};

export type MandateEvidenceInput = {
  mint?: string | null;
  referenceFeedId: string;
  quoteInputAmount?: string | null;
  quoteExpectedOutputAmount?: string | null;
  quoteMinimumOutputAmount?: string | null;
  priceAgeMs: number;
  confidenceBps: number;
  deviationBps: number | null;
  priceImpactBps?: number | null;
};

export type MandateEvaluation = {
  decision: "APPROVED" | "BLOCKED";
  reasons: readonly string[];
  checks: readonly { label: string; value: string; limit: string; passed: boolean }[];
};

function positiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function integerInRange(value: number, minimum: number, maximum: number): boolean {
  return Number.isInteger(value) && value >= minimum && value <= maximum;
}

export function validateMandateDraft(draft: MandateDraft, nowMs = Date.now()): string[] {
  const errors: string[] = [];
  if (!positiveFinite(draft.maximumTradeUsdc) || draft.maximumTradeUsdc > MANDATE_POLICY_CAPS.maximumTradeUsdc) {
    errors.push(`Maximum trade must be between 0 and ${MANDATE_POLICY_CAPS.maximumTradeUsdc} USDC.`);
  }
  if (!positiveFinite(draft.maximumDailyUsdc) || draft.maximumDailyUsdc > MANDATE_POLICY_CAPS.maximumDailyUsdc) {
    errors.push(`Daily limit must be between 0 and ${MANDATE_POLICY_CAPS.maximumDailyUsdc} USDC.`);
  }
  if (draft.maximumDailyUsdc < draft.maximumTradeUsdc) {
    errors.push("Daily limit cannot be lower than the per-trade limit.");
  }
  if (!positiveFinite(draft.maximumAllocationPercent) || draft.maximumAllocationPercent > 100) {
    errors.push("Maximum allocation must be between 0 and 100%.");
  }
  if (!integerInRange(draft.maximumPriceAgeSeconds, 1, MANDATE_POLICY_CAPS.maximumPriceAgeSeconds)) {
    errors.push(`Maximum price age must be between 1 and ${MANDATE_POLICY_CAPS.maximumPriceAgeSeconds} seconds.`);
  }
  for (const [label, value, maximum] of [
    ["Maximum confidence", draft.maximumConfidenceBps, MANDATE_POLICY_CAPS.maximumConfidenceBps],
    ["Maximum deviation", draft.maximumDeviationBps, MANDATE_POLICY_CAPS.maximumDeviationBps],
    ["Maximum slippage", draft.maximumSlippageBps, MANDATE_POLICY_CAPS.maximumSlippageBps],
  ] as const) {
    if (!integerInRange(value, 0, maximum)) errors.push(`${label} must be between 0 and ${maximum} bps.`);
  }
  const validFrom = Date.parse(draft.validFrom);
  const validUntil = Date.parse(draft.validUntil);
  if (!Number.isFinite(validFrom) || !Number.isFinite(validUntil)) {
    errors.push("Mandate validity dates are invalid.");
  } else {
    if (validUntil <= validFrom) errors.push("Mandate expiry must be after its start time.");
    if (validUntil <= nowMs) errors.push("Mandate expiry must be in the future.");
    if (validUntil - validFrom > MANDATE_POLICY_CAPS.maximumValidityDays * 86_400_000) {
      errors.push(`Mandate validity cannot exceed ${MANDATE_POLICY_CAPS.maximumValidityDays} days.`);
    }
  }
  return errors;
}

function usdcToMicros(value: number): string {
  return BigInt(Math.round(value * 1_000_000)).toString();
}

function canonicalIso(value: string): string {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : value;
}

export function buildCanonicalMandate(draft: MandateDraft, owner: string): CanonicalMandate {
  return {
    version: 1,
    owner: owner.trim() || "UNASSIGNED",
    network: VERIFIED_ASSET.network,
    inputAsset: { symbol: INPUT_ASSET.symbol, mint: INPUT_ASSET.mint },
    allowedAssets: [{
      symbol: VERIFIED_ASSET.symbol,
      mint: VERIFIED_ASSET.mint,
      pythFeedId: VERIFIED_ASSET.pythFeedId,
    }],
    limits: {
      maximumTradeUsdMicros: usdcToMicros(draft.maximumTradeUsdc),
      maximumDailyUsdMicros: usdcToMicros(draft.maximumDailyUsdc),
      maximumAllocationBps: Math.round(draft.maximumAllocationPercent * 100),
      maximumPriceAgeMs: draft.maximumPriceAgeSeconds * 1_000,
      maximumConfidenceBps: draft.maximumConfidenceBps,
      maximumDeviationBps: draft.maximumDeviationBps,
      maximumSlippageBps: draft.maximumSlippageBps,
    },
    advisorMode: "shadow",
    validFrom: canonicalIso(draft.validFrom),
    validUntil: canonicalIso(draft.validUntil),
    strategyVersion: "guarded-aaplx-v1",
  };
}

export function canonicalMandateJson(mandate: CanonicalMandate): string {
  return JSON.stringify(mandate);
}

function quoteSlippageBps(evidence: MandateEvidenceInput): number | null {
  if (!evidence.quoteExpectedOutputAmount || !evidence.quoteMinimumOutputAmount) return null;
  try {
    const expected = BigInt(evidence.quoteExpectedOutputAmount);
    const minimum = BigInt(evidence.quoteMinimumOutputAmount);
    if (expected <= 0n || minimum < 0n || minimum > expected) return null;
    return Number(((expected - minimum) * 10_000n) / expected);
  } catch {
    return null;
  }
}

export function evaluateMandateEvidence(
  evidence: MandateEvidenceInput | null,
  mandate: CanonicalMandate,
): MandateEvaluation {
  if (!evidence) return { decision: "BLOCKED", reasons: ["Market evidence is unavailable."], checks: [] };
  const checks: { label: string; value: string; limit: string; passed: boolean }[] = [];
  const reasons: string[] = [];
  function add(label: string, value: number, limit: number, unit: string) {
    const passed = value <= limit;
    checks.push({ label, value: `${value} ${unit}`, limit: `${limit} ${unit}`, passed });
    if (!passed) reasons.push(`${label} exceeds the mandate limit.`);
  }
  if (evidence.mint && evidence.mint !== VERIFIED_ASSET.mint) reasons.push("Asset mint is not allowlisted.");
  if (evidence.referenceFeedId !== VERIFIED_ASSET.pythFeedId) reasons.push("Pyth feed is not allowlisted.");
  if (evidence.quoteInputAmount) {
    try {
      const amount = BigInt(evidence.quoteInputAmount);
      const limit = BigInt(mandate.limits.maximumTradeUsdMicros);
      const passed = amount <= limit;
      checks.push({ label: "Trade value", value: `${Number(amount) / 1_000_000} USDC`, limit: `${Number(limit) / 1_000_000} USDC`, passed });
      if (!passed) reasons.push("Trade value exceeds the per-trade limit.");
    } catch {
      reasons.push("Quote input amount is invalid.");
    }
  }
  add("Price age", evidence.priceAgeMs, mandate.limits.maximumPriceAgeMs, "ms");
  add("Pyth confidence", evidence.confidenceBps, mandate.limits.maximumConfidenceBps, "bps");
  if (evidence.deviationBps === null) reasons.push("Executable-price deviation is unavailable.");
  else add("Pyth/Jupiter deviation", evidence.deviationBps, mandate.limits.maximumDeviationBps, "bps");
  if (evidence.priceImpactBps !== null && evidence.priceImpactBps !== undefined) {
    add("Jupiter price impact", evidence.priceImpactBps, mandate.limits.maximumSlippageBps, "bps");
  }
  const slippage = quoteSlippageBps(evidence);
  if (slippage !== null) add("Quote slippage protection", slippage, mandate.limits.maximumSlippageBps, "bps");
  return {
    decision: reasons.length === 0 ? "APPROVED" : "BLOCKED",
    reasons,
    checks,
  };
}

export function buildAdverseEvidence(mandate: CanonicalMandate): MandateEvidenceInput {
  return {
    mint: VERIFIED_ASSET.mint,
    referenceFeedId: VERIFIED_ASSET.pythFeedId,
    quoteInputAmount: mandate.limits.maximumTradeUsdMicros,
    quoteExpectedOutputAmount: "300000",
    quoteMinimumOutputAmount: "297000",
    priceAgeMs: mandate.limits.maximumPriceAgeMs + 1_000,
    confidenceBps: Math.min(mandate.limits.maximumConfidenceBps, 50),
    deviationBps: Math.min(mandate.limits.maximumDeviationBps, 100),
    priceImpactBps: 25,
  };
}
