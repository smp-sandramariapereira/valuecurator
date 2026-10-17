import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { selectProviders } from "./oracle-selector.js";

describe("oracle selector", () => {
  it("blocks a fallback the plan did not allow", () => {
    const selection = selectProviders({
      requested: ["pyth-pro", "pyth-hermes"],
      entitlements: {
        planId: "basic",
        providers: ["pyth-hermes"],
        fallback: false,
        remainingRequests: 10,
      },
      fallbackOptIn: true,
    });
    assert.deepEqual(selection.providers, ["pyth-hermes"]);
    assert.match(selection.reasons.join(" "), /pyth-pro/);
  });

  it("keeps a disabled provider out of the selection", () => {
    const selection = selectProviders({
      requested: ["chainlink"],
      entitlements: {
        planId: "operator",
        providers: ["chainlink", "pyth-pro"],
        fallback: true,
        remainingRequests: 10,
      },
      fallbackOptIn: true,
    });
    assert.deepEqual(selection.providers, []);
    assert.match(selection.reasons.join(" "), /disabled/);
  });
});
