import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { Keypair } from "@solana/web3.js";
import { buildGuardedMarketObservation } from "./market-data.js";

const originalFetch = globalThis.fetch;
const mint = Keypair.generate().publicKey;
const feedId = "a".repeat(64);

afterEach(() => { globalThis.fetch = originalFetch; });

function installMocks(options: { halted?: boolean; atomic?: boolean; deployment?: string } = {}): void {
  globalThis.fetch = (async (input) => {
    const url = new URL(String(input));
    if (url.pathname.includes("/public/assets/")) {
      return Response.json({
        id: "asset-aapl", symbol: "AAPLx", name: "Apple xStock",
        underlying: { symbol: "AAPL" },
        isTradingHalted: options.halted ?? false,
        deployments: [{
          network: "Solana",
          address: options.deployment ?? mint.toBase58(),
          supportsAtomicSwaps: options.atomic ?? true,
        }],
      });
    }
    return Response.json({
      parsed: [{ id: feedId, price: {
        price: "23000000000", conf: "50000000", expo: -8, publish_time: 2_000,
      } }],
    });
  }) as typeof fetch;
}

function build() {
  return buildGuardedMarketObservation({
    symbol: "AAPLx",
    expectedMint: mint,
    pythFeedId: feedId,
    usdInputAmount: 230_000_000n,
    assetOutputAmount: 1_000_000_000n,
    usdDecimals: 6,
    assetDecimals: 9,
    xstocksApiUrl: "https://api.xstocks.fi/api/v2",
    pythApiUrl: "https://pyth.dourolabs.app/hermes",
    pythApiKey: "secret",
  });
}

describe("guarded xStock market observation", () => {
  it("joins verified xStocks deployment, Pyth reference, and Jupiter executable price", async () => {
    installMocks();
    assert.deepEqual(await build(), {
      mint: mint.toBase58(),
      referenceFeedId: feedId,
      referencePriceMicros: 230_000_000n,
      onchainPriceMicros: 230_000_000n,
      confidenceMicros: 500_000n,
      publishTimeMs: 2_000_000,
    });
  });

  it("rejects a deployment that differs from the mandate mint", async () => {
    installMocks({ deployment: Keypair.generate().publicKey.toBase58() });
    await assert.rejects(build(), /does not match the investment mandate/);
  });

  it("rejects halted or non-atomic assets", async () => {
    installMocks({ halted: true });
    await assert.rejects(build(), /trading is halted/);
    installMocks({ atomic: false });
    await assert.rejects(build(), /does not support atomic swaps/);
  });
});
