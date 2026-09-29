import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canVisitMandateStep,
  dashboardViewSearch,
  mandateStepSearch,
  parseDashboardView,
  parseMandateStep,
} from "../../lib/dashboard-navigation.js";

describe("dashboard navigation", () => {
  it("accepts only known dashboard views", () => {
    assert.equal(parseDashboardView("mandate"), "mandate");
    assert.equal(parseDashboardView("unknown"), "overview");
    assert.equal(parseDashboardView(null), "overview");
  });

  it("preserves unrelated query parameters and removes stale mandate steps", () => {
    assert.equal(dashboardViewSearch("?owner=abc&step=review", "gate"), "?owner=abc&view=gate");
    assert.equal(dashboardViewSearch("?owner=abc", "mandate"), "?owner=abc&view=mandate");
  });

  it("creates reproducible mandate deep links", () => {
    assert.equal(mandateStepSearch("?owner=abc", 2), "?owner=abc&view=mandate&step=simulation");
    assert.equal(parseMandateStep("review"), 3);
    assert.equal(parseMandateStep("invalid"), 0);
  });

  it("blocks simulation and review while risk limits are invalid", () => {
    assert.equal(canVisitMandateStep(0, 2), true);
    assert.equal(canVisitMandateStep(1, 2), true);
    assert.equal(canVisitMandateStep(2, 2), false);
    assert.equal(canVisitMandateStep(3, 1), false);
    assert.equal(canVisitMandateStep(3, 0), true);
  });
});
