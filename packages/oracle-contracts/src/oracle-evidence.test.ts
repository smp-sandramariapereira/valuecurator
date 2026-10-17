import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ZodError } from "zod";
import { evidenceRoundtrip, parseOracleEvidence, type OracleEvidenceV2 } from "./oracle-evidence.js";

const evidence = {
  schemaVersion: 2,
  providerId: "pyth-pro",
  feedId: "922",
  asset: {
    symbol: "AAPLx",
    mint: "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp",
    network: "mainnet-beta",
  },
  price: "343440000",
  confidence: "62170",
  publishTimeMs: 1_000_000,
  observedAtMs: 1_001_000,
  payloadDigest: "a".repeat(64),
  provenance: "pyth-pro parsed price",
  license: "authorized",
  simulated: false,
  disabled: false,
} satisfies OracleEvidenceV2;

describe("oracle evidence v2", () => {
  it("roundtrips canonical JSON", () => {
    const parsed = evidenceRoundtrip(evidence);
    assert.deepEqual(parsed, evidence);
    assert.equal(JSON.parse(JSON.stringify(parsed)).price, "343440000");
  });

  it("rejects a non-positive price, a future timestamp, a mismatched id, and absent confidence", () => {
    assert.throws(() => parseOracleEvidence({ ...evidence, price: "0" }), ZodError);
    assert.throws(() => parseOracleEvidence({ ...evidence, publishTimeMs: 2_000_000 }), ZodError);
    assert.throws(() => parseOracleEvidence({ ...evidence, providerId: "pyth" }), ZodError);
    assert.throws(() => parseOracleEvidence({ ...evidence, confidence: null }), ZodError);
  });
});
