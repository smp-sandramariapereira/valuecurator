import { z } from "zod";
import { PROVIDER_IDS } from "./oracle-evidence.js";

export const subscriptionPlanSchema = z
  .object({
    id: z.enum(["basic", "operator"]),
    providers: z.array(z.enum(PROVIDER_IDS)).min(1),
    fallback: z.boolean(),
    monthlyRequestLimit: z.number().int().positive(),
    byok: z.boolean(),
  })
  .strict();

export type SubscriptionPlan = z.infer<typeof subscriptionPlanSchema>;

export const entitlementSchema = z
  .object({
    planId: subscriptionPlanSchema.shape.id,
    providers: z.array(z.enum(PROVIDER_IDS)),
    fallback: z.boolean(),
    remainingRequests: z.number().int().nonnegative(),
  })
  .strict();

export type Entitlements = z.infer<typeof entitlementSchema>;

export function parseSubscriptionPlan(value: unknown): SubscriptionPlan {
  return subscriptionPlanSchema.parse(value);
}
