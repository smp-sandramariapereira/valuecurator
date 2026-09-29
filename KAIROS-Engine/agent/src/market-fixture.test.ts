import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { loadMarketFixture, evaluateMarketFixture } from "./market-fixture.js";

function fixture(name: string): string {
  return fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));
}

describe("safe simulated market evidence", () => {
  it("approves bounded evidence without submitting a transaction", () => {
    const result = evaluateMarketFixture({
      fixture: loadMarketFixture(fixture("aapl-valid.json")), nowMs: 2_000_000,
    });
    assert.equal(result.decision.allowed, true);
    assert.equal(result.report.decision, "APPROVED");
    assert.equal(result.report.simulated, true);
    assert.equal(result.report.transactionSubmitted, false);
  });

  it("blocks stale evidence", () => {
    const result = evaluateMarketFixture({
      fixture: loadMarketFixture(fixture("aapl-stale.json")), nowMs: 2_000_000,
    });
    assert.equal(result.decision.allowed, false);
    assert.match(result.decision.reasons.join(" "), /stale/);
  });

  it("blocks excessive executable-price deviation", () => {
    const result = evaluateMarketFixture({
      fixture: loadMarketFixture(fixture("aapl-divergent.json")), nowMs: 2_000_000,
    });
    assert.equal(result.decision.allowed, false);
    assert.match(result.decision.reasons.join(" "), /deviation/);
  });
});
