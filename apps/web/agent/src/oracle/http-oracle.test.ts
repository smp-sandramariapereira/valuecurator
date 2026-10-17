import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { entitlementHttp, oracleCatalog } from "./http-oracle.js";

describe("oracle catalog", () => {
  it("lists providers without credentials", () => {
    const catalog = oracleCatalog();
    const encoded = JSON.stringify(catalog);
    assert.equal(encoded.includes("apiKey"), false);
    assert.equal(encoded.includes("Bearer"), false);
    assert.equal(catalog.providers.some((provider) => provider.id === "chainlink" && provider.enabled === false), true);
    assert.equal(catalog.providers.some((provider) => provider.id === "switchboard" && provider.enabled === false), true);
    assert.equal(catalog.providers.some((provider) => provider.id === "redstone" && provider.enabled === false), true);
    assert.equal(catalog.providers.length, 5);
  });
});

describe("entitlement route", () => {
  it("rejects a client plan that disagrees with the server plan", () => {
    const response = entitlementHttp({
      authorization: "Bearer local-token",
      serverToken: "local-token",
      serverPlanId: "basic",
      body: { planId: "operator", providerId: "pyth-pro", requestId: "ui-1" },
    });
    assert.equal(response.status, 403);
  });

  it("rejects a missing server token", () => {
    const response = entitlementHttp({
      authorization: null,
      serverToken: undefined,
      serverPlanId: "basic",
      body: { planId: "basic", providerId: "pyth-hermes", requestId: "ui-2" },
    });
    assert.equal(response.status, 401);
  });
});
