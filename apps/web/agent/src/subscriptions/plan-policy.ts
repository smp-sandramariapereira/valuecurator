import { parseSubscriptionPlan, type ProviderId, type SubscriptionPlan } from "@valuecurator/oracle-contracts";

export const SUBSCRIPTION_PLANS: Record<SubscriptionPlan["id"], SubscriptionPlan> = {
  basic: parseSubscriptionPlan({
    id: "basic",
    providers: ["pyth-hermes"],
    fallback: false,
    monthlyRequestLimit: 100,
    byok: false,
  }),
  operator: parseSubscriptionPlan({
    id: "operator",
    providers: ["pyth-pro", "pyth-hermes"],
    fallback: true,
    monthlyRequestLimit: 10_000,
    byok: true,
  }),
};

export function planById(id: string): SubscriptionPlan {
  if (id !== "basic" && id !== "operator") throw new Error("subscription plan is not configured");
  return SUBSCRIPTION_PLANS[id];
}

export function providerAllowed(plan: SubscriptionPlan, providerId: ProviderId): boolean {
  return plan.providers.includes(providerId);
}
