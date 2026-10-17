import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createExecutionProposal } from "../execution-proposal.js";
import type { LivePythEvidenceReport } from "../pyth-evidence.js";

const base: LivePythEvidenceReport = {
  schemaVersion: 1,
  source: "pyth-pro",
  simulated: false,
  transactionSubmitted: false,
  generatedAt: "1970-01-01T00:16:41.000Z",
  symbol: "AAPLx",
  mint: "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp",
  marketNetwork: "mainnet-beta",
  executableSource: "jupiter",
  quoteInputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  quoteInputAmount: "100000000",
  quoteExpectedOutputAmount: "300000000",
  quoteMinimumOutputAmount: "297000000",
  multiplierNano: "1000000000",
  priceImpactBps: 8,
  routeHops: 1,
  referenceFeedId: "ab".repeat(32),
  referencePriceMicros: "343440000",
  executablePriceMicros: "343810000",
  confidenceMicros: "62170",
  publishTimeMs: 1_000_000,
  priceAgeMs: 1_000,
  deviationBps: 10.77,
  confidenceBps: 1.81,
  maximumPriceAgeMs: 30_000,
  maximumDeviationBps: 200,
  maximumConfidenceBps: 100,
  maximumPriceImpactBps: 200,
  calculationPolicyVersion: "kairos-market-policy-v1",
  calculations: [],
  decision: "APPROVED",
  reasons: [],
};

describe("admissible providers", () => {
  it("lets Hermes evidence reach approval without submitting a transaction", () => {
    const proposal = createExecutionProposal({
      evidence: {
        ...base,
        schemaVersion: 2,
        source: "pyth-hermes",
        providerId: "pyth-hermes",
        admissibility: "ADMISSIBLE",
        license: "authorized",
      },
      nowMs: 1_001_000,
    });
    assert.equal(proposal.status, "READY_FOR_APPROVAL");
    assert.equal(proposal.executionMode, "APPROVAL_ONLY");
    assert.equal(proposal.executionEnabled, false);
    assert.equal(proposal.providerId, "pyth-hermes");
  });

  it("still blocks simulated evidence", () => {
    const proposal = createExecutionProposal({
      evidence: { ...base, source: "fixture", simulated: true },
      nowMs: 1_001_000,
    });
    assert.equal(proposal.status, "BLOCKED");
    assert.equal(proposal.executionEnabled, false);
  });
});
