import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ZodError } from "zod";
import { parseAssetIdentity, sameAsset } from "./asset-identity.js";

describe("asset identity", () => {
  it("accepts one mainnet asset and rejects a different network", () => {
    const asset = parseAssetIdentity({
      symbol: "AAPLx",
      mint: "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp",
      network: "mainnet-beta",
    });
    assert.equal(sameAsset(asset, { ...asset }), true);
    assert.throws(() => parseAssetIdentity({ ...asset, network: "devnet" }), ZodError);
  });
});
