import { sameAsset, type AssetIdentity, type OracleEvidenceV2, type OraclePolicy } from "@valuecurator/oracle-contracts";

export type Admissibility = "ADMISSIBLE" | "INVALID" | "INADMISSIBLE";

export type EvidenceDecision = {
  admissibility: Admissibility;
  reasons: readonly string[];
};

export function validateEvidence(options: {
  evidence: OracleEvidenceV2;
  expectedAsset: AssetIdentity;
  expectedProviderId: string;
  policy: OraclePolicy;
}): EvidenceDecision {
  const reasons: string[] = [];
  const { evidence } = options;
  if (evidence.disabled) reasons.push("oracle provider is disabled");
  if (evidence.simulated) reasons.push("simulated evidence is not admissible");
  if (evidence.providerId !== options.expectedProviderId) reasons.push("oracle provider does not match the request");
  if (!options.policy.allowedProviders.includes(evidence.providerId)) reasons.push("oracle provider is outside the policy");
  if (!sameAsset(evidence.asset, options.expectedAsset)) reasons.push("oracle asset does not match the mandate");
  if (evidence.price === "0") reasons.push("reference price must be positive");
  if (evidence.confidence === null) reasons.push("oracle confidence is absent");
  if (evidence.publishTimeMs > evidence.observedAtMs) reasons.push("market observation publish time is in the future");
  else if (evidence.observedAtMs - evidence.publishTimeMs > options.policy.maximumPriceAgeMs) {
    reasons.push("market observation is stale");
  }
  if (evidence.license !== options.policy.requireLicense) reasons.push("oracle license is not authorized");
  const unique = [...new Set(reasons)];
  return {
    admissibility: unique.length === 0 ? "ADMISSIBLE" : evidence.simulated || evidence.disabled ? "INADMISSIBLE" : "INVALID",
    reasons: unique,
  };
}
