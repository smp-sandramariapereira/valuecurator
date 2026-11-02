import assert from "node:assert/strict";
import test from "node:test";
import { Keypair, PublicKey } from "@solana/web3.js";
import {
  AUTHORIZATION_VECTOR,
  authorizationDigest,
  canonicalAuthorization,
} from "../src/canonical.mjs";
import { createAuthorizationService } from "../src/service.mjs";
import * as serviceApi from "../src/service.mjs";

const TOKEN = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const NOW_MS = 1_700_000_000_000;

function key() { return Keypair.generate().publicKey; }

function fixture(overrides = {}) {
  const policySigner = overrides.policySigner ?? Keypair.generate();
  const owner = key();
  const mandate = key();
  const pool = key();
  const inputMint = key();
  const outputMint = key();
  const programId = key();
  const configKey = key();
  const deploymentId = Buffer.alloc(32, 7);
  const config = {
    programId,
    config: configKey,
    deploymentId,
    policySigner: policySigner.publicKey,
    policyVersion: 1n,
    authorizationEpoch: 1n,
    paused: false,
    profile: "DEVNET_LAB",
    ...(overrides.config ?? {}),
  };
  const registry = new Map([["lab:dAAPL", {
    assetId: "lab:dAAPL",
    network: "devnet-lab",
    mint: outputMint.toBase58(),
    tokenProgram: TOKEN,
    verificationStatus: "VERIFIED",
    synthetic: true,
  }]]);
  const mandateRecord = {
    owner: owner.toBase58(),
    mandate: mandate.toBase58(),
    pool: pool.toBase58(),
    inputMint: inputMint.toBase58(),
    outputMint: outputMint.toBase58(),
    maxPerTrade: 1_000n,
    maxDaily: 5_000n,
    spent: 0n,
    portfolioRemaining: 1_500n,
    rateNumerator: 1n,
    rateDenominator: 1n,
    paused: false,
    expiresAt: Math.floor(NOW_MS / 1000) + 10_000,
    ...(overrides.mandate ?? {}),
  };
  const service = createAuthorizationService({
    policySigner,
    loadConfig: overrides.loadConfig ?? (async () => config),
    labRegistry: registry,
    loadMandate: overrides.loadMandate ?? (async () => mandateRecord),
    now: () => NOW_MS,
  });
  const request = {
    profile: "DEVNET_LAB",
    assetId: "lab:dAAPL",
    owner: owner.toBase58(),
    mandate: mandate.toBase58(),
    pool: pool.toBase58(),
    inputMint: inputMint.toBase58(),
    outputMint: outputMint.toBase58(),
    tokenProgram: TOKEN,
    network: "devnet-lab",
    amountIn: "100",
    minimumAmountOut: "100",
    rateNumerator: "1",
    rateDenominator: "1",
    nonce: "1",
    evidence: {
      schema: "lab-fixed-rate-v1",
      profile: "DEVNET_LAB",
      assetId: "lab:dAAPL",
      inputMint: inputMint.toBase58(),
      outputMint: outputMint.toBase58(),
      rateNumerator: "1",
      rateDenominator: "1",
      observedAt: Math.floor(NOW_MS / 1000) - 10,
      expiresAt: Math.floor(NOW_MS / 1000) + 60,
    },
    ...(overrides.request ?? {}),
  };
  return { service, request, config, policySigner, outputMint, mandateRecord };
}

test("C27 canonical vector matches the Rust digest", () => {
  const digest = authorizationDigest(canonicalAuthorization(AUTHORIZATION_VECTOR)).toString("hex");
  assert.equal(digest, "79f797722d8826bb42c40785417d33c6d3e58867e3ca6caddded9d3b8d0b31f3");
});

test("C26 the signing function is not exported and blocked requests do not sign", async () => {
  assert.equal(serviceApi.signArbitraryDigest, undefined);
  const { service, request } = fixture({ request: { evidence: undefined, status: "REVIEWABLE", approved: true } });
  const result = await service.authorize(request);
  assert.equal(result.decision, "BLOCKED");
  assert.equal(result.proof, null);
  assert.equal(service.signerInvocations, 0);
});

test("authorization matrix", async () => {
  const cases = [
    ["C01", {}, "AUTHORIZED"],
    ["C02", { request: { assetId: "lab:unknown" } }, "BLOCKED"],
    ["C03", { request: { outputMint: Keypair.generate().publicKey.toBase58() } }, "BLOCKED"],
    ["C04", { request: { tokenProgram: TOKEN_2022 } }, "BLOCKED"],
    ["C05", { request: { network: "mainnet-beta", profile: "MAINNET_READ_ONLY" } }, "BLOCKED"],
    ["C06", { request: { deploymentId: Buffer.alloc(32, 9) } }, "BLOCKED"],
    ["C07", { request: { evidence: undefined } }, "BLOCKED"],
    ["C08", { request: { evidence: { schema: "lab-fixed-rate-v1", profile: "DEVNET_LAB", assetId: "lab:dAAPL", rateNumerator: "1", rateDenominator: "1", observedAt: 1, expiresAt: 2 } } }, "BLOCKED"],
    ["C10", { request: { policyVersion: 99n } }, "BLOCKED"],
    ["C11", { request: { authorizationEpoch: 99n } }, "BLOCKED"],
    ["C12", { config: { paused: true } }, "BLOCKED"],
    ["C13", { loadMandate: async () => null }, "BLOCKED"],
    ["C15", { request: { amountIn: "1001", minimumAmountOut: "1001" } }, "BLOCKED"],
    ["C17", { request: { amountIn: (1n << 64n).toString() } }, "BLOCKED"],
    ["C18", { request: { authorizationTtlSeconds: 10_000 } }, "BLOCKED"],
    ["C19", { request: { status: "REVIEWABLE", evidence: undefined } }, "BLOCKED"],
    ["C20", { request: { evidence: undefined, research: { schema_version: "research-relevance-v1", execution: { allowed: true } } } }, "BLOCKED"],
  ];
  for (const [id, overrides, expected] of cases) {
    const { service, request } = fixture(overrides);
    if (id === "C08") {
      request.evidence.assetId = request.assetId;
      request.evidence.inputMint = request.inputMint;
      request.evidence.outputMint = request.outputMint;
    }
    if (id === "C03") request.evidence.outputMint = request.outputMint;
    const result = await service.authorize(request);
    assert.equal(result.decision, expected, `${id} ${result.reasons?.join("; ")}`);
    if (expected === "BLOCKED") assert.equal(service.signerInvocations, 0, id);
    if (expected === "AUTHORIZED") {
      assert.equal(service.signerInvocations, 1, id);
      assert.equal(result.digest.length, 32);
      assert.ok(result.proof);
    }
  }
});

test("C09 tampered evidence does not sign", async () => {
  const { service, request } = fixture();
  request.evidence.digest = "ab".repeat(32);
  const result = await service.authorize(request);
  assert.equal(result.decision, "BLOCKED");
  assert.equal(service.signerInvocations, 0);
});

test("C14 another owner's mandate does not sign", async () => {
  const { service, request, mandateRecord } = fixture();
  mandateRecord.owner = Keypair.generate().publicKey.toBase58();
  const result = await service.authorize(request);
  assert.equal(result.decision, "BLOCKED");
  assert.equal(service.signerInvocations, 0);
});

test("C16 a reused nonce does not sign again", async () => {
  const { service, request } = fixture();
  const first = await service.authorize(request);
  const second = await service.authorize(request);
  assert.equal(first.decision, "AUTHORIZED");
  assert.equal(second.decision, "BLOCKED");
  assert.equal(service.signerInvocations, 1);
});

test("C21 changing a field after approval changes the digest and does not sign again", async () => {
  const { service, request } = fixture();
  const issued = await service.authorize(request);
  const altered = canonicalAuthorization({
    programId: new PublicKey(issued.message.subarray(42, 74)),
    deploymentId: issued.message.subarray(74, 106),
    config: new PublicKey(issued.message.subarray(106, 138)),
    policySigner: new PublicKey(issued.message.subarray(138, 170)),
    policyVersion: issued.message.readBigUInt64LE(170),
    authorizationEpoch: issued.message.readBigUInt64LE(178),
    owner: new PublicKey(issued.message.subarray(186, 218)),
    mandate: new PublicKey(issued.message.subarray(218, 250)),
    pool: new PublicKey(issued.message.subarray(250, 282)),
    inputMint: new PublicKey(issued.message.subarray(282, 314)),
    outputMint: new PublicKey(issued.message.subarray(314, 346)),
    tokenProgram: new PublicKey(issued.message.subarray(346, 378)),
    amountIn: issued.message.readBigUInt64LE(378) + 1n,
    minimumOut: issued.message.readBigUInt64LE(386),
    rateNumerator: issued.message.readBigUInt64LE(394),
    rateDenominator: issued.message.readBigUInt64LE(402),
    evidenceDigest: issued.message.subarray(410, 442),
    proposalDigest: issued.message.subarray(442, 474),
    executionDigest: issued.message.subarray(474, 506),
    nonce: issued.message.readBigUInt64LE(506),
    issuedAt: issued.message.readBigInt64LE(514),
    expiresAt: issued.message.readBigInt64LE(522),
  });
  assert.notEqual(authorizationDigest(altered).toString("hex"), issued.digest.toString("hex"));
  assert.equal(service.signerInvocations, 1);
});

test("C22 concurrent reuse of one nonce signs once", async () => {
  const { service, request } = fixture();
  const [left, right] = await Promise.all([service.authorize(request), service.authorize({ ...request })]);
  const decisions = [left.decision, right.decision].sort();
  assert.deepEqual(decisions, ["AUTHORIZED", "BLOCKED"]);
  assert.equal(service.signerInvocations, 1);
});

test("C23 a rotated signer is not used to refresh an old authorization", async () => {
  const { service, request, config } = fixture();
  const first = await service.authorize(request);
  config.policySigner = Keypair.generate().publicKey;
  config.authorizationEpoch = 2n;
  const second = await service.authorize({ ...request, nonce: "2" });
  assert.equal(first.decision, "AUTHORIZED");
  assert.equal(second.decision, "BLOCKED");
  assert.equal(service.signerInvocations, 1);
});

test("C24 a policy bump changes the signed payload", async () => {
  const { service, request, config } = fixture();
  const first = await service.authorize(request);
  config.policyVersion = 2n;
  config.authorizationEpoch = 2n;
  const second = await service.authorize({ ...request, nonce: "2" });
  assert.equal(second.decision, "AUTHORIZED");
  assert.notEqual(first.digest.toString("hex"), second.digest.toString("hex"));
  assert.equal(first.message.readBigUInt64LE(170), 1n);
  assert.equal(second.message.readBigUInt64LE(170), 2n);
});

test("C28 a signature for one operation is a different digest from another", async () => {
  const { service, request } = fixture();
  const first = await service.authorize(request);
  const second = await service.authorize({ ...request, nonce: "2", amountIn: "101", minimumAmountOut: "101" });
  assert.equal(first.decision, "AUTHORIZED");
  assert.equal(second.decision, "AUTHORIZED");
  assert.notEqual(first.digest.toString("hex"), second.digest.toString("hex"));
});

test("configuration that changes before signing is not signed", async () => {
  let calls = 0;
  const base = fixture();
  const service = createAuthorizationService({
    policySigner: base.policySigner,
    loadConfig: async () => {
      calls += 1;
      return calls === 1 ? base.config : { ...base.config, paused: true };
    },
    labRegistry: new Map([["lab:dAAPL", {
      assetId: "lab:dAAPL", network: "devnet-lab", mint: base.request.outputMint,
      tokenProgram: TOKEN, verificationStatus: "VERIFIED", synthetic: true,
    }]]),
    loadMandate: async () => base.mandateRecord,
    now: () => NOW_MS,
  });
  const result = await service.authorize(base.request);
  assert.equal(result.decision, "BLOCKED");
  assert.equal(service.signerInvocations, 0);
});

test("the research catalog mint is not a lab settlement record", async () => {
  const { service, request } = fixture({ request: { assetId: "equity:US:AAPL", outputMint: "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp" } });
  request.evidence.assetId = "equity:US:AAPL";
  request.evidence.outputMint = request.outputMint;
  const result = await service.authorize(request);
  assert.equal(result.decision, "BLOCKED");
  assert.equal(service.signerInvocations, 0);
});
