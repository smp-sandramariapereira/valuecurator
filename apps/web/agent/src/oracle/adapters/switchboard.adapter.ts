import type { OracleEvidenceV2 } from "@valuecurator/oracle-contracts";
import type { AdapterFetchInput } from "./pyth-pro.adapter.js";

export const SWITCHBOARD_DISABLED_REASON =
  "switchboard adapter is disabled until a real feed, terms, and provenance are confirmed";

export async function fetchSwitchboardEvidence(_input: AdapterFetchInput): Promise<OracleEvidenceV2> {
  throw new Error(SWITCHBOARD_DISABLED_REASON);
}
