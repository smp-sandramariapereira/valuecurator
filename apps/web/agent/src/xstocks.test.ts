import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { Keypair } from "@solana/web3.js";
import { fetchXStockAsset, fetchXStockMultiplier } from "./xstocks.js";

const originalFetch = globalThis.fetch;
const mint = Keypair.generate().publicKey;

afterEach(() => { globalThis.fetch = originalFetch; });

function mock(body: unknown, status = 200): void {
  globalThis.fetch = (async () => new Response(JSON.stringify(body), {
    status, headers: { "content-type": "application/json" },
  })) as typeof fetch;
}

describe("xStocks asset discovery", () => {
  it("resolves the official Solana deployment without hard-coding a mint", async () => {
    mock({
      id: "asset-aapl", symbol: "AAPLx", name: "Apple xStock",
      underlying: { symbol: "AAPL" }, isTradingHalted: false,
      deployments: [
        { network: "Ethereum", address: "0xabc", supportsAtomicSwaps: false },
        { network: "Solana", address: mint.toBase58(), supportsAtomicSwaps: true },
      ],
    });
    const asset = await fetchXStockAsset({ apiUrl: "https://api.xstocks.fi/api/v2", symbol: "AAPLx" });
    assert.equal(asset.solanaMint.toBase58(), mint.toBase58());
    assert.equal(asset.underlyingSymbol, "AAPL");
    assert.equal(asset.supportsAtomicSwaps, true);
  });

  it("rejects an asset without a Solana deployment", async () => {
    mock({
      id: "asset-aapl", symbol: "AAPLx", name: "Apple xStock",
      underlying: { symbol: "AAPL" }, deployments: [{ network: "Ethereum", address: "0xabc" }],
    });
    await assert.rejects(fetchXStockAsset({ symbol: "AAPLx" }), /no Solana deployment/);
  });

  it("rejects malformed symbols before requesting the API", async () => {
    await assert.rejects(fetchXStockAsset({ symbol: "../AAPLx" }), /invalid xStocks symbol/);
  });

  it("propagates public API failures with bounded context", async () => {
    mock({ error: "temporarily unavailable" }, 503);
    await assert.rejects(fetchXStockAsset({ symbol: "AAPLx" }), /request failed \(503\)/);
  });
});

describe("xStocks Scaled UI multiplier", () => {
  it("normalizes current and scheduled multipliers to fixed-point nano units", async () => {
    mock({
      currentMultiplier: "1.25",
      newMultiplier: 1.5,
      activationDateTime: "2026-09-22T12:00:00.000Z",
      reason: "split",
    });
    const value = await fetchXStockMultiplier({ symbol: "AAPLx" });
    assert.equal(value.currentMultiplierNano, 1_250_000_000n);
    assert.equal(value.newMultiplierNano, 1_500_000_000n);
    assert.equal(value.activationTimeMs, Date.parse("2026-09-22T12:00:00.000Z"));
    assert.equal(value.reason, "split");
  });

  it("rounds high-precision API multipliers to nano units", async () => {
    mock({
      currentMultiplier: 1.005714560286254,
      newMultiplier: 0,
      activationDateTime: 0,
      reason: null,
    });
    const value = await fetchXStockMultiplier({ symbol: "AAPLx" });
    assert.equal(value.currentMultiplierNano, 1_005_714_560n);
    assert.equal(value.newMultiplierNano, null);
    assert.equal(value.activationTimeMs, null);
  });

  it("requests the Solana multiplier and rejects invalid values", async () => {
    let requested = "";
    globalThis.fetch = (async (input) => {
      requested = String(input);
      return new Response(JSON.stringify({ currentMultiplier: "0" }), { status: 200 });
    }) as typeof fetch;
    await assert.rejects(fetchXStockMultiplier({ symbol: "AAPLx" }), /invalid current multiplier/);
    assert.match(requested, /multiplier\?network=Solana/);
  });

  it("accepts Unix activation timestamps in seconds and milliseconds", async () => {
    mock({ currentMultiplier: "1", activationDateTime: 1_790_089_880 });
    const seconds = await fetchXStockMultiplier({ symbol: "AAPLx" });
    assert.equal(seconds.activationTimeMs, 1_790_089_880_000);

    mock({ currentMultiplier: "1", activationDateTime: "1790089880000" });
    const milliseconds = await fetchXStockMultiplier({ symbol: "AAPLx" });
    assert.equal(milliseconds.activationTimeMs, 1_790_089_880_000);
  });
});
