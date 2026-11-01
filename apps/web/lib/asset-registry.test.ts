import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assetCatalog, eligibleForDevnetSettlement, parseAsset, parseCatalog, selectResearchAssets } from "./asset-registry.js";

describe("research-only Asset Registry", () => {
  it("loads the versioned seed with unique IDs", () => {
    assert.equal(assetCatalog.length, 4);
    assert.equal(new Set(assetCatalog.map((asset) => asset.assetId)).size, 4);
  });
  it("allows multiasset research selection but not arbitrary identifiers", () => {
    assert.deepEqual(selectResearchAssets(assetCatalog, ["equity:US:NVDA", "equity:US:AAPL"]).map((asset) => asset.ticker), ["NVDA", "AAPL"]);
    assert.throws(() => selectResearchAssets(assetCatalog, ["equity:US:OTHER"]), /Unknown asset/);
    assert.throws(() => selectResearchAssets(assetCatalog, ["equity:US:AAPL", "equity:US:AAPL"]), /Duplicate asset selection/);
  });
  it("does not mark documented mainnet references executable on devnet", () => {
    assert.equal(assetCatalog[0].status, "REFERENCE_DOCUMENTED");
    for (const asset of assetCatalog) assert.equal(eligibleForDevnetSettlement(asset, new Set()), false);
  });
  it("rejects a forged candidate with a mint", () => {
    assert.throws(() => parseAsset({ ...assetCatalog[1], mint: assetCatalog[0].mint, network: "mainnet-beta" }), /Candidate cannot declare a mint/);
  });
  it("requires unique identities and a known schema", () => {
    assert.throws(() => parseCatalog({schemaVersion: 2, assets: []}), /Unknown asset catalog schema/);
    assert.throws(() => parseCatalog({schemaVersion: 1, assets: [assetCatalog[0], assetCatalog[0]]}), /Duplicate asset ID/);
  });
  it("rejects an invalid public key instead of trusting ticker input", () => {
    assert.throws(() => parseAsset({ ...assetCatalog[0], mint: "not-a-solana-address" }));
  });
});
