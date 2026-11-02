import assert from "node:assert/strict";
import test from "node:test";
import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import nacl from "tweetnacl";
import { ED25519_PROGRAM_ID, LOCKED_AUTHORIZATION_DIGEST, SETTLEMENT_PROGRAM_ID, authorizationDigest, canonicalAuthorization, AUTHORIZATION_VECTOR } from "../src/canonical.mjs";
import { assertLabEnvironment, assertSameOrigin } from "../src/environment.mjs";
import { createLabGateway } from "../src/gateway.mjs";
import { createSessionStore } from "../src/session.mjs";
import { buildSettlementTransaction } from "../src/settlement-tx.mjs";
import { createAuthorizationService } from "../src/service.mjs";

const TOKEN = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const NOW = 1_700_000_000_000;
const PROGRAM = SETTLEMENT_PROGRAM_ID.toBase58();

function env(overrides = {}) {
  return {
    LAB_MODE: "surfpool-local",
    LAB_RPC_URL: "http://127.0.0.1:18999",
    LAB_EXECUTION_ENABLED: "true",
    LAB_PROGRAM_ID: PROGRAM,
    ...overrides,
  };
}

test("C27 and environment guards", () => {
  assert.equal(authorizationDigest(canonicalAuthorization(AUTHORIZATION_VECTOR)).toString("hex"), LOCKED_AUTHORIZATION_DIGEST);
  assert.equal(assertLabEnvironment(env()).ok, true);
  assert.equal(assertLabEnvironment(env({ LAB_RPC_URL: "https://api.mainnet-beta.solana.com" })).ok, false);
  assert.equal(assertLabEnvironment(env({ LAB_EXECUTION_ENABLED: "true", LAB_MODE: "devnet" })).ok, false);
  assert.equal(assertSameOrigin("http://127.0.0.1:43147", "127.0.0.1:43147"), true);
  assert.equal(assertSameOrigin("https://evil.example", "127.0.0.1:43147"), false);
});

test("wallet challenge expires and cannot be replayed", () => {
  let clock = NOW;
  const session = createSessionStore({ now: () => clock });
  const owner = Keypair.generate();
  const issued = session.issue({ owner: owner.publicKey.toBase58(), host: "127.0.0.1:43147" });
  const signature = Buffer.from(nacl.sign.detached(Buffer.from(issued.message), owner.secretKey)).toString("base64");
  const ok = session.consume({ owner: owner.publicKey.toBase58(), host: "127.0.0.1:43147", nonce: issued.nonce, signature });
  const replay = session.consume({ owner: owner.publicKey.toBase58(), host: "127.0.0.1:43147", nonce: issued.nonce, signature });
  const other = Keypair.generate();
  const foreign = session.issue({ owner: other.publicKey.toBase58(), host: "127.0.0.1:43147" });
  const stolen = session.consume({
    owner: owner.publicKey.toBase58(),
    host: "127.0.0.1:43147",
    nonce: foreign.nonce,
    signature: Buffer.from(nacl.sign.detached(Buffer.from(foreign.message), other.secretKey)).toString("base64"),
  });
  clock += 121_000;
  const expiredIssue = session.issue({ owner: owner.publicKey.toBase58(), host: "127.0.0.1:43147" });
  const expiredSignature = Buffer.from(nacl.sign.detached(Buffer.from(expiredIssue.message), owner.secretKey)).toString("base64");
  clock += 121_000;
  const expired = session.consume({
    owner: owner.publicKey.toBase58(),
    host: "127.0.0.1:43147",
    nonce: expiredIssue.nonce,
    signature: expiredSignature,
  });
  assert.equal(ok.ok, true);
  assert.equal(replay.ok, false);
  assert.equal(stolen.ok, false);
  assert.equal(expired.ok, false);
});

test("settlement transaction keeps Ed25519 first and under 1232 bytes", async () => {
  const policySigner = Keypair.generate();
  const owner = Keypair.generate();
  const mandate = Keypair.generate().publicKey;
  const pool = Keypair.generate().publicKey;
  const inputMint = Keypair.generate().publicKey;
  const outputMint = Keypair.generate().publicKey;
  const programId = SETTLEMENT_PROGRAM_ID;
  const configKey = Keypair.generate().publicKey;
  const service = createAuthorizationService({
    policySigner,
    now: () => NOW,
    labRegistry: new Map([["lab:dAAPL", {
      assetId: "lab:dAAPL", network: "devnet-lab", mint: outputMint.toBase58(),
      tokenProgram: TOKEN, verificationStatus: "VERIFIED", synthetic: true,
    }]]),
    loadConfig: async () => ({
      programId, config: configKey, deploymentId: Buffer.alloc(32, 7),
      policySigner: policySigner.publicKey, policyVersion: 1n, authorizationEpoch: 1n,
      paused: false, profile: "DEVNET_LAB",
    }),
    loadMandate: async () => ({
      owner: owner.publicKey.toBase58(), mandate: mandate.toBase58(), pool: pool.toBase58(),
      inputMint: inputMint.toBase58(), outputMint: outputMint.toBase58(),
      maxPerTrade: 1000n, maxDaily: 5000n, spent: 0n, portfolioRemaining: 5000n,
      rateNumerator: 1n, rateDenominator: 1n, paused: false, expiresAt: 1_700_010_000,
    }),
  });
  const authorized = await service.authorize({
    profile: "DEVNET_LAB",
    assetId: "lab:dAAPL",
    owner: owner.publicKey.toBase58(),
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
    nonce: "7",
    evidence: {
      schema: "lab-fixed-rate-v1",
      profile: "DEVNET_LAB",
      assetId: "lab:dAAPL",
      inputMint: inputMint.toBase58(),
      outputMint: outputMint.toBase58(),
      rateNumerator: "1",
      rateDenominator: "1",
      observedAt: 1_700_000_000 - 10,
      expiresAt: 1_700_000_000 + 60,
    },
  });
  const portfolio = Keypair.generate().publicKey;
  const built = buildSettlementTransaction({
    authorization: authorized,
    proof: authorized.proof,
    owner: owner.publicKey,
    pool, mandate, portfolio, inputMint, outputMint, config: configKey,
    blockhash: "11111111111111111111111111111111",
    lastValidBlockHeight: 1,
  });
  assert.equal(built.transaction.instructions[0].programId.toBase58(), ED25519_PROGRAM_ID.toBase58());
  assert.equal(built.transaction.instructions[1].programId.toBase58(), PROGRAM);
  assert.ok(built.size < 1232);
  assert.equal(built.transaction.instructions[0].data.length < 200, true);
  const decoded = Transaction.from(Buffer.from(built.transaction.serialize({ requireAllSignatures: false, verifySignatures: false })));
  assert.equal(decoded.instructions.length, 2);
});

function runtimeFor(policySigner, owner, pool, inputMint, outputMint, config) {
  return {
    deploymentId: Buffer.alloc(32, 7).toString("hex"),
    config: config.toBase58(),
    policySigner: policySigner.publicKey.toBase58(),
    pool: pool.toBase58(),
    inputMint: inputMint.toBase58(),
    outputMint: outputMint.toBase58(),
    admin: Keypair.generate().publicKey.toBase58(),
    asset: {
      assetId: "lab:dAAPL",
      displayName: "Synthetic dAAPL",
      mint: outputMint.toBase58(),
      network: "devnet-lab",
      tokenProgram: TOKEN,
      verificationStatus: "VERIFIED",
      synthetic: true,
    },
    limits: { maxPerTrade: "2000", maxDaily: "5000", portfolioDaily: "10000" },
  };
}

function accountBuffer(size, fill) {
  const data = Buffer.alloc(size);
  if (fill) fill(data);
  return { executable: false, data };
}

test("gateway blocks unauthenticated, wrong cluster, unknown asset and a dead RPC", async () => {
  const policySigner = Keypair.generate();
  const owner = Keypair.generate();
  const pool = Keypair.generate().publicKey;
  const inputMint = Keypair.generate().publicKey;
  const outputMint = Keypair.generate().publicKey;
  const config = Keypair.generate().publicKey;
  const runtime = runtimeFor(policySigner, owner, pool, inputMint, outputMint, config);
  const failing = createLabGateway({
    env: env(),
    policySigner,
    runtime,
    now: () => NOW,
    connection: { getAccountInfo: async () => { throw new Error("RPC unavailable"); }, getLatestBlockhash: async () => { throw new Error("RPC unavailable"); } },
    researchAssets: [{ assetId: "equity:US:AAPL", ticker: "AAPL", displayName: "Apple" }],
  });
  const assets = await failing.getAssets();
  assert.equal(assets.confirmed, false);
  assert.equal(assets.decision ?? assets.status, "ERROR");

  const quiet = createLabGateway({
    env: env(),
    policySigner,
    runtime: { ...runtime, asset: { ...runtime.asset, mint: outputMint.toBase58() } },
    now: () => NOW,
    connection: {
      getAccountInfo: async (key) => key.toBase58() === PROGRAM ? { executable: true, data: Buffer.alloc(1) } : null,
      getLatestBlockhash: async () => ({ blockhash: "11111111111111111111111111111111", lastValidBlockHeight: 9 }),
    },
    researchAssets: [{ assetId: "equity:US:AAPL", ticker: "AAPL", displayName: "Apple" }],
  });
  const listed = await quiet.getAssets();
  assert.equal(listed.assets[0].lane, "RESEARCH_ONLY");
  assert.equal(listed.assets[1].lane, "BLOCKED");
  const missing = await quiet.authorize({
    host: "127.0.0.1:43147",
    body: { owner: owner.publicKey.toBase58(), amountIn: "100", minimumAmountOut: "100", nonce: "1" },
  });
  assert.equal(missing.decision, "BLOCKED");
  assert.equal(quiet.signerInvocations, 0);
  const mainnet = await quiet.authorize({
    host: "127.0.0.1:43147",
    body: { owner: owner.publicKey.toBase58(), amountIn: "100", minimumAmountOut: "100", nonce: "1", walletCluster: "mainnet-beta", challenge: { nonce: "aa", signature: "aa" } },
  });
  assert.equal(mainnet.decision, "BLOCKED");
  assert.match(mainnet.reasons.join(" "), /mainnet|local lab/);
  const huge = await quiet.authorize({ host: "127.0.0.1:43147", body: {}, bytes: 90_000 });
  assert.equal(huge.status, 413);
});

test("gateway signs once for an authenticated lab proposal and refuses a changed asset", async () => {
  const policySigner = Keypair.generate();
  const owner = Keypair.generate();
  const pool = Keypair.generate().publicKey;
  const inputMint = Keypair.generate().publicKey;
  const outputMint = Keypair.generate().publicKey;
  const config = Keypair.generate().publicKey;
  const runtime = runtimeFor(policySigner, owner, pool, inputMint, outputMint, config);
  const portfolio = PublicKey.findProgramAddressSync(
    [Buffer.from("portfolio"), owner.publicKey.toBuffer(), inputMint.toBuffer()],
    SETTLEMENT_PROGRAM_ID,
  )[0];
  const mandate = PublicKey.findProgramAddressSync(
    [Buffer.from("mandate"), owner.publicKey.toBuffer(), pool.toBuffer()],
    SETTLEMENT_PROGRAM_ID,
  )[0];
  function configData() {
    const data = Buffer.alloc(122);
    policySigner.publicKey.toBuffer().copy(data, 40);
    data.writeBigUInt64LE(2n, 72);
    data.writeBigUInt64LE(3n, 80);
    Buffer.alloc(32, 7).copy(data, 88);
    return data;
  }
  function mandateData() {
    const data = Buffer.alloc(114);
    owner.publicKey.toBuffer().copy(data, 8);
    pool.toBuffer().copy(data, 40);
    data.writeBigUInt64LE(2000n, 72);
    data.writeBigUInt64LE(5000n, 80);
    data.writeBigUInt64LE(0n, 88);
    data.writeBigInt64LE(1_700_000_000n, 96);
    data.writeBigInt64LE(1_700_086_400n, 104);
    return data;
  }
  function poolData() {
    const data = Buffer.alloc(122);
    inputMint.toBuffer().copy(data, 40);
    outputMint.toBuffer().copy(data, 72);
    data.writeBigUInt64LE(1n, 104);
    data.writeBigUInt64LE(1n, 112);
    return data;
  }
  function portfolioData() {
    const data = Buffer.alloc(98);
    data.writeBigUInt64LE(10_000n, 72);
    data.writeBigUInt64LE(0n, 80);
    return data;
  }
  const clock = Buffer.alloc(40);
  clock.writeBigInt64LE(1_700_000_000n, 32);
  const accounts = new Map([
    [PROGRAM, { executable: true, data: Buffer.alloc(1) }],
    [config.toBase58(), accountBuffer(122, (data) => configData().copy(data))],
    [mandate.toBase58(), { data: mandateData() }],
    [pool.toBase58(), { data: poolData() }],
    [portfolio.toBase58(), { data: portfolioData() }],
    ["SysvarC1ock11111111111111111111111111111111", { data: clock }],
    [outputMint.toBase58(), { data: Buffer.alloc(82) }],
  ]);
  const gateway = createLabGateway({
    env: env(),
    policySigner,
    runtime,
    now: () => NOW,
    connection: {
      getAccountInfo: async (key) => accounts.get(key.toBase58()) ?? null,
      getLatestBlockhash: async () => ({ blockhash: "11111111111111111111111111111111", lastValidBlockHeight: 9 }),
    },
  });
  const issued = gateway.challenge({ owner: owner.publicKey.toBase58(), host: "127.0.0.1:43147" });
  const signature = Buffer.from(nacl.sign.detached(Buffer.from(issued.message), owner.secretKey)).toString("base64");
  const result = await gateway.authorize({
    host: "127.0.0.1:43147",
    body: {
      owner: owner.publicKey.toBase58(),
      assetId: "lab:dAAPL",
      amountIn: "100",
      minimumAmountOut: "100",
      nonce: "11",
      challenge: { nonce: issued.nonce, signature },
    },
  });
  assert.equal(result.decision, "AUTHORIZED", (result.reasons ?? []).join("; "));
  assert.equal(gateway.signerInvocations, 1);
  assert.ok(result.transactionBytes < 1232);
  const replay = await gateway.authorize({
    host: "127.0.0.1:43147",
    body: {
      owner: owner.publicKey.toBase58(),
      assetId: "lab:dAAPL",
      amountIn: "100",
      minimumAmountOut: "100",
      nonce: "12",
      challenge: { nonce: issued.nonce, signature },
    },
  });
  assert.equal(replay.decision, "BLOCKED");
  assert.equal(gateway.signerInvocations, 1);
  const fresh = gateway.challenge({ owner: owner.publicKey.toBase58(), host: "127.0.0.1:43147" });
  const freshSignature = Buffer.from(nacl.sign.detached(Buffer.from(fresh.message), owner.secretKey)).toString("base64");
  const wrongAsset = await gateway.authorize({
    host: "127.0.0.1:43147",
    body: {
      owner: owner.publicKey.toBase58(),
      assetId: "lab:dNVDA",
      amountIn: "100",
      minimumAmountOut: "100",
      nonce: "13",
      challenge: { nonce: fresh.nonce, signature: freshSignature },
    },
  });
  assert.equal(wrongAsset.decision, "BLOCKED");
  assert.equal(gateway.signerInvocations, 1);
});
