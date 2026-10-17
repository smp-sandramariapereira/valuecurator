import type { OracleEvidenceV2 } from "@valuecurator/oracle-contracts";
import type { AdapterFetchInput } from "./pyth-pro.adapter.js";

export const REDSTONE_DISABLED_REASON =
  "redstone adapter is disabled until a real feed, terms, and provenance are confirmed";

export async function fetchRedstoneEvidence(_input: AdapterFetchInput): Promise<OracleEvidenceV2> {
  throw new Error(REDSTONE_DISABLED_REASON);
}
