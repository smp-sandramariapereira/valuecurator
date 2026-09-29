import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { InvestmentMandate, MarketObservation } from "./mandate.js";
import { createRebalanceProposal, evaluateMarketObservation, evaluateProposal } from "./policy.js";

const now = 2_000_000;
const mandate: InvestmentMandate = {
  id: "balanced-stock-demo",
  version: 1,
  validUntilMs: now + 60_000,
  maxTradeValueMicros: 300_000_000n,
  minTradeValueMicros: 1_000_000n,
  maxPriceAgeMs: 30_000,
  maxConfidenceBps: 100,
  assets: [
    {
      mint: "USDC",
      referenceFeedId: "Crypto.USDC/USD",
      targetAllocationBps: 5000,
      maxAllocationBps: 6000,
      maxPriceDeviationBps: 100,
    },
    {
      mint: "AAPLX",
      referenceFeedId: "Equity.US.AAPL/USD",
      targetAllocationBps: 5000,
      maxAllocationBps: 6000,
      maxPriceDeviationBps: 200,
    },
  ],
};

function observations(overrides: Partial<MarketObservation> = {}): MarketObservation[] {
  return [
    {
      mint: "USDC", referenceFeedId: "Crypto.USDC/USD", referencePriceMicros: 1_000_000n,
      onchainPriceMicros: 1_000_000n, confidenceMicros: 1_000n, publishTimeMs: now - 1_000,
    },
    {
      mint: "AAPLX", referenceFeedId: "Equity.US.AAPL/USD", referencePriceMicros: 230_000_000n,
      onchainPriceMicros: 231_000_000n, confidenceMicros: 500_000n, publishTimeMs: now - 1_000,
      ...overrides,
    },
  ];
}

describe("investment mandate policy", () => {
  it("builds a deterministic, mint-ordered rebalance proposal", () => {
    const positions = [
      { mint: "USDC", valueMicros: 800_000_000n },
      { mint: "AAPLX", valueMicros: 200_000_000n },
    ];
    const first = createRebalanceProposal(mandate, positions, now);
    const second = createRebalanceProposal(mandate, [...positions].reverse(), now);
    assert.deepEqual(first, second);
    assert.deepEqual(first.trades, [
      {
        mint: "AAPLX", side: "buy", valueMicros: 300_000_000n,
        currentAllocationBps: 2000, targetAllocationBps: 5000,
      },
      {
        mint: "USDC", side: "sell", valueMicros: 300_000_000n,
        currentAllocationBps: 8000, targetAllocationBps: 5000,
      },
    ]);
  });

  it("allows a valid proposal with fresh, bounded market data", () => {
    const proposal = createRebalanceProposal(mandate, [
      { mint: "USDC", valueMicros: 800_000_000n },
      { mint: "AAPLX", valueMicros: 200_000_000n },
    ], now);
    assert.deepEqual(evaluateProposal(mandate, proposal, observations(), now), {
      allowed: true, reasons: [],
    });
  });

  it("rejects stale observations and excessive price deviation", () => {
    const proposal = createRebalanceProposal(mandate, [
      { mint: "USDC", valueMicros: 800_000_000n },
      { mint: "AAPLX", valueMicros: 200_000_000n },
    ], now);
    const decision = evaluateProposal(mandate, proposal, observations({
      publishTimeMs: now - 30_001,
      onchainPriceMicros: 240_000_000n,
    }), now);
    assert.equal(decision.allowed, false);
    assert.match(decision.reasons.join(" "), /stale market observation/);
    assert.match(decision.reasons.join(" "), /price deviation too high/);
  });

  it("rejects a proposal that exceeds the trade cap", () => {
    const proposal = createRebalanceProposal(mandate, [
      { mint: "USDC", valueMicros: 900_000_000n },
      { mint: "AAPLX", valueMicros: 100_000_000n },
    ], now);
    const decision = evaluateProposal(mandate, proposal, observations(), now);
    assert.equal(decision.allowed, false);
    assert.equal(decision.reasons.filter((reason) => reason.includes("maximum value")).length, 2);
  });

  it("rejects invalid target totals and unauthorized holdings", () => {
    assert.throws(() => createRebalanceProposal({
      ...mandate,
      assets: mandate.assets.map((asset) => ({ ...asset, targetAllocationBps: 4000 })),
    }, [{ mint: "USDC", valueMicros: 1n }], now), /sum to 10000/);
    assert.throws(() => createRebalanceProposal(mandate, [
      { mint: "USDC", valueMicros: 900n },
      { mint: "UNKNOWN", valueMicros: 100n },
    ], now), /unauthorized asset/);
  });
});

describe("execution market observation policy", () => {
  const asset = mandate.assets[1]!;
  it("accepts fresh matching evidence within confidence and deviation limits", () => {
    assert.deepEqual(evaluateMarketObservation({
      asset, observation: observations()[1]!, maxPriceAgeMs: 30_000,
      maxConfidenceBps: 100, nowMs: now,
    }), { allowed: true, reasons: [] });
  });

  it("fails closed on stale, wrong-feed, and divergent evidence", () => {
    const decision = evaluateMarketObservation({
      asset,
      observation: {
        ...observations()[1]!,
        referenceFeedId: "wrong",
        publishTimeMs: now - 30_001,
        onchainPriceMicros: 240_000_000n,
      },
      maxPriceAgeMs: 30_000,
      maxConfidenceBps: 100,
      nowMs: now,
    });
    assert.equal(decision.allowed, false);
    assert.match(decision.reasons.join(" "), /feed mismatch/);
    assert.match(decision.reasons.join(" "), /stale/);
    assert.match(decision.reasons.join(" "), /deviation/);
  });
});
