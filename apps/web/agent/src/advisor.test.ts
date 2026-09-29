import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  applyDecisionPolicy,
  requestStrategyDecision,
  type StrategyFeatures,
} from "./advisor.js";

const originalFetch = globalThis.fetch;
const features: StrategyFeatures = {
  inputMint: "input",
  outputMint: "output",
  amountIn: "1000",
  expectedAmountOut: "990",
  minimumAmountOut: "980",
  priceImpactPct: 0.1,
  routeHops: 1,
  slippageBps: 100,
};

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function mock(body: unknown, status = 200): void {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;
}

describe("AI strategy advisor", () => {
  it("accepts a schema-valid bounded decision", async () => {
    mock({ decision: "execute", confidence: 0.91, reason: "liquidity is adequate", modelVersion: "v1" });
    const decision = await requestStrategyDecision({
      endpoint: "https://model.example/decision",
      apiKey: undefined,
      timeoutMs: 1000,
      features,
    });
    assert.equal(decision.decision, "execute");
    assert.equal(applyDecisionPolicy("enforce", 0.8, decision), true);
  });

  it("blocks low-confidence execution in enforce mode", () => {
    assert.equal(applyDecisionPolicy("enforce", 0.8, {
      decision: "execute",
      confidence: 0.79,
      reason: "uncertain",
      modelVersion: "v1",
    }), false);
  });

  it("never blocks execution in shadow mode", () => {
    assert.equal(applyDecisionPolicy("shadow", 0.99, {
      decision: "defer",
      confidence: 1,
      reason: "shadow observation",
      modelVersion: "v1",
    }), true);
  });

  it("rejects malformed model output", async () => {
    mock({ decision: "buy_everything", confidence: 2, reason: "", modelVersion: "" });
    await assert.rejects(
      requestStrategyDecision({
        endpoint: "https://model.example/decision",
        apiKey: undefined,
        timeoutMs: 1000,
        features,
      }),
      /decision must be execute or defer/,
    );
  });

  it("rejects insecure remote endpoints", async () => {
    await assert.rejects(
      requestStrategyDecision({
        endpoint: "http://model.example/decision",
        apiKey: undefined,
        timeoutMs: 1000,
        features,
      }),
      /must use HTTPS/,
    );
  });

  it("fails explicitly on advisor HTTP errors", async () => {
    mock({ error: "unavailable" }, 503);
    await assert.rejects(
      requestStrategyDecision({
        endpoint: "https://model.example/decision",
        apiKey: undefined,
        timeoutMs: 1000,
        features,
      }),
      /AI advisor failed \(503\)/,
    );
  });
});
