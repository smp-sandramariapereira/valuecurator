export const MAX_CONVERSION_RATE_LIFETIME_SECONDS = 300;

function gcd(left, right) {
  let a = left;
  let b = right;
  while (b !== 0n) {
    const next = a % b;
    a = b;
    b = next;
  }
  return a;
}

/**
 * Turns a positive input/output quote into the integers execute_swap multiplies.
 * output = input * rateNumerator / rateDenominator. The expiry is exactly 300 seconds.
 * This function does not fetch a quote and does not submit a transaction.
 */
export function conversionRateFromQuote({ inputAmount, outputAmount, nowSeconds }) {
  const input = BigInt(inputAmount);
  const output = BigInt(outputAmount);
  const now = BigInt(nowSeconds);
  if (input <= 0n || output <= 0n) throw new Error("quote amounts must be positive");
  if (now < 0n) throw new Error("quote time is invalid");
  const divisor = gcd(input, output);
  return {
    rateNumerator: output / divisor,
    rateDenominator: input / divisor,
    expiresAt: now + BigInt(MAX_CONVERSION_RATE_LIFETIME_SECONDS),
    maxLifetimeSeconds: MAX_CONVERSION_RATE_LIFETIME_SECONDS,
  };
}
