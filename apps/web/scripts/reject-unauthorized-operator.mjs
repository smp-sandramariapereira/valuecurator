/**
 * Devnet-only: submit metabolize_yield from a throwaway operator.
 * The program must reject it with UnauthorizedOperator.
 * The keypair lives in memory for this process and is not written to disk.
 */
import { readFileSync } from "node:fs";
import anchor from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountIdempotent,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import idl from "../idl/kairos_engine.json" with { type: "json" };

const { AnchorProvider, BN, Program, Wallet } = anchor;

const feePayerPath = process.env.SOLANA_FEE_PAYER;
if (!feePayerPath) throw new Error("Set SOLANA_FEE_PAYER to a Devnet fee-payer keypair file");

const RPC = "https://api.devnet.solana.com";
const OWNER = new PublicKey("DCfdgGKxPuGEKAa1mPneQK5RYqR2fPntsbgfurauAB4C");
const MINT = new PublicKey("3c9wq8dP5fXU34Fc6tEx53YQnbYMnqwd1S8DkCp6YpBm");
const NODE = new PublicKey("LwuCrFTwdkkH24Ni3Kc4UuL56pzvvnyag1gNQzjCALS");

const connection = new Connection(RPC, "confirmed");
const feePayer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(feePayerPath, "utf8"))));
const stranger = Keypair.generate();
const provider = new AnchorProvider(connection, new Wallet(feePayer), { commitment: "confirmed" });
const program = new Program(idl, provider);

const node = await program.account.nodeAccount.fetch(NODE);
if (!node.owner.equals(OWNER)) throw new Error(`Node owner mismatch: ${node.owner.toBase58()}`);
if (node.operator.equals(stranger.publicKey) || node.operator.equals(feePayer.publicKey)) {
  throw new Error("Refusing to sign the instruction as the registered operator");
}

console.log(JSON.stringify({
  cluster: "devnet",
  instruction: "metabolize_yield",
  amount: "1",
  node: NODE.toBase58(),
  owner: node.owner.toBase58(),
  registeredOperator: node.operator.toBase58(),
  instructionSigner: stranger.publicKey.toBase58(),
  feePayer: feePayer.publicKey.toBase58(),
  mint: MINT.toBase58(),
  expectedError: "UnauthorizedOperator",
  movesVault: false,
}, null, 2));

const source = await createAssociatedTokenAccountIdempotent(
  connection,
  feePayer,
  MINT,
  stranger.publicKey,
  undefined,
  TOKEN_2022_PROGRAM_ID,
);
const vault = getAssociatedTokenAddressSync(MINT, NODE, true, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
const treasury = getAssociatedTokenAddressSync(
  MINT,
  node.treasuryPubkey,
  true,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
);

const builder = program.methods.metabolizeYield(new BN(1)).accountsPartial({
  operator: stranger.publicKey,
  owner: OWNER,
  node: NODE,
  treasuryPubkey: node.treasuryPubkey,
  mint: MINT,
  sourceToken: source,
  vaultToken: vault,
  treasuryToken: treasury,
  tokenProgram: TOKEN_2022_PROGRAM_ID,
  associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
}).signers([stranger]);

const tx = await builder.transaction();
const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
tx.feePayer = feePayer.publicKey;
tx.recentBlockhash = blockhash;
tx.sign(feePayer, stranger);

const simulation = await connection.simulateTransaction(tx);
const logs = simulation.value.logs ?? [];
console.log(logs.join("\n"));
if (!logs.some((line) => line.includes("UnauthorizedOperator"))) {
  console.error(simulation.value.err);
  throw new Error("Simulation did not return UnauthorizedOperator. Transaction was not sent.");
}

const signature = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true });
const confirmation = await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
const landed = await connection.getTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
const landedErr = landed?.meta?.err ?? confirmation.value.err;
const landedLogs = landed?.meta?.logMessages ?? [];
if (!landedErr || !landedLogs.some((line) => line.includes("UnauthorizedOperator"))) {
  console.error({ landedErr, landedLogs });
  throw new Error("Landed transaction did not fail with UnauthorizedOperator");
}

console.log(JSON.stringify({
  result: "rejected",
  error: "UnauthorizedOperator",
  signature,
  explorer: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
}, null, 2));
