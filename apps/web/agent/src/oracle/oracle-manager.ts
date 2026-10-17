import { parseOracleEvidence, type AssetIdentity, type OracleEvidenceV2, type ProviderId } from "@valuecurator/oracle-contracts";
import type { AdapterFetchInput } from "./adapters/pyth-pro.adapter.js";
import { validateEvidence, type EvidenceDecision } from "./evidence-validator.js";
import { mandateOraclePolicy } from "./oracle-policy.js";
import { getProvider } from "./oracle-registry.js";
import { selectProviders } from "./oracle-selector.js";
import type { Entitlements } from "@valuecurator/oracle-contracts";

export type ManagedEvidence = {
  evidence: OracleEvidenceV2 | null;
  decision: EvidenceDecision;
  providerId: ProviderId | null;
};

export async function collectAdmissibleEvidence(options: {
  requested: readonly ProviderId[];
  entitlements: Entitlements;
  fallbackOptIn: boolean;
  asset: AssetIdentity;
  feedId: string;
  maximumPriceAgeMs: number;
  credentialFor: (providerId: ProviderId) => string | undefined;
  apiUrlFor: (providerId: ProviderId) => string | undefined;
  licenseFor: (providerId: ProviderId) => AdapterFetchInput["license"];
  observedAtMs?: number;
  signal?: AbortSignal;
}): Promise<ManagedEvidence> {
  const selection = selectProviders({
    requested: options.requested,
    entitlements: options.entitlements,
    fallbackOptIn: options.fallbackOptIn,
  });
  const policy = mandateOraclePolicy({
    allowedProviders: selection.providers.length > 0 ? selection.providers : ["pyth-pro"],
    fallbackOptIn: options.fallbackOptIn,
    maximumPriceAgeMs: options.maximumPriceAgeMs,
  });
  const observedAtMs = options.observedAtMs ?? Date.now();
  if (selection.providers.length === 0) {
    return {
      evidence: null,
      providerId: null,
      decision: { admissibility: "INADMISSIBLE", reasons: selection.reasons.length ? selection.reasons : ["no oracle provider is allowed"] },
    };
  }
  const reasons = [...selection.reasons];
  for (const providerId of selection.providers) {
    const provider = getProvider(providerId);
    if (provider.credentialRequired && !options.credentialFor(providerId)?.trim()) {
      reasons.push(`${providerId} credential is required`);
      continue;
    }
    try {
      const apiUrl = options.apiUrlFor(providerId);
      const apiKey = options.credentialFor(providerId);
      const raw = await provider.fetchEvidence({
        feedId: options.feedId,
        asset: options.asset,
        observedAtMs,
        license: options.licenseFor(providerId),
        ...(apiUrl ? { apiUrl } : {}),
        ...(apiKey ? { apiKey } : {}),
        ...(options.signal ? { signal: options.signal } : {}),
      });
      const evidence = parseOracleEvidence(raw);
      const decision = validateEvidence({
        evidence,
        expectedAsset: options.asset,
        expectedProviderId: providerId,
        policy,
      });
      if (decision.admissibility === "ADMISSIBLE") {
        return { evidence, decision, providerId };
      }
      reasons.push(...decision.reasons);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      reasons.push(message);
    }
  }
  return {
    evidence: null,
    providerId: null,
    decision: { admissibility: "INADMISSIBLE", reasons: [...new Set(reasons)] },
  };
}
