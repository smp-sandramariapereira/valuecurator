import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseOracleEvidence } from "@valuecurator/oracle-contracts";
import { aggregateEvidence } from "./evidence-aggregator.js";

const asset = {
  symbol: "AAPLx",
  mint: "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp",
  network: "mainnet-beta" as const,
};

function evidence(providerId: "pyth-pro" | "pyth-hermes", publishTimeMs = 1_000) {
  return parseOracleEvidence({
    schemaVersion: 2,
    providerId,
    feedId: providerId === "pyth-pro" ? "922" : "ab".repeat(32),
    asset,
    price: "343440000",
    confidence: "62170",
    publishTimeMs,
    observedAtMs: publishTimeMs + 1,
    payloadDigest: "c".repeat(64),
    provenance: providerId,
    license: "authorized",
    simulated: false,
    disabled: false,
  });
}

describe("evidence aggregator", () => {
  it("stays disabled until an explicit equivalence check", () => {
    const result = aggregateEvidence({
      enabled: false,
      evidences: [evidence("pyth-pro"), evidence("pyth-hermes")],
      maximumSkewMs: 1_000,
    });
    assert.equal(result.status, "DISABLED");
  });

  it("refuses two observations that are not the same instrument in time", () => {
    const result = aggregateEvidence({
      enabled: true,
      evidences: [evidence("pyth-pro", 1_000), evidence("pyth-hermes", 90_000)],
      maximumSkewMs: 1_000,
    });
    assert.equal(result.status, "BLOCKED");
  });
});
