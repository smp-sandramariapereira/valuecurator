import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createExecutionProposal } from "./execution-proposal.js";
import { createMarketSimulation } from "./market-simulation.js";

describe("dashboard market simulations", () => {
  const nowMs = Date.UTC(2026, 8, 22, 12, 0, 0);

  it("produces an explicitly simulated safe decision", () => {
    const evidence = createMarketSimulation("safe", nowMs);
    assert.equal(evidence.source, "fixture");
    assert.equal(evidence.simulated, true);
    assert.equal(evidence.decision, "APPROVED");
    assert.equal(evidence.transactionSubmitted, false);
    assert.equal(evidence.quoteInputDecimals, 6);
    assert.equal(evidence.quoteOutputDecimals, 8);
    assert.equal(evidence.quoteInputAmount, "100000000");
    assert.equal(evidence.quoteExpectedOutputAmount, "29200000");
    assert.equal(evidence.calculations.every((calculation) => calculation.passed === true), true);

    const proposal = createExecutionProposal({ evidence, nowMs });
    assert.equal(proposal.status, "BLOCKED");
    assert.match(proposal.reasons.join(" "), /only live Pyth Pro evidence/);
  });

  it("blocks stale simulated evidence", () => {
    const evidence = createMarketSimulation("stale", nowMs);
    assert.equal(evidence.decision, "BLOCKED");
    assert.match(evidence.reasons.join(" "), /stale/);
    assert.equal(evidence.calculations.find((item) => item.id === "price_age")?.passed, false);
  });

  it("blocks excessive simulated price divergence", () => {
    const evidence = createMarketSimulation("divergent", nowMs);
    assert.equal(evidence.decision, "BLOCKED");
    assert.match(evidence.reasons.join(" "), /deviation/);
    assert.equal(evidence.calculations.find((item) => item.id === "price_deviation")?.passed, false);
  });
});
