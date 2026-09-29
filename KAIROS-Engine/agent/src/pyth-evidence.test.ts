import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createLivePythEvidence } from "./pyth-evidence.js";

const price = {
  feedId: "922",
  priceMicros: 343_440_000n,
  confidenceMicros: 62_170n,
  publishTimeMs: 1_000_000,
};

function quote(executablePriceMicros = 343_810_000n) {
  return {
    mint: "AAPLX_MINT",
    source: "jupiter" as const,
    network: "mainnet-beta" as const,
    inputMint: "USDC_MINT",
    inputAmount: 100_000_000n,
    expectedOutputAmount: 300_000_000n,
    minimumOutputAmount: 297_000_000n,
    multiplierNano: 1_000_000_000n,
    executablePriceMicros,
    priceImpactBps: 8,
    routeHops: 2,
  };
}

describe("live Pyth read-only evidence", () => {
  it("blocks a live observation without an executable quote", () => {
    const report = createLivePythEvidence({ price, symbol: "AAPLx", nowMs: 1_001_000 });
    assert.equal(report.source, "pyth-pro");
    assert.equal(report.simulated, false);
    assert.equal(report.referenceFeedId, "922");
    assert.equal(report.confidenceBps, 1.81);
    assert.equal(report.executablePriceMicros, null);
    assert.equal(report.deviationBps, null);
    assert.equal(report.decision, "BLOCKED");
    assert.equal(report.transactionSubmitted, false);
    assert.match(report.reasons.join(" "), /executable quote is unavailable/);
  });

  it("approves matching Pyth and Jupiter evidence and records quote provenance", () => {
    const report = createLivePythEvidence({
      price,
      symbol: "AAPLx",
      executableQuote: quote(),
      nowMs: 1_001_000,
    });
    assert.equal(report.decision, "APPROVED");
    assert.equal(report.executablePriceMicros, "343810000");
    assert.equal(report.deviationBps, 10.77);
    assert.equal(report.mint, "AAPLX_MINT");
    assert.equal(report.executableSource, "jupiter");
    assert.equal(report.marketNetwork, "mainnet-beta");
    assert.equal(report.routeHops, 2);
    assert.equal(report.calculationPolicyVersion, "kairos-market-policy-v1");
    assert.deepEqual(
      report.calculations.map((calculation) => [calculation.id, calculation.result.value, calculation.passed]),
      [
        ["price_age", "1000", true],
        ["confidence_ratio", "1.81", true],
        ["price_deviation", "10.77", true],
        ["price_impact", "8", true],
      ],
    );
    assert.deepEqual(report.reasons, []);
  });

  it("blocks divergent, stale, future-dated, and operationally unsafe evidence", () => {
    const divergent = createLivePythEvidence({
      price,
      symbol: "AAPLx",
      executableQuote: quote(374_000_000n),
      nowMs: 1_001_000,
    });
    assert.match(divergent.reasons.join(" "), /deviation/);

    const stale = createLivePythEvidence({
      price,
      symbol: "AAPLx",
      executableQuote: quote(),
      nowMs: 1_060_000,
    });
    assert.match(stale.reasons.join(" "), /stale/);

    const future = createLivePythEvidence({
      price: { ...price, publishTimeMs: 1_001_000 },
      symbol: "AAPLx",
      executableQuote: quote(),
      nowMs: 1_000_000,
    });
    assert.match(future.reasons.join(" "), /in the future/);

    const guarded = createLivePythEvidence({
      price,
      symbol: "AAPLx",
      executableQuote: quote(),
      additionalReasons: ["xStocks multiplier activation is inside the safety window"],
      nowMs: 1_001_000,
    });
    assert.equal(guarded.decision, "BLOCKED");
    assert.match(guarded.reasons.join(" "), /safety window/);
  });
});
