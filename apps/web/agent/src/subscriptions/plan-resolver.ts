import type { SubscriptionPlan } from "@valuecurator/oracle-contracts";
import { planById } from "./plan-policy.js";

export function resolveServerPlan(serverPlanId: string): SubscriptionPlan {
  return planById(serverPlanId);
}
