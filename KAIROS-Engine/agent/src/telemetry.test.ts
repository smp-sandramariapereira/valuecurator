import assert from "node:assert/strict";
import { readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync } from "node:fs";
import test from "node:test";
import { evaluateJsonLines } from "./evaluate-shadow.js";
import { appendTelemetry } from "./telemetry.js";

test("appends correlated JSONL events and evaluates them", () => {
  const directory = mkdtempSync(join(tmpdir(), "kairos-telemetry-"));
  const path = join(directory, "nested", "events.jsonl");
  try {
    appendTelemetry(path, {
      type: "ai_decision", correlationId: "c1", timestamp: new Date(0).toISOString(),
      mode: "shadow", modelVersion: "m1", decision: "execute", confidence: 0.9,
      reason: "ok", amountIn: "10", expectedAmountOut: "20", priceImpactPct: 0.1, routeHops: 1,
    });
    appendTelemetry(path, {
      type: "execution", correlationId: "c1", timestamp: new Date(1).toISOString(),
      status: "succeeded", amountIn: "10", minimumAmountOut: "19", signature: "sig", slot: 7,
    });
    const contents = readFileSync(path, "utf8");
    assert.equal(contents.trim().split("\n").length, 2);
    assert.deepEqual(evaluateJsonLines(contents), {
      decisions: 1, execute: 1, defer: 0, averageConfidence: 0.9,
      executionsSucceeded: 1, executionsFailed: 0, executionsDeferred: 0,
      modelVersions: { m1: 1 },
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
