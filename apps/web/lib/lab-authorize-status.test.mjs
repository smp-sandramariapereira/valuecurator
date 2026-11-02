import assert from "node:assert/strict";
import test from "node:test";
import { assertSameOrigin } from "@valuecurator/proofgate-authorization-service/environment";
import { labAuthorizeHttpStatus } from "./lab-authorize-status.mjs";

test("malformed authorize body is HTTP 400", () => {
  assert.equal(labAuthorizeHttpStatus({ ok: false, status: 400, error: "request body must be an object" }), 400);
});

test("a foreign origin is rejected before authorization", () => {
  assert.equal(assertSameOrigin("https://evil.example", "127.0.0.1:43147"), false);
  assert.equal(assertSameOrigin("http://127.0.0.1:43147", "127.0.0.1:43147"), true);
});

test("rate limit and oversized body keep their transport statuses", () => {
  assert.equal(labAuthorizeHttpStatus({ ok: false, status: 429, error: "rate limit" }), 429);
  assert.equal(labAuthorizeHttpStatus({ ok: false, status: 413, error: "request is too large" }), 413);
});

test("an unavailable signer is HTTP 503", () => {
  assert.equal(labAuthorizeHttpStatus({ ok: false, decision: "ERROR", reasons: ["RPC unavailable"], proof: null }), 503);
});

test("a policy block stays HTTP 200", () => {
  assert.equal(labAuthorizeHttpStatus({ ok: false, decision: "BLOCKED", reasons: ["proposal fields are invalid"], proof: null }), 200);
});

test("a valid authorization stays HTTP 200", () => {
  assert.equal(labAuthorizeHttpStatus({ ok: true, decision: "AUTHORIZED", proof: "synthetic" }), 200);
});
