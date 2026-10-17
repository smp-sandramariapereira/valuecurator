import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { fetchPythHermesEvidence } from "./pyth-hermes.adapter.js";

const originalFetch = globalThis.fetch;
const feedId = "ab".repeat(32);
const asset = {
  symbol: "AAPLx",
  mint: "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp",
  network: "mainnet-beta" as const,
};

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("pyth hermes adapter", () => {
  it("normalizes a fixture and does not treat the feed shape as the provider", async () => {
    globalThis.fetch = (async () => Response.json({
      parsed: [{
        id: feedId,
        price: { price: "343440000", conf: "62170", expo: -6, publish_time: 2 },
      }],
    })) as typeof fetch;
    const evidence = await fetchPythHermesEvidence({
      feedId,
      asset,
      apiUrl: "https://hermes.test",
      observedAtMs: 3_000,
      license: "authorized",
    });
    assert.equal(evidence.providerId, "pyth-hermes");
    assert.equal(evidence.feedId, feedId);
    assert.notEqual(evidence.providerId, "pyth-pro");
  });
});
