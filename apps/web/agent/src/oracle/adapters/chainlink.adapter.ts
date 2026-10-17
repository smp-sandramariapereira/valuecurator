import type { OracleEvidenceV2 } from "@valuecurator/oracle-contracts";
import type { AdapterFetchInput } from "./pyth-pro.adapter.js";

export const CHAINLINK_DISABLED_REASON =
  "chainlink adapter is disabled until a real feed, terms, and provenance are confirmed";

export async function fetchChainlinkEvidence(_input: AdapterFetchInput): Promise<OracleEvidenceV2> {
  throw new Error(CHAINLINK_DISABLED_REASON);
}
