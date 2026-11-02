/**
 * Direct Settlement Lab calls against an offline Surfpool on 127.0.0.1.
 * The suite never targets public Devnet. Program and payer secrets stay under
 * programs/.local-keys and programs/target, both ignored by Git.
 */
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createMint,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import { runCustodyScenarios } from "./adversarial.mjs";
import { runProofGateScenarios } from "./proofgate.mjs";
import { runServiceE2E } from "./service-e2e.mjs";
import { runLabFlow } from "./lab-flow.mjs";
import {
  assertAuthorizationVector,
  authorizationDigest,
  canonicalAuthorization,
  executionDigest,
  proofInstruction,
} from "./authorization.mjs";
import {
  Connection,
  Keypair,
  PublicKey,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROGRAMS = resolve(HERE, "..");
const PROGRAM_KEYPAIR = resolve(PROGRAMS, ".local-keys/proofgate-settlement-lab-keypair.json");
const INITIALIZER_KEYPAIR = resolve(PROGRAMS, ".local-keys/proofgate-config-initializer.json");
const DEPLOYMENT_ID = Buffer.alloc(32, 7);
const EVIDENCE_DIGEST = createHash("sha256").update("valuecurator-lab-evidence-v1").digest();
const PROPOSAL_DIGEST = createHash("sha256").update("valuecurator-lab-proposal-v1").digest();
const AUTHORIZATION_VECTOR_DIGEST = "79f797722d8826bb42c40785417d33c6d3e58867e3ca6caddded9d3b8d0b31f3";
const PROGRAM_SO = resolve(PROGRAMS, "target/deploy/proofgate_settlement_lab.so");
const TARGET = resolve(PROGRAMS, "target");
const EXPECTED_PROGRAM_ID = "CJ2NA3E8ZWZFMjrLtzAKxGZNomLBP4Tvnh8hQiFD3ecA";
const RPC_PORT = 18999;
const RPC = `http://127.0.0.1:${RPC_PORT}`;
const RATE_NUMERATOR = 1n;
const RATE_DENOMINATOR = 1n;
const MAX_PER_TRADE = 2_000_000n;
const MANDATE_DAILY = 5_000_000n;
const PORTFOLIO_DAILY = 1_000_000n;
const TRADE = 1_000_000n;

function assertLocal(url) {
  const host = new URL(url).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error(`Refusing non-local RPC ${url}`);
  }
}

function keypairFromFile(path) {
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(path, "utf8"))));
}

function pubkeyFromKeypairFile(path) {
  return keypairFromFile(path).publicKey;
}

function writeKeypair(path, keypair) {
  writeFileSync(path, JSON.stringify(Array.from(keypair.secretKey)));
}

function disc(name) {
  return createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}

function u64(value) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(BigInt(value));
  return buffer;
}

function i64(value) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64LE(BigInt(value));
  return buffer;
}

function ix(name, data, keys) {
  return new TransactionInstruction({
    programId: new PublicKey(EXPECTED_PROGRAM_ID),
    keys,
    data: Buffer.concat([disc(name), ...data]),
  });
}

function meta(pubkey, writable = false, signer = false) {
  return { pubkey, isWritable: writable, isSigner: signer };
}

async function rpc(method, params) {
  assertLocal(RPC);
  const response = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const body = await response.json();
  if (body.error) throw new Error(`${method}: ${JSON.stringify(body.error)}`);
  return body.result;
}

async function waitForRpc() {
  const started = Date.now();
  let last = "not started";
  while (Date.now() - started < 30_000) {
    try {
      const version = await rpc("getVersion", []);
      if (version?.["solana-core"]) return version["solana-core"];
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error(`Surfpool did not answer on ${RPC}: ${last}`);
}

async function clock(connection) {
  const info = await connection.getAccountInfo(new PublicKey("SysvarC1ock11111111111111111111111111111111"));
  if (!info) throw new Error("Clock sysvar is missing");
  return info.data.readBigInt64LE(32);
}

async function tokenAmount(connection, account) {
  const balance = await connection.getTokenAccountBalance(account, "confirmed");
  return BigInt(balance.value.amount);
}

async function accountU64(connection, account, offset) {
  const info = await connection.getAccountInfo(account, "confirmed");
  if (!info) return null;
  return info.data.readBigUInt64LE(offset);
}

function anchorLine(logs) {
  return logs.find((line) => line.includes("Error Code:") || line.includes("Error Number:"))
    ?? logs.find((line) => line.includes("failed"))
    ?? null;
}

async function must(connection, instructions, signers) {
  const outcome = await submit(connection, instructions, signers);
  if (outcome.err) {
    throw new Error(anchorLine(outcome.logs) ?? JSON.stringify(outcome.err));
  }
  return outcome;
}

async function submit(connection, instructions, signers, { requireSignatures = true } = {}) {
  const latest = await connection.getLatestBlockhash("confirmed");
  const transaction = new Transaction().add(...instructions);
  transaction.feePayer = signers[0].publicKey;
  transaction.recentBlockhash = latest.blockhash;
  transaction.sign(...signers);
  const raw = transaction.serialize({ requireAllSignatures: requireSignatures, verifySignatures: requireSignatures });
  const signature = await connection.sendRawTransaction(raw, { skipPreflight: true });
  await connection.confirmTransaction({
    signature,
    blockhash: latest.blockhash,
    lastValidBlockHeight: latest.lastValidBlockHeight,
  }, "confirmed");
  const detail = await connection.getTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });
  return {
    signature,
    err: detail?.meta?.err ?? null,
    logs: detail?.meta?.logMessages ?? [],
  };
}

function sameBalances(before, after) {
  return JSON.stringify(before) === JSON.stringify(after);
}

async function main() {
  assertAuthorizationVector(AUTHORIZATION_VECTOR_DIGEST);
  assertLocal(RPC);
  mkdirSync(TARGET, { recursive: true });
  const programId = pubkeyFromKeypairFile(PROGRAM_KEYPAIR);
  if (programId.toBase58() !== EXPECTED_PROGRAM_ID) {
    throw new Error("Local program keypair does not match declare_id");
  }
  const adminPath = resolve(TARGET, "surfpool-admin-keypair.json");
  const admin = Keypair.generate();
  const owner = Keypair.generate();
  const attacker = Keypair.generate();
  const initializer = keypairFromFile(INITIALIZER_KEYPAIR);
  const policySigner = Keypair.generate();
  const governance = {
    config: PublicKey.findProgramAddressSync([Buffer.from("proofgate-config")], programId)[0],
    deploymentId: DEPLOYMENT_ID,
    policySigner,
    policyVersion: 1n,
    authorizationEpoch: 1n,
  };
  writeKeypair(adminPath, admin);

  const surfpool = spawn("surfpool", [
    "start", "--offline", "--ci", "--no-deploy", "--no-studio", "--yes",
    "--host", "127.0.0.1", "--port", String(RPC_PORT), "--ws-port", "19000",
    "--airdrop-amount", "0",
    "--airdrop-keypair-path", adminPath,
  ], { env: { ...process.env, NO_DNA: "1" }, stdio: ["ignore", "pipe", "pipe"] });
  let surfpoolLog = "";
  surfpool.stdout.on("data", (chunk) => { surfpoolLog += chunk; });
  surfpool.stderr.on("data", (chunk) => { surfpoolLog += chunk; });

  const results = [];
  const record = (entry) => {
    results.push(entry);
    process.stdout.write(`${entry.ok ? "ok" : "FAIL"}  ${entry.name}\n`);
  };

  try {
    const core = await waitForRpc();
    await rpc("surfnet_setAccount", [admin.publicKey.toBase58(), {
      lamports: 20_000_000_000,
      owner: SystemProgram.programId.toBase58(),
    }]);
    await rpc("surfnet_setAccount", [owner.publicKey.toBase58(), {
      lamports: 20_000_000_000,
      owner: SystemProgram.programId.toBase58(),
    }]);
    await rpc("surfnet_setAccount", [attacker.publicKey.toBase58(), {
      lamports: 2_000_000_000,
      owner: SystemProgram.programId.toBase58(),
    }]);
    await rpc("surfnet_setAccount", [initializer.publicKey.toBase58(), {
      lamports: 2_000_000_000,
      owner: SystemProgram.programId.toBase58(),
    }]);

    const deployed = spawnSync("solana", [
      "program", "deploy", PROGRAM_SO,
      "--url", RPC,
      "--program-id", PROGRAM_KEYPAIR,
      "--keypair", adminPath,
      "--upgrade-authority", adminPath,
    ], { encoding: "utf8" });
    if (deployed.status !== 0) {
      throw new Error(`Local program deploy failed\n${deployed.stdout}\n${deployed.stderr}`);
    }

    const connection = new Connection(RPC, "confirmed");
    await must(connection, [
      ix("initialize_proofgate_config", [policySigner.publicKey.toBuffer(), DEPLOYMENT_ID], [
        meta(initializer.publicKey, true, true),
        meta(governance.config, true),
        meta(SystemProgram.programId),
      ]),
    ], [initializer]);
    const inputMint = await createMint(connection, admin, admin.publicKey, null, 6);
    const outputMint = await createMint(connection, admin, admin.publicKey, null, 6);
    const pool = PublicKey.findProgramAddressSync(
      [Buffer.from("pool"), admin.publicKey.toBuffer(), inputMint.toBuffer(), outputMint.toBuffer()],
      programId,
    )[0];
    const portfolio = PublicKey.findProgramAddressSync(
      [Buffer.from("portfolio"), owner.publicKey.toBuffer(), inputMint.toBuffer()],
      programId,
    )[0];
    const mandate = PublicKey.findProgramAddressSync(
      [Buffer.from("mandate"), owner.publicKey.toBuffer(), pool.toBuffer()],
      programId,
    )[0];
    const poolInput = getAssociatedTokenAddressSync(inputMint, pool, true);
    const poolOutput = getAssociatedTokenAddressSync(outputMint, pool, true);
    const ownerInputAccount = await getOrCreateAssociatedTokenAccount(connection, owner, inputMint, owner.publicKey);
    const ownerOutputAccount = await getOrCreateAssociatedTokenAccount(connection, owner, outputMint, owner.publicKey);
    const adminOutputAccount = await getOrCreateAssociatedTokenAccount(connection, admin, outputMint, admin.publicKey);
    await mintTo(connection, admin, inputMint, ownerInputAccount.address, admin, 10_000_000n);
    await mintTo(connection, admin, outputMint, adminOutputAccount.address, admin, 10_000_000n);

    const now = await clock(connection);
    const expiresAt = now + 86_400n;
    await must(connection, [
      ix("initialize_pool", [u64(RATE_NUMERATOR), u64(RATE_DENOMINATOR)], [
        meta(admin.publicKey, true, true),
        meta(inputMint),
        meta(outputMint),
        meta(pool, true),
        meta(poolInput, true),
        meta(poolOutput, true),
        meta(TOKEN_PROGRAM_ID),
        meta(ASSOCIATED_TOKEN_PROGRAM_ID),
        meta(SystemProgram.programId),
      ]),
    ], [admin]);
    await must(connection, [
      ix("initialize_portfolio", [u64(PORTFOLIO_DAILY)], [
        meta(owner.publicKey, true, true),
        meta(inputMint),
        meta(portfolio, true),
        meta(SystemProgram.programId),
      ]),
    ], [owner]);
    await must(connection, [
      ix("initialize_mandate", [u64(MAX_PER_TRADE), u64(MANDATE_DAILY), i64(expiresAt)], [
        meta(owner.publicKey, true, true),
        meta(pool),
        meta(portfolio),
        meta(inputMint),
        meta(mandate, true),
        meta(SystemProgram.programId),
      ]),
    ], [owner]);

    const balances = async () => ({
      ownerDusdc: (await tokenAmount(connection, ownerInputAccount.address)).toString(),
      ownerDaapl: (await tokenAmount(connection, ownerOutputAccount.address)).toString(),
      poolDusdc: (await tokenAmount(connection, poolInput)).toString(),
      poolDaapl: (await tokenAmount(connection, poolOutput)).toString(),
      mandateSpent: (await accountU64(connection, mandate, 88))?.toString() ?? null,
      portfolioSpent: (await accountU64(connection, portfolio, 80))?.toString() ?? null,
    });

    const receiptPda = (nonce) => PublicKey.findProgramAddressSync(
      [Buffer.from("receipt"), mandate.toBuffer(), u64(nonce)],
      programId,
    )[0];

    const swapIx = ({
      signer = owner.publicKey,
      ownerInput = ownerInputAccount.address,
      ownerOutput = ownerOutputAccount.address,
      amountIn,
      minimumOut,
      nonce,
      deadline,
      rateNumerator = RATE_NUMERATOR,
      rateDenominator = RATE_DENOMINATOR,
      amountOut = amountIn * rateNumerator / rateDenominator,
      digest,
      evidenceDigest = EVIDENCE_DIGEST,
      proposalDigest = PROPOSAL_DIGEST,
      issuedAt = deadline - 60n,
      expiresAt = deadline + 120n,
      omitProof = false,
      auth = {},
      proof = {},
    }) => {
      const parameters = {
        programId,
        owner: signer,
        pool,
        mandate,
        inputMint,
        outputMint,
        amountIn,
        amountOut,
        minimumOut,
        nonce,
        deadline,
        rateNumerator,
        rateDenominator,
      };
      const execution = digest ?? executionDigest(parameters);
      const signed = {
        programId,
        deploymentId: governance.deploymentId,
        config: governance.config,
        policySigner: governance.policySigner.publicKey,
        policyVersion: governance.policyVersion,
        authorizationEpoch: governance.authorizationEpoch,
        owner: signer,
        mandate,
        pool,
        inputMint,
        outputMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        amountIn,
        minimumOut,
        rateNumerator,
        rateDenominator,
        evidenceDigest,
        proposalDigest,
        executionDigest: execution,
        nonce,
        issuedAt,
        expiresAt,
        ...auth,
      };
      const proofIx = omitProof ? null : proofInstruction(
        governance.policySigner,
        canonicalAuthorization(signed),
        proof,
      );
      const swap = ix("execute_swap", [
        u64(amountIn), u64(minimumOut), u64(nonce), i64(deadline),
        u64(rateNumerator), u64(rateDenominator),
        execution, evidenceDigest, proposalDigest, i64(issuedAt), i64(expiresAt),
      ], [
        meta(signer, true, true),
        meta(pool),
        meta(mandate, true),
        meta(portfolio, true),
        meta(inputMint),
        meta(outputMint),
        meta(ownerInput, true),
        meta(ownerOutput, true),
        meta(poolInput, true),
        meta(poolOutput, true),
        meta(receiptPda(nonce), true),
        meta(TOKEN_PROGRAM_ID),
        meta(SystemProgram.programId),
        meta(governance.config),
        meta(SYSVAR_INSTRUCTIONS_PUBKEY),
      ]);
      return { proof: proofIx, swap, instructions: proofIx ? [proofIx, swap] : [swap] };
    };

    async function expectReject(name, build, signers, expectedCode) {
      const before = await balances();
      const deadline = await clock(connection) + 60n;
      const built = await build(deadline);
      const outcome = await submit(connection, built.instructions ?? [built], signers, {
        requireSignatures: signers.length > 0,
      });
      const after = await balances();
      const line = anchorLine(outcome.logs);
      const observedText = `${line ?? ""}\n${outcome.logs.join("\n")}`;
      const rolledBack = sameBalances(before, after);
      const matched = Boolean(outcome.err) && observedText.includes(expectedCode) && rolledBack;
      record({
        ok: matched,
        name,
        expected: expectedCode,
        observed: line ?? outcome.logs.slice(-5).join(" | "),
        signature: outcome.signature,
        rolledBack,
        before,
        after,
      });
      return matched;
    }

    const liveDeadline = async () => (await clock(connection)) + 60n;

    await expectReject(
      "reserva vazia rejeita o swap e não move saldo",
      (deadline) => swapIx({ amountIn: TRADE, minimumOut: TRADE, nonce: 1n, deadline }),
      [owner],
      "InsufficientReserve",
    );
    await must(connection, [
      ix("fund_reserve", [u64(500_000n)], [
        meta(admin.publicKey, false, true),
        meta(pool),
        meta(outputMint),
        meta(adminOutputAccount.address, true),
        meta(poolOutput, true),
        meta(TOKEN_PROGRAM_ID),
      ]),
    ], [admin]);
    await expectReject(
      "reserva de 500000 rejeita entrada de 1000000",
      (deadline) => swapIx({ amountIn: TRADE, minimumOut: TRADE, nonce: 2n, deadline }),
      [owner],
      "InsufficientReserve",
    );
    await must(connection, [
      ix("fund_reserve", [u64(5_000_000n)], [
        meta(admin.publicKey, false, true),
        meta(pool),
        meta(outputMint),
        meta(adminOutputAccount.address, true),
        meta(poolOutput, true),
        meta(TOKEN_PROGRAM_ID),
      ]),
    ], [admin]);
    await expectReject(
      "chamada direta acima do teto por operação, com digest correto",
      (deadline) => swapIx({ amountIn: 2_000_001n, minimumOut: 2_000_001n, nonce: 3n, deadline }),
      [owner],
      "LimitExceeded",
    );
    await expectReject(
      "digest diferente dos parâmetros efetivos é recusado",
      (deadline) => {
        const digest = Buffer.from(executionDigest({
          programId, owner: owner.publicKey, pool, mandate, inputMint, outputMint,
          amountIn: TRADE, amountOut: TRADE, minimumOut: TRADE, nonce: 4n, deadline,
          rateNumerator: RATE_NUMERATOR, rateDenominator: RATE_DENOMINATOR,
        }));
        digest[0] ^= 0xff;
        return swapIx({ amountIn: TRADE, minimumOut: TRADE, nonce: 4n, deadline, digest });
      },
      [owner],
      "DigestMismatch",
    );
    await expectReject(
      "minimum_out acima da saída da taxa fixa",
      (deadline) => swapIx({ amountIn: TRADE, minimumOut: TRADE + 1n, nonce: 5n, deadline }),
      [owner],
      "MinimumOutputNotMet",
    );
    await expectReject(
      "taxa cotada diferente da taxa do pool",
      (deadline) => swapIx({
        amountIn: TRADE, minimumOut: TRADE, nonce: 6n, deadline,
        rateNumerator: 2n, rateDenominator: 1n, amountOut: TRADE * 2n,
      }),
      [owner],
      "QuoteChanged",
    );

    const beforeSignature = await balances();
    const unsignedDeadline = await liveDeadline();
    let signatureCase;
    try {
      const latest = await connection.getLatestBlockhash("confirmed");
      const transaction = new Transaction().add(...swapIx({
        amountIn: TRADE, minimumOut: TRADE, nonce: 7n, deadline: unsignedDeadline,
      }).instructions);
      transaction.feePayer = admin.publicKey;
      transaction.recentBlockhash = latest.blockhash;
      transaction.partialSign(admin);
      const raw = transaction.serialize({ requireAllSignatures: false, verifySignatures: false });
      const signature = await connection.sendRawTransaction(raw, { skipPreflight: true });
      const detail = await connection.getTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
      signatureCase = { signature, err: detail?.meta?.err ?? "not landed", logs: detail?.meta?.logMessages ?? [] };
    } catch (error) {
      signatureCase = { signature: null, err: error instanceof Error ? error.message : String(error), logs: [] };
    }
    const afterSignature = await balances();
    record({
      ok: Boolean(signatureCase.err) && sameBalances(beforeSignature, afterSignature),
      name: "swap sem a assinatura do proprietário",
      expected: "missing owner signature",
      observed: typeof signatureCase.err === "string" ? signatureCase.err : JSON.stringify(signatureCase.err),
      signature: signatureCase.signature,
      rolledBack: sameBalances(beforeSignature, afterSignature),
      before: beforeSignature,
      after: afterSignature,
    });

    const attackerInput = await getOrCreateAssociatedTokenAccount(connection, attacker, inputMint, attacker.publicKey);
    const attackerOutput = await getOrCreateAssociatedTokenAccount(connection, attacker, outputMint, attacker.publicKey);
    await expectReject(
      "outra carteira não usa o mandato do proprietário",
      (deadline) => swapIx({
        signer: attacker.publicKey,
        ownerInput: attackerInput.address,
        ownerOutput: attackerOutput.address,
        amountIn: TRADE,
        minimumOut: TRADE,
        nonce: 8n,
        deadline,
      }),
      [attacker],
      "ConstraintSeeds",
    );

    for (const [name, instructionName, authority, account] of [
      ["pool pausado bloqueia o swap", "set_pool_paused", admin, pool],
      ["mandato pausado bloqueia o swap", "set_mandate_paused", owner, mandate],
      ["portfólio pausado bloqueia o swap", "set_portfolio_paused", owner, portfolio],
    ]) {
      await must(connection, [ix(instructionName, [Buffer.from([1])], [
        meta(authority.publicKey, false, true),
        meta(account, true),
      ])], [authority]);
      await expectReject(
        name,
        (deadline) => swapIx({ amountIn: TRADE, minimumOut: TRADE, nonce: 9n, deadline }),
        [owner],
        "Paused",
      );
      await must(connection, [ix(instructionName, [Buffer.from([0])], [
        meta(authority.publicKey, false, true),
        meta(account, true),
      ])], [authority]);
    }

    const beforeHappy = await balances();
    const happyDeadline = await liveDeadline();
    const happyNonce = 10n;
    const happy = await submit(connection,
      swapIx({ amountIn: TRADE, minimumOut: TRADE, nonce: happyNonce, deadline: happyDeadline }).instructions,
      [owner]);
    const afterHappy = await balances();
    const receipt = receiptPda(happyNonce);
    const receiptInfo = await connection.getAccountInfo(receipt, "confirmed");
    const expectedDigest = executionDigest({
      programId, owner: owner.publicKey, pool, mandate, inputMint, outputMint,
      amountIn: TRADE, amountOut: TRADE, minimumOut: TRADE, nonce: happyNonce, deadline: happyDeadline,
      rateNumerator: RATE_NUMERATOR, rateDenominator: RATE_DENOMINATOR,
    });
    const storedDigest = receiptInfo?.data.subarray(96, 128);
    const happyOk = !happy.err
      && beforeHappy.ownerDusdc === "10000000"
      && afterHappy.ownerDusdc === "9000000"
      && afterHappy.ownerDaapl === "1000000"
      && afterHappy.poolDusdc === "1000000"
      && afterHappy.poolDaapl === "4500000"
      && afterHappy.mandateSpent === "1000000"
      && afterHappy.portfolioSpent === "1000000"
      && storedDigest?.equals(expectedDigest);
    record({
      ok: happyOk,
      name: "swap sintético válido dUSDC para dAAPL",
      signature: happy.signature,
      observed: happy.err ? anchorLine(happy.logs) : "executed",
      receipt: receipt.toBase58(),
      digest: storedDigest?.toString("hex") ?? null,
      before: beforeHappy,
      after: afterHappy,
    });

    await expectReject(
      "o mesmo nonce não executa de novo",
      () => swapIx({ amountIn: TRADE, minimumOut: TRADE, nonce: happyNonce, deadline: happyDeadline }),
      [owner],
      "already in use",
    );
    await expectReject(
      "chamada direta não ultrapassa o teto agregado do portfólio",
      (deadline) => swapIx({ amountIn: 1n, minimumOut: 1n, nonce: 11n, deadline }),
      [owner],
      "LimitExceeded",
    );

    const nowSeconds = await clock(connection);
    const targetMs = Number(nowSeconds + 200_000n) * 1000;
    await rpc("surfnet_timeTravel", [{ absoluteTimestamp: targetMs }]);
    const traveled = await clock(connection);
    if (traveled <= expiresAt) {
      throw new Error(`Clock stayed at ${traveled}, mandate expires at ${expiresAt}`);
    }
    await expectReject(
      "mandato vencido rejeita a chamada direta",
      async () => swapIx({
        amountIn: 1n,
        minimumOut: 1n,
        nonce: 12n,
        deadline: (await clock(connection)) + 60n,
      }),
      [owner],
      "Expired",
    );

    const proveSwap = (built, fields = {}) => {
      const signed = {
        programId,
        deploymentId: governance.deploymentId,
        config: governance.config,
        policySigner: governance.policySigner.publicKey,
        policyVersion: governance.policyVersion,
        authorizationEpoch: governance.authorizationEpoch,
        owner: built.parameters.owner,
        mandate: built.parameters.mandate,
        pool: built.parameters.pool,
        inputMint: built.parameters.inputMint,
        outputMint: built.parameters.outputMint,
        tokenProgram: fields.tokenProgram ?? TOKEN_PROGRAM_ID,
        amountIn: built.parameters.amountIn,
        minimumOut: built.parameters.minimumOut,
        rateNumerator: built.parameters.rateNumerator,
        rateDenominator: built.parameters.rateDenominator,
        evidenceDigest: built.evidenceDigest,
        proposalDigest: built.proposalDigest,
        executionDigest: built.executionDigest,
        nonce: built.parameters.nonce,
        issuedAt: built.issuedAt,
        expiresAt: built.expiresAt,
        ...(fields.auth ?? {}),
      };
      if (fields.omitProof) return [];
      return [proofInstruction(governance.policySigner, canonicalAuthorization(signed), fields.proof ?? {})];
    };

    await runCustodyScenarios({
      connection, programId, admin, owner, inputMint, outputMint, pool, poolInput, poolOutput,
      mandate, adminOutput: adminOutputAccount, record, must, submit, ix, meta, u64, i64, clock, rpc,
      tokenAmount, accountU64, executionDigest, anchorLine, proveSwap, governance,
      evidenceDigest: EVIDENCE_DIGEST, proposalDigest: PROPOSAL_DIGEST,
      instructionsSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
    });
    await runProofGateScenarios({
      connection, programId, admin, initializer, inputMint, outputMint, pool, poolInput, poolOutput,
      record, must, submit, ix, meta, u64, i64,
      clock, rpc, tokenAmount, accountU64, executionDigest, anchorLine, proveSwap, governance,
      evidenceDigest: EVIDENCE_DIGEST, proposalDigest: PROPOSAL_DIGEST,
      instructionsSysvar: SYSVAR_INSTRUCTIONS_PUBKEY, canonicalAuthorization, authorizationDigest,
    });
    await runServiceE2E({
      connection, programId, admin, inputMint, outputMint, pool, poolInput, poolOutput,
      governance, record, must, submit, ix, meta, u64, i64, clock, rpc, tokenAmount,
    });
    await runLabFlow({
      connection, programId, admin, inputMint, outputMint, pool, governance,
      record, must, ix, meta, u64, i64, clock, rpc,
    });

    const failed = results.filter((entry) => !entry.ok);
    const report = {
      cluster: RPC,
      surfpool: "offline",
      solanaCore: core,
      programId: programId.toBase58(),
      inputMint: inputMint.toBase58(),
      outputMint: outputMint.toBase58(),
      symbols: { input: "dUSDC", output: "dAAPL", decimals: 6 },
      limits: {
        maxPerTrade: MAX_PER_TRADE.toString(),
        mandateDaily: MANDATE_DAILY.toString(),
        portfolioDaily: PORTFOLIO_DAILY.toString(),
      },
      passed: results.length - failed.length,
      failed: failed.length,
      results,
    };
    writeFileSync(resolve(TARGET, "surfpool-results.json"), JSON.stringify(report, null, 2));
    process.stdout.write(`${report.passed} passed, ${report.failed} failed\n`);
    if (failed.length) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    if (surfpoolLog.trim()) process.stderr.write(`${surfpoolLog.slice(-4000)}\n`);
    process.exitCode = 1;
  } finally {
    surfpool.kill("SIGTERM");
    process.exit(process.exitCode ?? 0);
  }
}

await main();
