import { isProviderId, type ProviderId } from "@valuecurator/oracle-contracts";
import { getProvider } from "./oracle/oracle-registry.js";

export type MarketOracleSelection = {
  providerId: ProviderId;
  feedId: string;
  apiUrl?: string;
  apiKey?: string;
};

function credentialName(providerId: ProviderId): string {
  if (providerId === "pyth-pro") return "KAIROS_PYTH_API_KEY";
  return `KAIROS_${providerId.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_API_KEY`;
}

/** Reads the explicit server selection. An empty provider is an error, not a Pyth default. */
export function readMarketOracleSelection(env: Record<string, string | undefined>): MarketOracleSelection {
  const providerId = env.KAIROS_ORACLE_PROVIDER?.trim() ?? "";
  if (!providerId) throw new Error("Missing configuration: KAIROS_ORACLE_PROVIDER");
  if (!isProviderId(providerId)) throw new Error("KAIROS_ORACLE_PROVIDER is not a registered oracle provider");
  const provider = getProvider(providerId);
  if (!provider.enabled) throw new Error(`${providerId} is disabled`);
  const feedId = env.KAIROS_ORACLE_FEED_ID?.trim() ?? "";
  if (!feedId) throw new Error("Missing configuration: KAIROS_ORACLE_FEED_ID");
  const apiUrl = env.KAIROS_ORACLE_API_URL?.trim() || undefined;
  if (!provider.credentialRequired) {
    return { providerId, feedId, ...(apiUrl ? { apiUrl } : {}) };
  }
  const name = credentialName(providerId);
  const apiKey = env[name]?.trim() ?? "";
  if (!apiKey) throw new Error(`Missing configuration: ${name}`);
  return { providerId, feedId, apiKey, ...(apiUrl ? { apiUrl } : {}) };
}
