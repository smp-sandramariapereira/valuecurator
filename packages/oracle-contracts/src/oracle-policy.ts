import { z } from "zod";
import { PROVIDER_IDS } from "./oracle-evidence.js";

export const providerCapabilitiesSchema = z
  .object({
    providerId: z.enum(PROVIDER_IDS),
    enabled: z.boolean(),
    credentialRequired: z.boolean(),
    aggregationAllowed: z.literal(false),
  })
  .strict();

export type ProviderCapabilities = z.infer<typeof providerCapabilitiesSchema>;

export const oraclePolicySchema = z
  .object({
    schemaVersion: z.literal(1),
    allowedProviders: z.array(z.enum(PROVIDER_IDS)).min(1),
    fallbackOptIn: z.boolean(),
    maximumPriceAgeMs: z.number().int().positive(),
    requireLicense: z.literal("authorized"),
  })
  .strict();

export type OraclePolicy = z.infer<typeof oraclePolicySchema>;

export function parseOraclePolicy(value: unknown): OraclePolicy {
  return oraclePolicySchema.parse(value);
}
