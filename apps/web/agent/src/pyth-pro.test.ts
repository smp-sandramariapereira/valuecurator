import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { fetchPythProPrice } from "./pyth-pro.js";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

function mock(body: unknown, status = 200, inspect?: (input: RequestInfo | URL, init?: RequestInit) => void): void {
  globalThis.fetch = (async (input, init) => {
    inspect?.(input, init);
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}

describe("Pyth Pro REST market data", () => {
  it("authenticates, requests the numeric feed, and normalizes the latest price", async () => {
    mock({
      parsed: {
        timestampUs: "1790089880090000",
        priceFeeds: [{
          priceFeedId: 922,
          price: "34344000",
          confidence: "6217",
          exponent: -5,
          feedUpdateTimestamp: "1790089880000000",
          publisherCount: 8,
          marketSession: "regular",
        }],
      },
      solana: { encoding: "hex", data: "00" },
    }, 200, (input, init) => {
      assert.equal(new URL(String(input)).pathname, "/v1/latest_price");
      assert.equal(init?.method, "POST");
      assert.equal(new Headers(init?.headers).get("authorization"), "Bearer secret");
      const request = JSON.parse(String(init?.body)) as Record<string, unknown>;
      assert.deepEqual(request.priceFeedIds, [922]);
      assert.equal(request.channel, "fixed_rate@1000ms");
    });
    assert.deepEqual(await fetchPythProPrice({ feedId: "922", apiKey: "secret" }), {
      feedId: "922",
      priceMicros: 343_440_000n,
      confidenceMicros: 62_170n,
      publishTimeMs: 1_790_089_880_000,
    });
  });

  it("requires a key and rejects malformed or unexpected feeds", async () => {
    await assert.rejects(fetchPythProPrice({ feedId: "922", apiKey: "" }), /API key is required/);
    await assert.rejects(fetchPythProPrice({ feedId: "Equity.US.AAPL\/USD", apiKey: "secret" }), /must be numeric/);
    mock({ parsed: { timestampUs: "1000000", priceFeeds: [{
      priceFeedId: 923, price: "1", confidence: "0", exponent: 0,
      feedUpdateTimestamp: "1000000",
    }] } });
    await assert.rejects(fetchPythProPrice({ feedId: "922", apiKey: "secret" }), /unexpected feed/);
  });

  it("fails closed on insecure endpoints and unavailable responses", async () => {
    await assert.rejects(fetchPythProPrice({
      feedId: "922", apiKey: "secret", apiUrl: "http://example.com",
    }), /must use HTTPS/);
    mock({ error: "unavailable" }, 503);
    await assert.rejects(fetchPythProPrice({ feedId: "922", apiKey: "secret" }), /request failed \(503\)/);
  });
});
