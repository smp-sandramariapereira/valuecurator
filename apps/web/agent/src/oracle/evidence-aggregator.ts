import { sameAsset, type OracleEvidenceV2 } from "@valuecurator/oracle-contracts";

export type AggregateResult =
  | { status: "DISABLED"; reasons: readonly ["multi-source aggregation is disabled"] }
  | { status: "BLOCKED"; reasons: readonly string[] }
  | { status: "READY"; evidence: OracleEvidenceV2 };

export function aggregateEvidence(options: {
  enabled: boolean;
  evidences: readonly OracleEvidenceV2[];
  maximumSkewMs: number;
}): AggregateResult {
  if (!options.enabled) return { status: "DISABLED", reasons: ["multi-source aggregation is disabled"] };
  const [first, ...rest] = options.evidences;
  if (!first) return { status: "BLOCKED", reasons: ["aggregation requires evidence"] };
  for (const evidence of rest) {
    if (!sameAsset(first.asset, evidence.asset)) {
      return { status: "BLOCKED", reasons: ["aggregation requires the same asset"] };
    }
    if (Math.abs(first.publishTimeMs - evidence.publishTimeMs) > options.maximumSkewMs) {
      return { status: "BLOCKED", reasons: ["aggregation requires comparable publication times"] };
    }
  }
  return { status: "READY", evidence: first };
}
