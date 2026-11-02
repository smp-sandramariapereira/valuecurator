import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { trackedContentViolations, trackedPathViolation } from "./check-no-tracked-secrets.mjs";

test("real env files and key material stay forbidden", () => {
  assert.match(trackedPathViolation(".env") ?? "", /forbidden secret-bearing path/);
  assert.match(trackedPathViolation(".env.local") ?? "", /forbidden secret-bearing path/);
  assert.match(trackedPathViolation("apps/web/.env") ?? "", /forbidden secret-bearing path/);
  assert.match(trackedPathViolation(".env.production.example") ?? "", /forbidden secret-bearing path/);
  assert.match(trackedPathViolation("target/deploy/proofgate_settlement_lab.so") ?? "", /forbidden secret-bearing path/);
  assert.match(trackedPathViolation("keys/proofgate-policy-signer-keypair.json") ?? "", /forbidden secret-bearing path/);
  assert.match(trackedPathViolation("certs/server.pem") ?? "", /forbidden secret-bearing path/);
});

test("only named lab and agent examples are exempt from the path rule", () => {
  assert.equal(trackedPathViolation(".env.example"), null);
  assert.equal(trackedPathViolation("agent/.env.example"), null);
  assert.equal(trackedPathViolation(".env.lab.example"), null);
  assert.equal(trackedPathViolation("apps/web/.env.lab.example"), null);
  assert.equal(trackedPathViolation("README.md"), null);
});

test("an approved example still fails when it contains a secret", () => {
  const pem = "-----BEGIN PRIVATE KEY-----\nABC\n-----END PRIVATE KEY-----\n";
  assert.match(trackedContentViolations(".env.lab.example", pem)[0] ?? "", /private-key PEM marker/);
  const keypair = JSON.stringify(Array.from({ length: 64 }, () => 1));
  assert.match(trackedContentViolations("wallet.json", keypair)[0] ?? "", /probable Solana secret keypair/);
});

test("the tracked lab example contains no key material", () => {
  const source = readFileSync(new URL("../.env.lab.example", import.meta.url), "utf8");
  assert.deepEqual(trackedContentViolations(".env.lab.example", source), []);
  assert.equal(trackedPathViolation(".env.lab.example"), null);
});
