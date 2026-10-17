import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { recordUsage, resetUsageMeter } from "./usage-meter.js";

describe("usage meter", () => {
  beforeEach(() => resetUsageMeter());

  it("counts a request id once", () => {
    assert.equal(recordUsage("same").counted, true);
    assert.equal(recordUsage("same").counted, false);
    assert.equal(recordUsage("same").total, 1);
  });
});
