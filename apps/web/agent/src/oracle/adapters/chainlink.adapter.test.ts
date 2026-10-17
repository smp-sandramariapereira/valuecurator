import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CHAINLINK_DISABLED_REASON, fetchChainlinkEvidence } from "./chainlink.adapter.js";

describe("chainlink adapter", () => {
  it("fails closed and does not invent a price", async () => {
    await assert.rejects(
      () => fetchChainlinkEvidence({
        feedId: "922",
        asset: {
          symbol: "AAPLx",
          mint: "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp",
          network: "mainnet-beta",
        },
        observedAtMs: 1,
        license: "missing",
      }),
      new RegExp(CHAINLINK_DISABLED_REASON),
    );
  });
});
