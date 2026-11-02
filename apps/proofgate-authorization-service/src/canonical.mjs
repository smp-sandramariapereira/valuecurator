/**
 * Canonical ProofGateAuthorizationV1. The locked digest must stay equal to
 * programs/settlement-lab-tests/authorization.mjs and the Rust vector.
 * This module signs only a digest the caller already built. It does not decide policy.
 */
import { createHash } from "node:crypto";
import { Ed25519Program, PublicKey } from "@solana/web3.js";

export const AUTHORIZATION_DOMAIN = Buffer.from("proofgate-settlement-lab/authorization-v1");
export const EXECUTION_DOMAIN = Buffer.from("proofgate-settlement-lab/execution-v1");
export const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
export const SETTLEMENT_PROGRAM_ID = new PublicKey("CJ2NA3E8ZWZFMjrLtzAKxGZNomLBP4Tvnh8hQiFD3ecA");
export const ED25519_PROGRAM_ID = new PublicKey("Ed25519SigVerify111111111111111111111111111");
export const LOCKED_AUTHORIZATION_DIGEST = "79f797722d8826bb42c40785417d33c6d3e58867e3ca6caddded9d3b8d0b31f3";

export function u64(value) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(BigInt(value));
  return buffer;
}

export function i64(value) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64LE(BigInt(value));
  return buffer;
}

function filledKey(byte) {
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
  programId: filledKey(1),
  deploymentId: Buffer.alloc(32, 21),
  config: filledKey(2),
  policySigner: filledKey(3),
  policyVersion: 1n,
  authorizationEpoch: 1n,
  owner: filledKey(4),
  mandate: filledKey(5),
  pool: filledKey(6),
  inputMint: filledKey(7),
  outputMint: filledKey(8),
  tokenProgram: filledKey(9),
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

export function anchorDiscriminator(name) {
  return createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}

export function proofInstruction(policySigner, message, options = {}) {
  const signer = options.signer ?? policySigner;
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
  instruction.data = data;
  return instruction;
}
