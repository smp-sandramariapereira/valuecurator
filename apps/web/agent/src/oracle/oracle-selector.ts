import type { ProviderId } from "@valuecurator/oracle-contracts";
import type { Entitlements } from "@valuecurator/oracle-contracts";
import { getProvider } from "./oracle-registry.js";

export type Selection = {
  providers: readonly ProviderId[];
  reasons: readonly string[];
};

export function selectProviders(options: {
  requested: readonly ProviderId[];
  entitlements: Entitlements;
  fallbackOptIn: boolean;
}): Selection {
  const reasons: string[] = [];
  const allowed = options.requested.filter((providerId) => {
    const registered = getProvider(providerId);
    if (!registered.enabled) {
      reasons.push(`${providerId} is disabled`);
      return false;
    }
    if (!options.entitlements.providers.includes(providerId)) {
      reasons.push(`${providerId} is outside the plan`);
      return false;
    }
    return true;
  });
  if (!options.fallbackOptIn || !options.entitlements.fallback) {
    const first = allowed[0];
    return { providers: first ? [first] : [], reasons };
  }
  return { providers: allowed, reasons };
}
