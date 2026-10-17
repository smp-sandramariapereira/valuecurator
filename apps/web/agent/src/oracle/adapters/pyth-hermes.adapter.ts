import { payloadDigest, type OracleEvidenceV2 } from "@valuecurator/oracle-contracts";
import { fetchPythPrice } from "../../pyth.js";
import type { AdapterFetchInput } from "./pyth-pro.adapter.js";

export async function fetchPythHermesEvidence(input: AdapterFetchInput): Promise<OracleEvidenceV2> {
  const price = await fetchPythPrice({
    feedId: input.feedId,
    ...(input.apiUrl ? { apiUrl: input.apiUrl } : {}),
    ...(input.apiKey ? { apiKey: input.apiKey } : {}),
    ...(input.signal ? { signal: input.signal } : {}),
  });
  const parsed = {
    providerId: "pyth-hermes" as const,
    feedId: price.feedId,
    price: price.priceMicros.toString(),
    confidence: price.confidenceMicros.toString(),
    publishTimeMs: price.publishTimeMs,
  };
  return {
    schemaVersion: 2,
    providerId: "pyth-hermes",
    feedId: price.feedId,
    asset: input.asset,
    price: parsed.price,
    confidence: parsed.confidence,
    publishTimeMs: price.publishTimeMs,
    observedAtMs: input.observedAtMs,
    payloadDigest: payloadDigest(parsed),
    provenance: "pyth-hermes parsed price",
    license: input.license,
    simulated: false,
    disabled: false,
  };
}
