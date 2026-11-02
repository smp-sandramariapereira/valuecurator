import assert from "node:assert/strict";
import test from "node:test";
import { conversionRateFromQuote, MAX_CONVERSION_RATE_LIFETIME_SECONDS } from "../src/conversion-rate.mjs";

test("a Jupiter-style quote becomes the pool ratio and expires in 300 seconds", () => {
  const rate = conversionRateFromQuote({
    inputAmount: 270_000_000n,
    outputAmount: 1_000_000n,
    nowSeconds: 1_700_000_000,
  });
  assert.equal(rate.rateNumerator, 1n);
  assert.equal(rate.rateDenominator, 270n);
  assert.equal(rate.expiresAt, 1_700_000_000n + BigInt(MAX_CONVERSION_RATE_LIFETIME_SECONDS));
  const input = 270_000_000n;
  assert.equal(input * rate.rateNumerator / rate.rateDenominator, 1_000_000n);
});

test("a non-positive quote is rejected", () => {
  assert.throws(() => conversionRateFromQuote({ inputAmount: 0n, outputAmount: 1n, nowSeconds: 1 }));
  assert.throws(() => conversionRateFromQuote({ inputAmount: 1n, outputAmount: 0n, nowSeconds: 1 }));
});
