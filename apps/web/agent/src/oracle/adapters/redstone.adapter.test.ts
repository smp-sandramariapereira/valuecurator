import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { REDSTONE_DISABLED_REASON, fetchRedstoneEvidence } from "./redstone.adapter.js";

describe("redstone adapter", () => {
  it("fails closed and does not invent a price", async () => {
    await assert.rejects(
      () => fetchRedstoneEvidence({
        feedId: "922",
        asset: {
          symbol: "AAPLx",
          mint: "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp",
          network: "mainnet-beta",
        },
        observedAtMs: 1,
        license: "missing",
      }),
      new RegExp(REDSTONE_DISABLED_REASON),
    );
  });
});
