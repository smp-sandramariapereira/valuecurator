import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getProvider } from "./oracle-registry.js";

describe("oracle registry", () => {
  it("resolves an explicit provider id and refuses to guess from a feed", () => {
    assert.equal(getProvider("pyth-pro").providerId, "pyth-pro");
    assert.throws(() => getProvider("922"), /not registered/);
    assert.equal(getProvider("chainlink").enabled, false);
    assert.equal(getProvider("switchboard").enabled, false);
    assert.equal(getProvider("redstone").enabled, false);
  });
});
