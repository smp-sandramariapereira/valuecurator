import { parseOracleEvidence, type OracleEvidenceV2 } from "@valuecurator/oracle-contracts";

export function normalizeEvidence(value: unknown): OracleEvidenceV2 {
  return parseOracleEvidence(value);
}
