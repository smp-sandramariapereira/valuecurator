/**
 * Builds the Settlement Lab transaction from an authorization the service already signed.
 * The Ed25519 instruction carries the 32-byte digest, never the 530-byte message.
 */
import nacl from "tweetnacl";
import {
  Connection,
  PublicKey,
  SystemProgram,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  ED25519_PROGRAM_ID,
  SETTLEMENT_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  anchorDiscriminator,
  i64,
  u64,
} from "./canonical.mjs";

const PACKET_LIMIT = 1232;

export function associatedTokenAddress(mint, owner) {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )[0];
}

function meta(pubkey, writable = false, signer = false) {
  return { pubkey, isSigner: signer, isWritable: writable };
}

export function buildSettlementTransaction({
  authorization,
  proof,
  programId = SETTLEMENT_PROGRAM_ID,
  owner,
  pool,
  mandate,
  portfolio,
  inputMint,
  outputMint,
  config,
  blockhash,
  lastValidBlockHeight,
}) {
  if (!proof || authorization?.decision !== "AUTHORIZED" || !authorization.fields) {
    throw new Error("settlement transaction requires an AUTHORIZED proof");
  }
  const fields = authorization.fields;
  const ownerKey = new PublicKey(owner);
  const poolKey = new PublicKey(pool);
  const mandateKey = new PublicKey(mandate);
  const portfolioKey = new PublicKey(portfolio);
  const inputKey = new PublicKey(inputMint);
  const outputKey = new PublicKey(outputMint);
  const configKey = new PublicKey(config);
  if (fields.amountIn <= 0n || fields.minimumOut <= 0n) throw new Error("amounts must be positive");
  const receipt = PublicKey.findProgramAddressSync(
    [Buffer.from("receipt"), mandateKey.toBuffer(), u64(fields.nonce)],
    programId,
  )[0];
  const swap = new TransactionInstruction({
    programId,
    keys: [
      meta(ownerKey, true, true),
      meta(poolKey),
      meta(mandateKey, true),
      meta(portfolioKey, true),
      meta(inputKey),
      meta(outputKey),
      meta(associatedTokenAddress(inputKey, ownerKey), true),
      meta(associatedTokenAddress(outputKey, ownerKey), true),
      meta(associatedTokenAddress(inputKey, poolKey), true),
      meta(associatedTokenAddress(outputKey, poolKey), true),
      meta(receipt, true),
      meta(TOKEN_PROGRAM_ID),
      meta(SystemProgram.programId),
      meta(configKey),
      meta(SYSVAR_INSTRUCTIONS_PUBKEY),
    ],
    data: Buffer.concat([
      anchorDiscriminator("execute_swap"),
      u64(fields.amountIn),
      u64(fields.minimumOut),
      u64(fields.nonce),
      i64(fields.deadline),
      u64(fields.rateNumerator),
      u64(fields.rateDenominator),
      Buffer.from(fields.executionDigest),
      Buffer.from(fields.evidenceDigest),
      Buffer.from(fields.proposalDigest),
      i64(fields.issuedAt),
      i64(fields.expiresAt),
    ]),
  });
  if (!proof.programId.equals(ED25519_PROGRAM_ID)) throw new Error("first instruction must be the Ed25519 precompile");
  const transaction = new Transaction({ feePayer: ownerKey, blockhash, lastValidBlockHeight });
  transaction.add(proof, swap);
  const size = transaction.serialize({ requireAllSignatures: false, verifySignatures: false }).length;
  if (size > PACKET_LIMIT) throw new Error(`transaction is ${size} bytes, above ${PACKET_LIMIT}`);
  return { transaction, receipt, size };
}

export async function submitRaw(rpcUrl, bytes, blockhash, lastValidBlockHeight) {
  const connection = new Connection(rpcUrl, "confirmed");
  const signature = await connection.sendRawTransaction(bytes, { skipPreflight: true });
  if (blockhash && lastValidBlockHeight) {
    await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
  }
  const detail = await connection.getTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
  return { signature, err: detail?.meta?.err ?? null, logs: detail?.meta?.logMessages ?? [] };
}

export function ownerSignedBytes(base64, ownerPublicKey, ownerSecretKey) {
  const transaction = Transaction.from(Buffer.from(base64, "base64"));
  return {
    bytes: attachOwnerSignature(transaction, ownerPublicKey, ownerSecretKey),
    blockhash: transaction.recentBlockhash,
  };
}

export function swapWithoutProof(base64, ownerPublicKey, ownerSecretKey) {
  const transaction = Transaction.from(Buffer.from(base64, "base64"));
  transaction.instructions.shift();
  return {
    bytes: attachOwnerSignature(transaction, ownerPublicKey, ownerSecretKey),
    blockhash: transaction.recentBlockhash,
  };
}

export function swapWithTamperedAmount(base64, ownerPublicKey, ownerSecretKey) {
  const transaction = Transaction.from(Buffer.from(base64, "base64"));
  const digestOffset = 8 + (6 * 8);
  transaction.instructions[1].data[digestOffset] ^= 0xff;
  return {
    bytes: attachOwnerSignature(transaction, ownerPublicKey, ownerSecretKey),
    blockhash: transaction.recentBlockhash,
  };
}

export function attachOwnerSignature(transaction, ownerPublicKey, ownerSecretKey) {
  const owner = new PublicKey(ownerPublicKey);
  const message = transaction.serializeMessage();
  const signature = nacl.sign.detached(message, Uint8Array.from(ownerSecretKey));
  transaction.addSignature(owner, Buffer.from(signature));
  return transaction.serialize();
}

export function unsignedTransactionBase64(transaction) {
  return transaction.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64");
}

export function buildOwnerSetupTransaction({
  kind,
  programId = SETTLEMENT_PROGRAM_ID,
  owner,
  pool,
  inputMint,
  portfolio,
  mandate,
  maxPerTrade,
  maxDaily,
  expiresAt,
  blockhash,
  lastValidBlockHeight,
}) {
  const ownerKey = new PublicKey(owner);
  const inputKey = new PublicKey(inputMint);
  const portfolioKey = new PublicKey(portfolio);
  let instruction;
  if (kind === "portfolio") {
    instruction = new TransactionInstruction({
      programId,
      keys: [
        meta(ownerKey, true, true),
        meta(inputKey),
        meta(portfolioKey, true),
        meta(SystemProgram.programId),
      ],
      data: Buffer.concat([anchorDiscriminator("initialize_portfolio"), u64(maxDaily)]),
    });
  } else if (kind === "mandate") {
    instruction = new TransactionInstruction({
      programId,
      keys: [
        meta(ownerKey, true, true),
        meta(new PublicKey(pool)),
        meta(portfolioKey),
        meta(inputKey),
        meta(new PublicKey(mandate), true),
        meta(SystemProgram.programId),
      ],
      data: Buffer.concat([
        anchorDiscriminator("initialize_mandate"),
        u64(maxPerTrade),
        u64(maxDaily),
        i64(expiresAt),
      ]),
    });
  } else {
    throw new Error("unknown owner setup");
  }
  const transaction = new Transaction({ feePayer: ownerKey, blockhash, lastValidBlockHeight });
  transaction.add(instruction);
  return { transaction, size: transaction.serialize({ requireAllSignatures: false, verifySignatures: false }).length };
}
