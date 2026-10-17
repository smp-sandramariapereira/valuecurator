import type { Entitlements, ProviderId, SubscriptionPlan } from "@valuecurator/oracle-contracts";
import { providerAllowed } from "./plan-policy.js";
import { recordUsage } from "./usage-meter.js";

export type EntitlementDecision = {
  granted: boolean;
  entitlements: Entitlements | null;
  reasons: readonly string[];
};

export function validateEntitlement(options: {
  serverPlan: SubscriptionPlan;
  clientPlanId?: string | null;
  providerId: ProviderId;
  usedRequests: number;
  requestId: string;
}): EntitlementDecision {
  const reasons: string[] = [];
  if (options.clientPlanId && options.clientPlanId !== options.serverPlan.id) {
    reasons.push("client plan does not grant entitlements");
  }
  if (!providerAllowed(options.serverPlan, options.providerId)) {
    reasons.push("provider is outside the server plan");
  }
  if (reasons.length > 0) return { granted: false, entitlements: null, reasons };
  const usage = recordUsage(options.requestId);
  const used = options.usedRequests + (usage.counted ? 1 : 0);
  if (used > options.serverPlan.monthlyRequestLimit) {
    return { granted: false, entitlements: null, reasons: ["plan request limit is exhausted"] };
  }
  return {
    granted: true,
    reasons: [],
    entitlements: {
      planId: options.serverPlan.id,
      providers: [...options.serverPlan.providers],
      fallback: options.serverPlan.fallback,
      remainingRequests: options.serverPlan.monthlyRequestLimit - used,
    },
  };
}
