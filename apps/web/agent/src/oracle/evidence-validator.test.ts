import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseOracleEvidence, type OracleEvidenceV2 } from "@valuecurator/oracle-contracts";
import { mandateOraclePolicy } from "./oracle-policy.js";
import { validateEvidence } from "./evidence-validator.js";

const asset = {
  symbol: "AAPLx",
  mint: "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp",
  network: "mainnet-beta" as const,
};

function evidence(patch: Partial<OracleEvidenceV2> = {}): OracleEvidenceV2 {
  return parseOracleEvidence({
    schemaVersion: 2,
    providerId: "pyth-hermes",
    feedId: "ab".repeat(32),
    asset,
    price: "343440000",
    confidence: "62170",
    publishTimeMs: 1_000,
    observedAtMs: 2_000,
    payloadDigest: "b".repeat(64),
    provenance: "fixture",
    license: "authorized",
    simulated: false,
    disabled: false,
    ...patch,
  });
}

const policy = mandateOraclePolicy({
  allowedProviders: ["pyth-hermes", "pyth-pro"],
  fallbackOptIn: false,
  maximumPriceAgeMs: 30_000,
});

describe("evidence admissibility", () => {
  it("admits a licensed live observation", () => {
    const decision = validateEvidence({
      evidence: evidence(),
      expectedAsset: asset,
      expectedProviderId: "pyth-hermes",
      policy,
    });
    assert.equal(decision.admissibility, "ADMISSIBLE");
  });

  it("blocks simulated, stale, unlicensed, and wrong-asset evidence", () => {
    const simulated = validateEvidence({
      evidence: evidence({ simulated: true }),
      expectedAsset: asset,
      expectedProviderId: "pyth-hermes",
      policy,
    });
    assert.equal(simulated.admissibility, "INADMISSIBLE");

    const stale = validateEvidence({
      evidence: evidence({ publishTimeMs: 1 }),
      expectedAsset: asset,
      expectedProviderId: "pyth-hermes",
      policy: mandateOraclePolicy({
        allowedProviders: ["pyth-hermes"],
        fallbackOptIn: false,
        maximumPriceAgeMs: 10,
      }),
    });
    assert.match(stale.reasons.join(" "), /stale/);

    const unlicensed = validateEvidence({
      evidence: evidence({ license: "missing" }),
      expectedAsset: asset,
      expectedProviderId: "pyth-hermes",
      policy,
    });
    assert.match(unlicensed.reasons.join(" "), /license/);

    const wrong = validateEvidence({
      evidence: evidence(),
      expectedAsset: { ...asset, symbol: "TSLAx" },
      expectedProviderId: "pyth-hermes",
      policy,
    });
    assert.match(wrong.reasons.join(" "), /asset/);
  });

  it("does not treat absent confidence as zero", () => {
    const absent = {
      ...evidence(),
      confidence: null,
    } as OracleEvidenceV2;
    const decision = validateEvidence({
      evidence: absent,
      expectedAsset: asset,
      expectedProviderId: "pyth-hermes",
      policy,
    });
    assert.match(decision.reasons.join(" "), /confidence is absent/);
    assert.equal(decision.reasons.some((reason) => reason.includes("0")), false);
  });
});
