/**
 * Canonical ProofGateAuthorizationV1 bytes for the local test fixture.
 *
 * This module is not a production signer. It does not read the Research Lab,
 * it does not accept an AI proposal, and it only signs the bytes the caller
 * already assembled. The policy key exists only in the test process.
 */
import { createHash } from "node:crypto";
import { Ed25519Program, Keypair, PublicKey } from "@solana/web3.js";

export const AUTHORIZATION_DOMAIN = Buffer.from("proofgate-settlement-lab/authorization-v1");
export const EXECUTION_DOMAIN = Buffer.from("proofgate-settlement-lab/execution-v1");
export const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

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

function pubkey(byte) {
  return new PublicKey(Buffer.alloc(32, byte));
}

export function canonicalAuthorization(fields) {
  return Buffer.concat([
    AUTHORIZATION_DOMAIN,
    Buffer.from([1]),
    fields.programId.toBuffer(),
    Buffer.from(fields.deploymentId),
    fields.config.toBuffer(),
    fields.policySigner.toBuffer(),
    u64(fields.policyVersion),
    u64(fields.authorizationEpoch),
    fields.owner.toBuffer(),
    fields.mandate.toBuffer(),
    fields.pool.toBuffer(),
    fields.inputMint.toBuffer(),
    fields.outputMint.toBuffer(),
    fields.tokenProgram.toBuffer(),
    u64(fields.amountIn),
    u64(fields.minimumOut),
    u64(fields.rateNumerator),
    u64(fields.rateDenominator),
    Buffer.from(fields.evidenceDigest),
    Buffer.from(fields.proposalDigest),
    Buffer.from(fields.executionDigest),
    u64(fields.nonce),
    i64(fields.issuedAt),
    i64(fields.expiresAt),
  ]);
}

export function authorizationDigest(message) {
  return createHash("sha256").update(message).digest();
}

export function executionDigest(parameters) {
  return createHash("sha256").update(Buffer.concat([
    EXECUTION_DOMAIN,
    parameters.programId.toBuffer(),
    parameters.owner.toBuffer(),
    parameters.pool.toBuffer(),
    parameters.mandate.toBuffer(),
    parameters.inputMint.toBuffer(),
    parameters.outputMint.toBuffer(),
    u64(parameters.amountIn),
    u64(parameters.amountOut),
    u64(parameters.minimumOut),
    u64(parameters.nonce),
    i64(parameters.deadline),
    u64(parameters.rateNumerator),
    u64(parameters.rateDenominator),
  ])).digest();
}

export const AUTHORIZATION_VECTOR = {
  programId: pubkey(1),
  deploymentId: Buffer.alloc(32, 21),
  config: pubkey(2),
  policySigner: pubkey(3),
  policyVersion: 1n,
  authorizationEpoch: 1n,
  owner: pubkey(4),
  mandate: pubkey(5),
  pool: pubkey(6),
  inputMint: pubkey(7),
  outputMint: pubkey(8),
  tokenProgram: pubkey(9),
  amountIn: 1000n,
  minimumOut: 900n,
  rateNumerator: 1n,
  rateDenominator: 1n,
  evidenceDigest: Buffer.alloc(32, 10),
  proposalDigest: Buffer.alloc(32, 11),
  executionDigest: Buffer.alloc(32, 12),
  nonce: 7n,
  issuedAt: 1_700_000_000n,
  expiresAt: 1_700_000_120n,
};

export function proofInstruction(policySigner, message, options = {}) {
  const signer = options.signer ?? policySigner;
  // The precompile signs the 32-byte digest. The canonical 530-byte message
  // does not fit beside the swap accounts inside a 1232-byte transaction.
  const instruction = Ed25519Program.createInstructionWithPrivateKey({
    privateKey: signer.secretKey,
    message: options.signedMessage ?? authorizationDigest(message),
  });
  const data = Buffer.from(instruction.data);
  if (options.badSignature) data[48] ^= 0xff;
  if (options.malformedIndex) {
    data.writeUInt16LE(0, 4);
    data.writeUInt16LE(0, 8);
    data.writeUInt16LE(0, 14);
  }
  if (options.unrelatedMessage) {
    const replacement = Buffer.alloc(message.length, 3);
    data.fill(replacement, data.length - message.length);
  }
  instruction.data = data;
  return instruction;
}

export function assertAuthorizationVector(expectedHex) {
  const message = canonicalAuthorization(AUTHORIZATION_VECTOR);
  if (message.length !== 530) {
    throw new Error(`authorization length ${message.length}, expected 530`);
  }
  const digest = authorizationDigest(message).toString("hex");
  if (digest !== expectedHex) {
    throw new Error(`authorization digest diverged: ${digest}`);
  }
  const changed = canonicalAuthorization({ ...AUTHORIZATION_VECTOR, amountIn: 1001n });
  if (authorizationDigest(changed).equals(authorizationDigest(message))) {
    throw new Error("amount_in is not bound");
  }
  return message;
}
