import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { describe, it } from "node:test";
import { PublicKey } from "@solana/web3.js";
import { verifyApprovalReceipt, type ApprovalReceipt } from "./approval-receipt.js";
import {
  createExecutionProposal,
  proposalApprovalMessage,
  verifyExecutionProposal,
  type ExecutionProposal,
} from "./execution-proposal.js";
import type { LivePythEvidenceReport } from "./pyth-evidence.js";

const evidence: LivePythEvidenceReport = {
  schemaVersion: 1,
  source: "pyth-pro",
  simulated: false,
  transactionSubmitted: false,
  generatedAt: "1970-01-01T00:16:41.000Z",
  symbol: "AAPLx",
  mint: "AAPLX_MINT",
  marketNetwork: "mainnet-beta",
  executableSource: "jupiter",
  quoteInputMint: "USDC_MINT",
  quoteInputAmount: "100000000",
  quoteExpectedOutputAmount: "300000000",
  quoteMinimumOutputAmount: "297000000",
  multiplierNano: "1000000000",
  priceImpactBps: 8,
  routeHops: 1,
  referenceFeedId: "922",
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

describe("execution approval proposal", () => {
  it("binds approved evidence and mandate fields without enabling execution", () => {
    const proposal = createExecutionProposal({
      evidence,
      requiredApprover: "OWNER",
      nowMs: 1_001_000,
    });
    assert.equal(proposal.status, "READY_FOR_APPROVAL");
    assert.equal(proposal.executionMode, "APPROVAL_ONLY");
    assert.equal(proposal.executionEnabled, false);
    assert.equal(proposal.requiredApprover, "OWNER");
    assert.equal(proposal.inputAmount, "100000000");
    assert.equal(proposal.minimumOutputAmount, "297000000");
    assert.equal(verifyExecutionProposal(proposal, 1_001_000).valid, true);
  });

  it("is deterministic for the same evidence and creation time", () => {
    const first = createExecutionProposal({ evidence, nowMs: 1_001_000 });
    const second = createExecutionProposal({ evidence, nowMs: 1_001_000 });
    assert.equal(first.proposalId, second.proposalId);
    assert.equal(first.evidenceDigest, second.evidenceDigest);
  });

  it("blocks rejected or expired evidence", () => {
    const rejected = createExecutionProposal({
      evidence: { ...evidence, decision: "BLOCKED", reasons: ["price deviation"] },
      nowMs: 1_001_000,
    });
    assert.equal(rejected.status, "BLOCKED");
    assert.match(rejected.reasons.join(" "), /not approved/);

    const expired = createExecutionProposal({ evidence, nowMs: 1_030_001 });
    assert.equal(expired.status, "BLOCKED");
    assert.match(expired.reasons.join(" "), /expired/);
  });

  it("detects tampering and reports expiry after creation", () => {
    const proposal = createExecutionProposal({ evidence, nowMs: 1_001_000 });
    const tampered = { ...proposal, inputAmount: "999999999" } as ExecutionProposal;
    assert.equal(verifyExecutionProposal(tampered, 1_001_000).valid, false);

    const verification = verifyExecutionProposal(proposal, 1_030_001);
    assert.equal(verification.valid, true);
    assert.equal(verification.expired, true);
  });

  it("cryptographically verifies a receipt bound to the proposal", () => {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const rawPublicKey = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
    const signer = new PublicKey(rawPublicKey).toBase58();
    const proposal = createExecutionProposal({
      evidence,
      requiredApprover: signer,
      nowMs: 1_001_000,
    });
    const signature = sign(
      null,
      Buffer.from(proposalApprovalMessage(proposal), "utf8"),
      privateKey,
    );
    const receipt: ApprovalReceipt = {
      schemaVersion: 1,
      kind: "KAIROS_PROPOSAL_APPROVAL",
      proposalId: proposal.proposalId,
      evidenceDigest: proposal.evidenceDigest,
      signer,
      signatureHex: signature.toString("hex"),
      signedAt: new Date(1_002_000).toISOString(),
      executionMode: "APPROVAL_ONLY",
      transactionSubmitted: false,
    };
    assert.equal(verifyApprovalReceipt({ proposal, receipt }).valid, true);
    assert.equal(
      verifyApprovalReceipt({ proposal, receipt: { ...receipt, signatureHex: "00".repeat(64) } }).valid,
      false,
    );
  });
});
