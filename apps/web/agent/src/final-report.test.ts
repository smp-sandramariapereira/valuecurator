import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createFinalExecutionReport, type ReportEvidence, type ReportProposal } from "./final-report.js";

const evidence: ReportEvidence = {
  source: "pyth-pro",
  simulated: false,
  generatedAt: "2026-09-22T12:00:00.000Z",
  symbol: "AAPLx",
  mint: "AAPLX_MINT",
  marketNetwork: "mainnet-beta",
  executableSource: "jupiter",
  quoteInputMint: "USDC_MINT",
  quoteInputAmount: "100000000",
  quoteInputDecimals: 6,
  quoteExpectedOutputAmount: "29200000",
  quoteMinimumOutputAmount: "29000000",
  quoteOutputDecimals: 8,
  referenceFeedId: "922",
  referencePriceMicros: "343440000",
  executablePriceMicros: "343810000",
  priceAgeMs: 1000,
  deviationBps: 10.77,
  confidenceBps: 1.81,
  maximumPriceAgeMs: 30000,
  maximumDeviationBps: 200,
  maximumConfidenceBps: 100,
  decision: "APPROVED",
  reasons: [],
  transactionSubmitted: false,
};

const proposal: ReportProposal = {
  proposalId: "proposal-1",
  evidenceDigest: "evidence-1",
  createdAt: "2026-09-22T12:00:00.000Z",
  validUntil: "2026-09-22T12:01:00.000Z",
  status: "READY_FOR_APPROVAL",
  executionMode: "APPROVAL_ONLY",
  executionEnabled: false,
  programNetwork: "devnet",
  marketNetwork: "mainnet-beta",
  requiredApprover: "owner",
  symbol: "AAPLx",
  mint: "AAPLX_MINT",
  inputMint: "USDC_MINT",
  inputAmount: "100000000",
  minimumOutputAmount: "29000000",
  referenceFeedId: "922",
  mandate: {
    maximumPriceAgeMs: 30000,
    maximumConfidenceBps: 100,
    maximumDeviationBps: 200,
  },
  reasons: [],
  executionBlockers: ["network separation"],
};

describe("final execution report", () => {
  it("reports an unsigned proposal without inventing an execution", () => {
    const report = createFinalExecutionReport({
      scenario: "live",
      evidence,
      proposal,
      nowMs: Date.parse("2026-09-22T12:00:10.000Z"),
    });
    assert.equal(report.operationStatus, "AWAITING_APPROVAL");
    assert.equal(report.stateTransition.after.transactionSubmitted, false);
    assert.equal(report.stateTransition.after.dailyQuotaConsumed, false);
    assert.equal(report.stateTransition.after.transactionSignature, null);
    assert.equal(report.marketEvidence.executableQuote.inputDecimals, 6);
    assert.equal(report.marketEvidence.executableQuote.outputDecimals, 8);
  });

  it("reports a signed authorization as authorized but not submitted", () => {
    const report = createFinalExecutionReport({
      scenario: "live",
      evidence,
      proposal,
      receipt: {
        kind: "KAIROS_PROPOSAL_APPROVAL",
        proposalId: proposal.proposalId,
        evidenceDigest: proposal.evidenceDigest,
        signer: "owner",
        signatureHex: "abcd",
        signedAt: "2026-09-22T12:00:15.000Z",
        transactionSubmitted: false,
      },
      nowMs: Date.parse("2026-09-22T12:02:00.000Z"),
    });
    assert.equal(report.operationStatus, "AUTHORIZED_NOT_SUBMITTED");
    assert.match(report.statement, /authorized.*not submitted/i);
    assert.equal(report.integrity.receiptMatchesProposal, true);
    assert.equal(report.stateTransition.after.portfolioChangedByKairos, false);
  });

  it("preserves blocking reasons", () => {
    const report = createFinalExecutionReport({
      scenario: "stale",
      evidence: { ...evidence, source: "fixture", simulated: true, decision: "BLOCKED", reasons: ["stale"] },
      proposal: { ...proposal, status: "BLOCKED", reasons: ["only live evidence"] },
      nowMs: Date.parse("2026-09-22T12:00:10.000Z"),
    });
    assert.equal(report.operationStatus, "BLOCKED");
    assert.deepEqual(report.decision.reasons, ["stale", "only live evidence"]);
  });

  it("keeps an approved simulation unsigned without calling it a policy block", () => {
    const report = createFinalExecutionReport({
      scenario: "safe",
      evidence: { ...evidence, source: "fixture", simulated: true, decision: "APPROVED", reasons: [] },
      proposal: {
        ...proposal,
        status: "BLOCKED",
        reasons: ["only live Pyth Pro evidence can create an approval proposal"],
      },
      nowMs: Date.parse("2026-09-22T12:00:10.000Z"),
    });
    assert.equal(report.operationStatus, "SIMULATION_NOT_SIGNABLE");
    assert.match(report.statement, /cannot be signed/i);
    assert.equal(report.stateTransition.after.transactionSubmitted, false);
  });
});
