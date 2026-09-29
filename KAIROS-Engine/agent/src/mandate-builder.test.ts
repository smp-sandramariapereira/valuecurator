import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  VERIFIED_ASSET,
  buildAdverseEvidence,
  buildCanonicalMandate,
  canonicalMandateJson,
  evaluateMandateEvidence,
  validateMandateDraft,
  type MandateDraft,
} from "../../lib/mandate-builder.js";

const draft: MandateDraft = {
  maximumTradeUsdc: 100,
  maximumDailyUsdc: 500,
  maximumAllocationPercent: 30,
  maximumPriceAgeSeconds: 30,
  maximumConfidenceBps: 100,
  maximumDeviationBps: 200,
  maximumSlippageBps: 100,
  advisorMode: "shadow",
  validFrom: "2099-01-01T00:00:00.000Z",
  validUntil: "2099-01-08T00:00:00.000Z",
};

describe("visual mandate builder", () => {
  it("converts human units into a deterministic canonical mandate", () => {
    const first = buildCanonicalMandate(draft, "owner-key");
    const second = buildCanonicalMandate({ ...draft }, "owner-key");
    assert.equal(first.limits.maximumTradeUsdMicros, "100000000");
    assert.equal(first.limits.maximumDailyUsdMicros, "500000000");
    assert.equal(first.limits.maximumAllocationBps, 3000);
    assert.equal(first.limits.maximumPriceAgeMs, 30000);
    assert.equal(canonicalMandateJson(first), canonicalMandateJson(second));
  });

  it("rejects invalid caps and an expiry before the start", () => {
    const errors = validateMandateDraft({
      ...draft,
      maximumDailyUsdc: 50,
      maximumAllocationPercent: 101,
      validUntil: "2098-01-01T00:00:00.000Z",
    }, Date.parse("2090-01-01T00:00:00.000Z"));
    assert.ok(errors.some((error) => error.includes("Daily limit")));
    assert.ok(errors.some((error) => error.includes("allocation")));
    assert.ok(errors.some((error) => error.includes("after its start")));
  });

  it("approves bounded evidence and blocks the explicit adverse scenario", () => {
    const mandate = buildCanonicalMandate(draft, "owner-key");
    const approved = evaluateMandateEvidence({
      mint: VERIFIED_ASSET.mint,
      referenceFeedId: VERIFIED_ASSET.pythFeedId,
      quoteInputAmount: "100000000",
      quoteExpectedOutputAmount: "300000",
      quoteMinimumOutputAmount: "297000",
      priceAgeMs: 1000,
      confidenceBps: 10,
      deviationBps: 25,
      priceImpactBps: 5,
    }, mandate);
    assert.equal(approved.decision, "APPROVED");
    const blocked = evaluateMandateEvidence(buildAdverseEvidence(mandate), mandate);
    assert.equal(blocked.decision, "BLOCKED");
    assert.ok(blocked.reasons.some((reason) => reason.includes("Price age")));
  });
});
