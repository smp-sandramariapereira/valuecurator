import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createExecutionProposal } from "../execution-proposal.js";
import { validateEvidence } from "./evidence-validator.js";
import { mandateOraclePolicy } from "./oracle-policy.js";
import { parseOracleEvidence } from "@valuecurator/oracle-contracts";

describe("local oracle path", () => {
  it("keeps an admissible observation in approval-only mode", () => {
    const asset = {
      symbol: "AAPLx",
      mint: "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp",
      network: "mainnet-beta" as const,
    };
    const oracle = parseOracleEvidence({
      schemaVersion: 2,
      providerId: "pyth-pro",
      feedId: "922",
      asset,
      price: "343440000",
      confidence: "62170",
      publishTimeMs: 1_000_000,
      observedAtMs: 1_001_000,
      payloadDigest: "d".repeat(64),
      provenance: "pyth-pro parsed price",
      license: "authorized",
      simulated: false,
      disabled: false,
    });
    const decision = validateEvidence({
      evidence: oracle,
      expectedAsset: asset,
      expectedProviderId: "pyth-pro",
      policy: mandateOraclePolicy({
        allowedProviders: ["pyth-pro"],
        fallbackOptIn: false,
        maximumPriceAgeMs: 30_000,
      }),
    });
    assert.equal(decision.admissibility, "ADMISSIBLE");
    const proposal = createExecutionProposal({
      evidence: {
        schemaVersion: 2,
        source: "pyth-pro",
        providerId: "pyth-pro",
        admissibility: decision.admissibility,
        license: "authorized",
        simulated: false,
        transactionSubmitted: false,
        generatedAt: "1970-01-01T00:16:41.000Z",
        symbol: asset.symbol,
        mint: asset.mint,
        marketNetwork: "mainnet-beta",
        executableSource: "jupiter",
        quoteInputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        quoteInputAmount: "100000000",
        quoteExpectedOutputAmount: "290000",
        quoteMinimumOutputAmount: "289000",
        multiplierNano: "1000000000",
        priceImpactBps: 8,
        routeHops: 1,
        referenceFeedId: "922",
        referencePriceMicros: oracle.price,
        executablePriceMicros: "343810000",
        confidenceMicros: oracle.confidence,
        publishTimeMs: oracle.publishTimeMs,
        priceAgeMs: 1_000,
        deviationBps: 10,
        confidenceBps: 1.81,
        maximumPriceAgeMs: 30_000,
        maximumDeviationBps: 200,
        maximumConfidenceBps: 100,
        maximumPriceImpactBps: 200,
        calculationPolicyVersion: "kairos-market-policy-v1",
        calculations: [],
        decision: "APPROVED",
        reasons: [],
      },
      nowMs: 1_001_000,
    });
    assert.equal(proposal.status, "READY_FOR_APPROVAL");
    assert.equal(proposal.executionEnabled, false);
    assert.equal(proposal.programNetwork, "devnet");
    assert.equal(proposal.marketNetwork, "mainnet-beta");
  });
});
