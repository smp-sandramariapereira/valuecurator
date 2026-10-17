import { payloadDigest, type AssetIdentity, type OracleEvidenceV2 } from "@valuecurator/oracle-contracts";
import { fetchPythProPrice } from "../../pyth-pro.js";

export type AdapterFetchInput = {
  feedId: string;
  asset: AssetIdentity;
  apiUrl?: string;
  apiKey?: string;
  observedAtMs: number;
  license: "authorized" | "missing" | "restricted";
  signal?: AbortSignal;
};

export async function fetchPythProEvidence(input: AdapterFetchInput): Promise<OracleEvidenceV2> {
  const apiKey = input.apiKey?.trim() ?? "";
  if (!apiKey) throw new Error("Pyth Pro credential is required");
  const price = await fetchPythProPrice({
    feedId: input.feedId,
    apiKey,
    ...(input.apiUrl ? { apiUrl: input.apiUrl } : {}),
    ...(input.signal ? { signal: input.signal } : {}),
  });
  const parsed = {
    providerId: "pyth-pro" as const,
    feedId: price.feedId,
    price: price.priceMicros.toString(),
    confidence: price.confidenceMicros.toString(),
    publishTimeMs: price.publishTimeMs,
  };
  return {
    schemaVersion: 2,
    providerId: "pyth-pro",
    feedId: price.feedId,
    asset: input.asset,
    price: parsed.price,
    confidence: parsed.confidence,
    publishTimeMs: price.publishTimeMs,
    observedAtMs: input.observedAtMs,
    payloadDigest: payloadDigest(parsed),
    provenance: "pyth-pro parsed price",
    license: input.license,
    simulated: false,
    disabled: false,
  };
}
