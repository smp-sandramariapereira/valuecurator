import { createHash } from "node:crypto";
import { z } from "zod";
import { assetIdentitySchema } from "./asset-identity.js";

export const ORACLE_EVIDENCE_SCHEMA_VERSION = 2 as const;
export const PROVIDER_IDS = ["pyth-pro", "pyth-hermes", "chainlink", "switchboard", "redstone"] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export function isProviderId(value: string): value is ProviderId {
  return (PROVIDER_IDS as readonly string[]).includes(value);
}

const decimal = z.string().regex(/^(0|[1-9]\d*)$/);

export const oracleEvidenceSchema = z
  .object({
    schemaVersion: z.literal(ORACLE_EVIDENCE_SCHEMA_VERSION),
    providerId: z.enum(PROVIDER_IDS),
    feedId: z.string().trim().min(1),
    asset: assetIdentitySchema,
    price: decimal,
    confidence: decimal.nullable(),
    publishTimeMs: z.number().int().nonnegative(),
    observedAtMs: z.number().int().nonnegative(),
    payloadDigest: z.string().regex(/^[0-9a-f]{64}$/),
    provenance: z.string().trim().min(1),
    license: z.enum(["authorized", "missing", "restricted"]),
    simulated: z.boolean(),
    disabled: z.boolean(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.price === "0") {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "price must be positive" });
    }
    if (value.publishTimeMs > value.observedAtMs) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "publish time is in the future" });
    }
    if (value.confidence === null) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "confidence is absent" });
    }
  });

export type OracleEvidenceV2 = z.infer<typeof oracleEvidenceSchema>;

export function canonicalize(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
    .join(",")}}`;
}

export function payloadDigest(value: unknown): string {
  return createHash("sha256").update(canonicalize(value)).digest("hex");
}

export function parseOracleEvidence(value: unknown): OracleEvidenceV2 {
  return oracleEvidenceSchema.parse(value);
}

export function evidenceRoundtrip(value: OracleEvidenceV2): OracleEvidenceV2 {
  return parseOracleEvidence(JSON.parse(canonicalize(value)));
}
