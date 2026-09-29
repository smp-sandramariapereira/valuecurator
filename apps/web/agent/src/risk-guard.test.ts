import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { ExecutionGuard } from "./risk-guard.js";

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "kairos-risk-"));
  const limits = {
    statePath: join(directory, "state.json"),
    maxSwapAmount: 100n,
    maxDailyInput: 150n,
    maxConsecutiveFailures: 2,
    cooldownMs: 1_000,
  };
  return { directory, limits };
}

test("enforces per-swap and persisted daily limits", () => {
  const { directory, limits } = fixture();
  try {
    const guard = new ExecutionGuard(limits, 0);
    assert.throws(() => guard.assertCanAttempt(101n, 0), /MAX_SWAP_AMOUNT/);
    guard.recordSuccess(100n, 0);
    const restarted = new ExecutionGuard(limits, 0);
    assert.throws(() => restarted.assertCanAttempt(51n, 0), /MAX_DAILY_INPUT/);
    restarted.assertCanAttempt(50n, 0);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("opens circuit after consecutive failures and closes after cooldown", () => {
  const { directory, limits } = fixture();
  try {
    const guard = new ExecutionGuard(limits, 0);
    guard.recordFailure(100);
    guard.recordFailure(200);
    assert.throws(() => guard.assertCanAttempt(1n, 1_199), /Circuit breaker/);
    guard.assertCanAttempt(1n, 1_200);
    guard.recordSuccess(1n, 1_200);
    assert.equal(guard.snapshot().consecutiveFailures, 0);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
