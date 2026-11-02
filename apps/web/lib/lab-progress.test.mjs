import assert from "node:assert/strict";
import test from "node:test";
import { labProgress } from "./lab-progress.mjs";

test("a disconnected visitor is asked to connect", () => {
  const progress = labProgress({ connected: false, setupKnown: true, portfolioExists: false, mandateExists: false, decision: "PENDING" });
  assert.equal(progress.current, "connect");
  assert.equal(progress.steps[0].state, "current");
  assert.equal(progress.steps[1].state, "waiting");
});

test("a connected wallet without a portfolio is asked for a message and a transaction", () => {
  const progress = labProgress({ connected: true, setupKnown: true, portfolioExists: false, mandateExists: false, decision: "PENDING" });
  assert.equal(progress.current, "portfolio");
  assert.match(progress.steps[1].wallet, /message, then a transaction/);
});

test("a portfolio without a mandate advances one step", () => {
  const progress = labProgress({ connected: true, setupKnown: true, portfolioExists: true, mandateExists: false, decision: "PENDING" });
  assert.equal(progress.current, "mandate");
  assert.equal(progress.steps[1].state, "done");
});

test("an authorized decision asks for the swap transaction", () => {
  const progress = labProgress({ connected: true, setupKnown: true, portfolioExists: true, mandateExists: true, decision: "AUTHORIZED" });
  assert.equal(progress.current, "settle");
  assert.match(progress.steps[4].wallet, /Ed25519/);
});

test("a blocked decision stays on the message step", () => {
  const progress = labProgress({ connected: true, setupKnown: true, portfolioExists: true, mandateExists: true, decision: "BLOCKED" });
  assert.equal(progress.current, "decision");
});

test("an executed swap completes the guide", () => {
  const progress = labProgress({ connected: true, setupKnown: true, portfolioExists: true, mandateExists: true, decision: "EXECUTED" });
  assert.equal(progress.current, "done");
  assert.equal(progress.steps.every((step) => step.state === "done"), true);
});
