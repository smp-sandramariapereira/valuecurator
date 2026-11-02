/**
 * Prepare one local Surfpool for /lab.
 * Refuses any RPC that is not loopback. Does not print private keys.
 *
 * The Surfpool process must already be listening on 127.0.0.1:18999.
 * Owner portfolio and mandate are not created here. The connected wallet signs those.
 */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
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
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROGRAMS = resolve(HERE, "..");
const RPC = "http://127.0.0.1:18999";
const PROGRAM_ID = new PublicKey("CJ2NA3E8ZWZFMjrLtzAKxGZNomLBP4Tvnh8hQiFD3ecA");
const PROGRAM_KEYPAIR = resolve(PROGRAMS, ".local-keys/proofgate-settlement-lab-keypair.json");
const INITIALIZER_KEYPAIR = resolve(PROGRAMS, ".local-keys/proofgate-config-initializer.json");
const POLICY_KEYPAIR = resolve(PROGRAMS, ".local-keys/proofgate-policy-signer-keypair.json");
const PROGRAM_SO = resolve(PROGRAMS, "target/deploy/proofgate_settlement_lab.so");
const RUNTIME = resolve(PROGRAMS, "target/lab-runtime.json");
const ADMIN_PATH = resolve(PROGRAMS, "target/surfpool-admin-keypair.json");
const DEPLOYMENT_ID = Buffer.alloc(32, 7);

function assertLocal() {
  const host = new URL(RPC).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") throw new Error("Refusing non-local RPC");
}

function loadKeypair(path) {
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(path, "utf8"))));
}

function disc(name) {
  return createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}

function u64(value) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(BigInt(value));
  return buffer;
}

async function send(connection, instructions, signers) {
  const latest = await connection.getLatestBlockhash("confirmed");
  const transaction = new Transaction().add(...instructions);
  transaction.feePayer = signers[0].publicKey;
  transaction.recentBlockhash = latest.blockhash;
  transaction.sign(...signers);
  const signature = await connection.sendRawTransaction(transaction.serialize(), { skipPreflight: true });
  await connection.confirmTransaction({ signature, ...latest }, "confirmed");
  const detail = await connection.getTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
  if (detail?.meta?.err) throw new Error(JSON.stringify(detail.meta.err));
}

async function main() {
  assertLocal();
  const ownerArg = process.argv.find((arg) => arg.startsWith("--owner="));
  const ownerText = ownerArg ? ownerArg.slice("--owner=".length) : "";
  mkdirSync(resolve(PROGRAMS, "target"), { recursive: true });
  mkdirSync(resolve(PROGRAMS, ".local-keys"), { recursive: true });
  const connection = new Connection(RPC, "confirmed");
  await connection.getLatestBlockhash("confirmed");
  const admin = Keypair.generate();
  writeFileSync(ADMIN_PATH, JSON.stringify(Array.from(admin.secretKey)));
  const initializer = loadKeypair(INITIALIZER_KEYPAIR);
  let policy;
  try {
    policy = loadKeypair(POLICY_KEYPAIR);
  } catch {
    policy = Keypair.generate();
    writeFileSync(POLICY_KEYPAIR, JSON.stringify(Array.from(policy.secretKey)));
  }
  await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "surfnet_setAccount", params: [admin.publicKey.toBase58(), { lamports: 20_000_000_000, owner: SystemProgram.programId.toBase58() }] }),
  });
  await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "surfnet_setAccount", params: [initializer.publicKey.toBase58(), { lamports: 2_000_000_000, owner: SystemProgram.programId.toBase58() }] }),
  });
  if (ownerText) {
    await fetch(RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "surfnet_setAccount", params: [ownerText, { lamports: 2_000_000_000, owner: SystemProgram.programId.toBase58() }] }),
    });
  }
  const deployed = spawnSync("solana", [
    "program", "deploy", PROGRAM_SO, "--url", RPC, "--program-id", PROGRAM_KEYPAIR,
    "--keypair", ADMIN_PATH, "--upgrade-authority", ADMIN_PATH,
  ], { encoding: "utf8" });
  if (deployed.status !== 0) throw new Error(deployed.stderr || deployed.stdout);
  const config = PublicKey.findProgramAddressSync([Buffer.from("proofgate-config")], PROGRAM_ID)[0];
  const existing = await connection.getAccountInfo(config);
  if (!existing) {
    await send(connection, [new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: initializer.publicKey, isSigner: true, isWritable: true },
        { pubkey: config, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: Buffer.concat([disc("initialize_proofgate_config"), policy.publicKey.toBuffer(), DEPLOYMENT_ID]),
    })], [initializer]);
  }
  const inputMint = await createMint(connection, admin, admin.publicKey, null, 6);
  const outputMint = await createMint(connection, admin, admin.publicKey, null, 6);
  const pool = PublicKey.findProgramAddressSync(
    [Buffer.from("pool"), admin.publicKey.toBuffer(), inputMint.toBuffer(), outputMint.toBuffer()],
    PROGRAM_ID,
  )[0];
  const poolInput = getAssociatedTokenAddressSync(inputMint, pool, true);
  const poolOutput = getAssociatedTokenAddressSync(outputMint, pool, true);
  const adminOutput = await getOrCreateAssociatedTokenAccount(connection, admin, outputMint, admin.publicKey);
  await mintTo(connection, admin, outputMint, adminOutput.address, admin, 10_000_000n);
  await send(connection, [new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: admin.publicKey, isSigner: true, isWritable: true },
      { pubkey: inputMint, isSigner: false, isWritable: false },
      { pubkey: outputMint, isSigner: false, isWritable: false },
      { pubkey: pool, isSigner: false, isWritable: true },
      { pubkey: poolInput, isSigner: false, isWritable: true },
      { pubkey: poolOutput, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([disc("initialize_pool"), u64(1n), u64(1n)]),
  })], [admin]);
  await send(connection, [new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: admin.publicKey, isSigner: false, isWritable: true },
      { pubkey: pool, isSigner: false, isWritable: false },
      { pubkey: outputMint, isSigner: false, isWritable: false },
      { pubkey: adminOutput.address, isSigner: false, isWritable: true },
      { pubkey: poolOutput, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([disc("fund_reserve"), u64(5_000_000n)]),
  })], [admin]);
  if (ownerText) {
    const owner = new PublicKey(ownerText);
    const ata = await getOrCreateAssociatedTokenAccount(connection, admin, inputMint, owner);
    await mintTo(connection, admin, inputMint, ata.address, admin, 10_000_000n);
  }
  const runtime = {
    deploymentId: DEPLOYMENT_ID.toString("hex"),
    config: config.toBase58(),
    policySigner: policy.publicKey.toBase58(),
    pool: pool.toBase58(),
    inputMint: inputMint.toBase58(),
    outputMint: outputMint.toBase58(),
    admin: admin.publicKey.toBase58(),
    asset: {
      assetId: "lab:dAAPL",
      displayName: "Synthetic dAAPL",
      mint: outputMint.toBase58(),
      network: "devnet-lab",
      tokenProgram: TOKEN_PROGRAM_ID.toBase58(),
      verificationStatus: "VERIFIED",
      synthetic: true,
    },
    limits: { maxPerTrade: "2000000", maxDaily: "5000000", portfolioDaily: "1000000" },
  };
  writeFileSync(RUNTIME, JSON.stringify(runtime, null, 2));
  process.stdout.write(`lab runtime written\nprogram ${PROGRAM_ID.toBase58()}\noutput mint ${outputMint.toBase58()}\npolicy signer ${policy.publicKey.toBase58()}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "provision failed"}\n`);
  process.exit(1);
});
