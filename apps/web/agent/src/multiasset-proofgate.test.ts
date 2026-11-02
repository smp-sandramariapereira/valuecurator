import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  contentDigest, evaluateMultiAssetProposal, parseResearchSummary,
  type MultiAssetMandate, type PriceEvidence, type ProposedTrade, type RegistryRecord,
  type RiskSnapshot,
} from "./multiasset-proofgate.js";

const nowMs = 1_800_000_000_000;
const assetId = "equity:US:AAPL";
const inputMint = "11111111111111111111111111111111";
const outputMint = "So11111111111111111111111111111111111111112";
const mandate: MultiAssetMandate = {
  schemaVersion: 1, mandateId: "mandate-alpha", owner: "owner-fixture", network: "devnet",
  evidenceMode: "DEVNET_LAB", oracleRequired: false,
  inputMint, allowedAssets: [{ assetId, mint: outputMint, maxPerTrade: "200", maxDailyInput: "300" }],
  maxPortfolioTrade: "250", maxPortfolioDailyInput: "500",
  maxSlippageBps: 100, maxEvidenceAgeMs: 60_000, expiresAtMs: nowMs + 100_000,
};
const proposal: ProposedTrade = { assetId, inputMint, outputMint, amountIn: "100", minAmountOut: "99" };
const evidence: PriceEvidence = {
  source: "SYNTHETIC_TEST", network: "devnet", assetId,
  inputMint, outputMint, amountIn: "100", expectedAmountOut: "100",
  observedAtMs: nowMs - 1000, expiresAtMs: nowMs + 30_000,
};
const registry: readonly RegistryRecord[] = [{ assetId, status: "VERIFIED", devnetMint: outputMint }];
const risk: RiskSnapshot = { dailyInputByAsset: { [assetId]: "0" }, dailyInputTotal: "0" };
const research = {
  schema_version: "research-relevance-v1", mode: "RESEARCH_ONLY",
  dataset: { id: "fixture/news", revision: "fixed-sha", snapshot_sha256: "a".repeat(64) },
  experiment: { model_sha256: "b".repeat(64) },
  per_asset: [{ asset_id: assetId, proposed_action: "NONE", authorized: false }],
  execution: { allowed: false },
};
function evaluate(options: {
  mandate?: MultiAssetMandate; proposal?: ProposedTrade; evidence?: PriceEvidence;
  registry?: readonly RegistryRecord[]; risk?: RiskSnapshot; nowMs?: number; research?: unknown;
} = {}) {
  return evaluateMultiAssetProposal({
    mandate: options.mandate ?? mandate, proposal: options.proposal ?? proposal,
    evidence: options.evidence ?? evidence, registry: options.registry ?? registry,
    risk: options.risk ?? risk, nowMs: options.nowMs ?? nowMs,
    ...(options.research !== undefined ? { research: options.research } : {}),
  });
}

describe("ProofGate Multi-Asset Stage 3: review without execution", () => {
  it("allows human review for a bounded synthetic Devnet quote, but never allows execution", () => {
    const decision = evaluate({ research });
    assert.equal(decision.status, "REVIEWABLE");
    assert.equal(decision.executionEnabled, false);
    assert.equal(decision.mode, "OFF_CHAIN_REVIEW_ONLY");
    assert.equal(decision.researchDigest, contentDigest(research));
    assert.equal(decision.reasons.length, 0);
  });
  it("does not allow an unverified candidate or an unknown asset", () => {
    const record = registry[0];
    if (!record) throw new Error("fixture registry is empty");
    assert.match(evaluate({ registry: [{ ...record, status: "CANDIDATE" }] }).reasons.join(), /verified Devnet/);
    assert.match(evaluate({ proposal: { ...proposal, assetId: "equity:US:TSLA" } }).reasons.join(), /not in owner mandate/);
  });
  it("blocks quote mismatches, stale quotes and excessive slippage", () => {
    assert.match(evaluate({ evidence: { ...evidence, outputMint: inputMint } }).reasons.join(), /does not match/);
    assert.match(evaluate({ evidence: { ...evidence, observedAtMs: nowMs - 90_000 } }).reasons.join(), /stale/);
    assert.match(evaluate({ proposal: { ...proposal, minAmountOut: "80" } }).reasons.join(), /slippage/);
  });
  it("blocks individual and aggregate exposure violations", () => {
    assert.match(evaluate({ risk: { dailyInputByAsset: { [assetId]: "250" }, dailyInputTotal: "0" } }).reasons.join(), /daily exposure/);
    assert.match(evaluate({ risk: { dailyInputByAsset: { [assetId]: "0" }, dailyInputTotal: "450" } }).reasons.join(), /daily exposure/);
    assert.match(evaluate({ proposal: { ...proposal, amountIn: "251" } }).reasons.join(), /risk limits/);
  });
  it("never treats unauthenticated oracle text as a verified attestation", () => {
    assert.match(evaluate({ evidence: { ...evidence, source: "AUTHENTICATED_ORACLE" } }).reasons.join(), /verifier is not implemented/);
    const protectedMode: MultiAssetMandate = { ...mandate, evidenceMode: "PRICE_PROTECTED", oracleRequired: true };
    assert.match(evaluate({ mandate: protectedMode }).reasons.join(), /requires authenticated oracle/);
    assert.match(evaluate({ mandate: { ...mandate, oracleRequired: true } }).reasons.join(), /mandatory/);
  });
  it("blocks expired mandates and tampered research authorization", () => {
    assert.match(evaluate({ mandate: { ...mandate, expiresAtMs: nowMs - 1 } }).reasons.join(), /mandate expired/);
    assert.match(evaluate({ research: { ...research, execution: { allowed: true } } }).reasons.join(), /research report mode/);
    assert.match(evaluate({ research: { ...research, per_asset: [{ asset_id: assetId, proposed_action: "BUY", authorized: true }] } }).reasons.join(), /cannot authorize/);
  });
  it("uses canonical digests for order-independent records", () => {
    assert.equal(contentDigest({ a: 1, b: 2 }), contentDigest({ b: 2, a: 1 }));
  });
  it("rejects invalid integer amounts and a missing research mapping", () => {
    assert.match(evaluate({ proposal: { ...proposal, amountIn: "1.2" } }).reasons.join(), /invalid integer/);
    assert.match(parseResearchSummary({ ...research, per_asset: [] }, assetId).reasons.join(), /cannot authorize/);
  });
});
