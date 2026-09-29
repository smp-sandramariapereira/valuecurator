import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { fetchPythPrice, toMarketObservation } from "./pyth.js";

const originalFetch = globalThis.fetch;
const feedId = "a".repeat(64);

afterEach(() => { globalThis.fetch = originalFetch; });

function mock(body: unknown, status = 200, inspect?: (input: RequestInfo | URL, init?: RequestInit) => void): void {
  globalThis.fetch = (async (input, init) => {
    inspect?.(input, init);
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}

describe("Pyth Hermes market data", () => {
  it("authenticates, validates the feed, and normalizes values to USD micros", async () => {
    mock({ parsed: [{ id: feedId, price: { price: "23012345678", conf: "1200000", expo: -8, publish_time: 2_000 } }] }, 200,
      (input, init) => {
        const url = new URL(String(input));
        assert.equal(url.pathname, "/hermes/v2/updates/price/latest");
        assert.equal(url.searchParams.get("ids[]"), feedId);
        assert.equal(new Headers(init?.headers).get("authorization"), "Bearer secret");
      });
    const price = await fetchPythPrice({ feedId: `0x${feedId}`, apiKey: "secret" });
    assert.deepEqual(price, {
      feedId,
      priceMicros: 230_123_457n,
      confidenceMicros: 12_000n,
      publishTimeMs: 2_000_000,
    });
  });

  it("preserves base paths and accepts root endpoints", async () => {
    const endpoints: Array<[string, string]> = [
      ["https://example.com/hermes", "/hermes/v2/updates/price/latest"],
      ["https://example.com/hermes/", "/hermes/v2/updates/price/latest"],
      ["https://example.com", "/v2/updates/price/latest"],
    ];
    for (const [base, expected] of endpoints) {
      mock({ parsed: [{ id: feedId, price: { price: "100", conf: "0", expo: 0, publish_time: 1 } }] }, 200,
        input => assert.equal(new URL(String(input)).pathname, expected));
      await fetchPythPrice({ feedId, apiUrl: base });
    }
  });

  it("creates the exact market observation consumed by mandate policy", () => {
    assert.deepEqual(toMarketObservation({
      mint: "AAPLx",
      onchainPriceMicros: 231_000_000n,
      pyth: { feedId, priceMicros: 230_000_000n, confidenceMicros: 500_000n, publishTimeMs: 2_000_000 },
    }), {
      mint: "AAPLx", referenceFeedId: feedId, referencePriceMicros: 230_000_000n,
      onchainPriceMicros: 231_000_000n, confidenceMicros: 500_000n, publishTimeMs: 2_000_000,
    });
  });

  it("rejects insecure endpoints and malformed feed identifiers", async () => {
    await assert.rejects(fetchPythPrice({ feedId, apiUrl: "http://example.com" }), /must use HTTPS/);
    await assert.rejects(fetchPythPrice({ feedId: "Equity.US.AAPL\/USD" }), /32 bytes of hex/);
  });

  it("rejects wrong feeds and unavailable Hermes responses", async () => {
    mock({ parsed: [{ id: "b".repeat(64), price: { price: "1", conf: "0", expo: 0, publish_time: 1 } }] });
    await assert.rejects(fetchPythPrice({ feedId }), /unexpected feed/);
    mock({ error: "unavailable" }, 503);
    await assert.rejects(fetchPythPrice({ feedId }), /request failed \(503\)/);
  });
});
