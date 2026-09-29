import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { Keypair, PublicKey } from "@solana/web3.js";
import {
  JUPITER_V6_PROGRAM_ID,
  buildJupiterSwap,
  fetchJupiterExecutableQuote,
  quoteScaledUsdPriceMicros,
  quoteUsdPriceMicros,
} from "./jupiter.js";

const inputMint = new PublicKey("So11111111111111111111111111111111111111112");
const outputMint = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const user = Keypair.generate().publicKey;
const originalFetch = globalThis.fetch;

afterEach(() => { globalThis.fetch = originalFetch; });

function quote(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    inputMint: inputMint.toBase58(), outputMint: outputMint.toBase58(),
    inAmount: "1000", outAmount: "990", otherAmountThreshold: "980",
    swapMode: "ExactIn", routePlan: [{}], priceImpactPct: "0.12", ...overrides,
  };
}

function instruction(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    programId: JUPITER_V6_PROGRAM_ID.toBase58(),
    accounts: [
      { pubkey: user.toBase58(), isSigner: false, isWritable: false },
      { pubkey: inputMint.toBase58(), isSigner: false, isWritable: true },
    ],
    data: Buffer.from([1, 2, 3]).toString("base64"), ...overrides,
  };
}

function mockResponses(...bodies: Array<Record<string, unknown>>): void {
  let index = 0;
  globalThis.fetch = (async () => {
    const body = bodies[index++];
    if (!body) throw new Error("unexpected fetch");
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}

function build(): ReturnType<typeof buildJupiterSwap> {
  return buildJupiterSwap({
    apiUrl: "https://api.jup.ag", apiKey: undefined, inputMint, outputMint,
    userPublicKey: user, amount: 1000n, slippageBps: 100, maxAccounts: 32,
  });
}

describe("Jupiter strategy builder", () => {
  it("builds only the pinned exact-input route and marks only the PDA signer", async () => {
    mockResponses(quote(), { swapInstruction: instruction(), setupInstructions: [] });
    const result = await build();
    assert.deepEqual([...result.instructionData], [1, 2, 3]);
    assert.equal(result.minimumAmountOut, 980n);
    assert.equal(result.expectedAmountOut, 990n);
    assert.equal(result.priceImpactPct, 0.12);
    assert.equal(result.routeHops, 1);
    assert.equal(result.remainingAccounts[0]?.isSigner, true);
    assert.equal(result.remainingAccounts[1]?.isSigner, false);
  });

  it("rejects a quote for different mints", async () => {
    mockResponses(quote({ outputMint: inputMint.toBase58() }));
    await assert.rejects(build(), /quote mints do not match/);
  });

  it("rejects a quote that changes the exact input", async () => {
    mockResponses(quote({ inAmount: "999" }));
    await assert.rejects(build(), /not exact-input/);
  });

  it("rejects zero minimum output", async () => {
    mockResponses(quote({ otherAmountThreshold: "0" }));
    await assert.rejects(build(), /invalid output amounts/);
  });

  it("rejects an unexpected swap program", async () => {
    mockResponses(quote(), { swapInstruction: instruction({ programId: PublicKey.default.toBase58() }), setupInstructions: [] });
    await assert.rejects(build(), /unexpected router program/);
  });

  it("rejects routes requiring setup instructions", async () => {
    mockResponses(quote(), { swapInstruction: instruction(), setupInstructions: [instruction()] });
    await assert.rejects(build(), /unsupported setup or token-ledger/);
  });

  it("propagates Jupiter HTTP failures with response context", async () => {
    globalThis.fetch = (async () => new Response(JSON.stringify({ error: "rate limited" }), {
      status: 429, headers: { "content-type": "application/json" },
    })) as typeof fetch;
    await assert.rejects(build(), /Jupiter quote failed \(429\).*rate limited/);
  });
});

describe("Jupiter read-only quote", () => {
  it("returns a validated quote without requesting swap instructions", async () => {
    let requests = 0;
    globalThis.fetch = (async (input, init) => {
      requests += 1;
      const url = new URL(String(input));
      assert.equal(url.searchParams.get("amount"), "1000");
      assert.equal(new Headers(init?.headers).get("x-api-key"), "jupiter-key");
      return new Response(JSON.stringify(quote()), { status: 200 });
    }) as typeof fetch;
    const result = await fetchJupiterExecutableQuote({
      apiUrl: "https://api.jup.ag", apiKey: "jupiter-key", inputMint, outputMint,
      amount: 1000n, slippageBps: 100, maxAccounts: 32,
    });
    assert.equal(requests, 1);
    assert.equal(result.expectedAmountOut, 990n);
    assert.equal(result.minimumAmountOut, 980n);
    assert.equal(result.routeHops, 1);
  });
});

describe("Jupiter executable price", () => {
  it("normalizes a USDC-to-xStock quote to USD micros", () => {
    assert.equal(quoteUsdPriceMicros({
      usdInputAmount: 230_000_000n, assetOutputAmount: 1_000_000_000n,
      usdDecimals: 6, assetDecimals: 9,
    }), 230_000_000n);
  });

  it("applies the Token-2022 Scaled UI multiplier", () => {
    assert.equal(quoteScaledUsdPriceMicros({
      usdInputAmount: 230_000_000n, assetOutputAmount: 1_000_000_000n,
      usdDecimals: 6, assetDecimals: 9, multiplierNano: 1_250_000_000n,
    }), 184_000_000n);
  });

  it("rejects zero amounts, multipliers, and invalid decimals", () => {
    assert.throws(() => quoteUsdPriceMicros({
      usdInputAmount: 0n, assetOutputAmount: 1n, usdDecimals: 6, assetDecimals: 9,
    }), /must be positive/);
    assert.throws(() => quoteScaledUsdPriceMicros({
      usdInputAmount: 1n, assetOutputAmount: 1n, usdDecimals: 6, assetDecimals: 9, multiplierNano: 0n,
    }), /multiplier must be positive/);
    assert.throws(() => quoteUsdPriceMicros({
      usdInputAmount: 1n, assetOutputAmount: 1n, usdDecimals: 6, assetDecimals: 19,
    }), /token decimals/);
  });
});
