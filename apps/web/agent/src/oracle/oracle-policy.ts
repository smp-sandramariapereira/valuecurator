import { parseOraclePolicy, type OraclePolicy, type ProviderId } from "@valuecurator/oracle-contracts";

export function mandateOraclePolicy(options: {
  allowedProviders: readonly ProviderId[];
  fallbackOptIn: boolean;
  maximumPriceAgeMs: number;
}): OraclePolicy {
  return parseOraclePolicy({
    schemaVersion: 1,
    allowedProviders: [...options.allowedProviders],
    fallbackOptIn: options.fallbackOptIn,
    maximumPriceAgeMs: options.maximumPriceAgeMs,
    requireLicense: "authorized",
  });
}
