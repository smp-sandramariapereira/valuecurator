import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SWITCHBOARD_DISABLED_REASON, fetchSwitchboardEvidence } from "./switchboard.adapter.js";

describe("switchboard adapter", () => {
  it("fails closed and does not invent a price", async () => {
    await assert.rejects(
      () => fetchSwitchboardEvidence({
        feedId: "922",
        asset: {
          symbol: "AAPLx",
          mint: "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp",
          network: "mainnet-beta",
        },
        observedAtMs: 1,
        license: "missing",
      }),
      new RegExp(SWITCHBOARD_DISABLED_REASON),
    );
  });
});
