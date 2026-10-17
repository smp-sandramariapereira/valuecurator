import { isProviderId, type ProviderId } from "@valuecurator/oracle-contracts";
import { validateEntitlement } from "../subscriptions/entitlement-validator.js";
import { planById } from "../subscriptions/plan-policy.js";
import { listProviders } from "./oracle-registry.js";

export type CatalogProvider = {
  id: string;
  enabled: boolean;
  credentialRequired: boolean;
  costLabel: string;
  licenseLabel: string;
};

export function oracleCatalog(): { providers: CatalogProvider[] } {
  return {
    providers: listProviders().map((provider) => ({
      id: provider.providerId,
      enabled: provider.enabled,
      credentialRequired: provider.credentialRequired,
      costLabel: "Provider terms apply. This is not a ValueCurator price.",
      licenseLabel: provider.enabled
        ? "The server must record an authorized license before the evidence can pass."
        : "Disabled until a real feed, terms, and provenance are confirmed.",
    })),
  };
}

export function entitlementHttp(options: {
  authorization: string | null;
  serverToken: string | undefined;
  serverPlanId: string;
  body: { planId?: unknown; providerId?: unknown; requestId?: unknown };
}): { status: number; body: Record<string, unknown> } {
  if (!options.serverToken || options.authorization !== `Bearer ${options.serverToken}`) {
    return { status: 401, body: { error: "server authorization is required" } };
  }
  const providerId = options.body.providerId;
  const requestId = options.body.requestId;
  if (typeof providerId !== "string" || !isProviderId(providerId)) {
    return { status: 400, body: { error: "oracle provider is not registered" } };
  }
  if (typeof requestId !== "string" || !requestId.trim()) {
    return { status: 400, body: { error: "request id is required" } };
  }
  let serverPlan;
  try {
    serverPlan = planById(options.serverPlanId);
  } catch {
    return { status: 500, body: { error: "server plan is not configured" } };
  }
  const clientPlanId = typeof options.body.planId === "string" ? options.body.planId : null;
  const decision = validateEntitlement({
    serverPlan,
    clientPlanId,
    providerId: providerId as ProviderId,
    usedRequests: 0,
    requestId,
  });
  if (!decision.granted) return { status: 403, body: { granted: false, reasons: decision.reasons } };
  return { status: 200, body: { granted: true, entitlements: decision.entitlements } };
}
