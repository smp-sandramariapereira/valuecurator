import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { validateEntitlement } from "./entitlement-validator.js";
import { SUBSCRIPTION_PLANS } from "./plan-policy.js";
import { resetUsageMeter } from "./usage-meter.js";

describe("entitlements", () => {
  beforeEach(() => resetUsageMeter());

  it("denies a provider outside the server plan even if the client names another plan", () => {
    const decision = validateEntitlement({
      serverPlan: SUBSCRIPTION_PLANS.basic,
      clientPlanId: "operator",
      providerId: "pyth-pro",
      usedRequests: 0,
      requestId: "req-1",
    });
    assert.equal(decision.granted, false);
    assert.match(decision.reasons.join(" "), /client plan/);
    assert.match(decision.reasons.join(" "), /outside the server plan/);
  });
});
