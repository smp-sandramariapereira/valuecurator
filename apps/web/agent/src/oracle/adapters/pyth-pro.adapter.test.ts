import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { fetchPythProEvidence } from "./pyth-pro.adapter.js";

const originalFetch = globalThis.fetch;
const asset = {
  symbol: "AAPLx",
  mint: "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp",
  network: "mainnet-beta" as const,
};

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("pyth pro adapter", () => {
  it("fails closed before any request when the credential is missing", async () => {
    let called = false;
    globalThis.fetch = (() => {
      called = true;
      return Promise.reject(new Error("network"));
    }) as typeof fetch;
    await assert.rejects(
      () => fetchPythProEvidence({
        feedId: "922",
        asset,
        apiKey: " ",
        observedAtMs: 2_000,
        license: "authorized",
      }),
      /credential is required/,
    );
    assert.equal(called, false);
  });

  it("normalizes a fixture without leaving the test process", async () => {
    globalThis.fetch = (async () => Response.json({
      parsed: {
        timestampUs: "2000000",
        priceFeeds: [{
          priceFeedId: 922,
          price: "343440000",
          confidence: "62170",
          exponent: -6,
          feedUpdateTimestamp: "2000000",
        }],
      },
    })) as typeof fetch;
    const evidence = await fetchPythProEvidence({
      feedId: "922",
      asset,
      apiKey: "server-secret",
      apiUrl: "https://oracle.test",
      observedAtMs: 3_000,
      license: "authorized",
    });
    assert.equal(evidence.providerId, "pyth-pro");
    assert.equal(evidence.price, "343440000");
    assert.equal(evidence.confidence, "62170");
    assert.equal(evidence.simulated, false);
    assert.equal(evidence.payloadDigest.length, 64);
  });
});
