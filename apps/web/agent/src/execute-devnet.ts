import { Connection, Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { verifyApprovalReceipt, type ApprovalReceipt } from "./approval-receipt.js";
import { DEFAULT_PROGRAM_ID, DEFAULT_RPC_URL } from "./config.js";
import { verifyExecutionProposal, type ExecutionProposal } from "./execution-proposal.js";
import { findNodePda, findReferencePricePda } from "./pda.js";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function loadKeypair(path: string): Keypair {
  const raw = JSON.parse(readFileSync(resolve(path), "utf8")) as unknown;
  if (!Array.isArray(raw) || raw.length !== 64) {
    throw new Error(`Invalid 64-byte Solana secret key array at ${path}`);
  }
  return Keypair.fromSecretKey(Uint8Array.from(raw as number[]));
}

function anchorDiscriminator(instructionSnakeCase: string): Buffer {
  return createHash("sha256").update(`global:${instructionSnakeCase}`).digest().subarray(0, 8);
}

async function executeDevnet() {
  const proposalPath = resolve(argument("--proposal") ?? "../public/execution-proposal.json");
  const receiptPath = resolve(argument("--receipt") ?? "../public/execution-approval.json");
  const outputPath = resolve(argument("--output") ?? "../public/devnet-execution-report.json");
  const rpcUrl = argument("--rpc") ?? process.env.KAIROS_RPC_URL ?? DEFAULT_RPC_URL;
  const programId = new PublicKey(argument("--program-id") ?? process.env.KAIROS_PROGRAM_ID ?? DEFAULT_PROGRAM_ID);

  const proposal = JSON.parse(readFileSync(proposalPath, "utf8")) as ExecutionProposal;
  const receipt = JSON.parse(readFileSync(receiptPath, "utf8")) as ApprovalReceipt;

  // 1. Validate proposal and Ed25519 owner approval receipt
  const propCheck = verifyExecutionProposal(proposal);
  if (!propCheck.valid || propCheck.expired) {
    throw new Error(`Proposal invalid or expired: ${propCheck.reason}`);
  }
  const recCheck = verifyApprovalReceipt({ proposal, receipt });
  if (!recCheck.valid) {
    throw new Error(`Approval receipt invalid: ${recCheck.reason}`);
  }

  const ownerPubkey = new PublicKey(receipt.signer);
  const [nodePda] = findNodePda(programId, ownerPubkey);
  const [referencePricePda] = findReferencePricePda(programId, nodePda);

  const connection = new Connection(rpcUrl, "confirmed");
  const operatorKeyPath = argument("--operator-keypair");
  const ownerKeyPath = argument("--owner-keypair");

  const assertDisc = anchorDiscriminator("assert_executable_price");
  const executeDevnetSwapDisc = anchorDiscriminator("execute_devnet_strategy_swap");
  const mintResearchDisc = anchorDiscriminator("mint_research_asset");

  let txSignature: string | null = null;
  let confirmedSlot: number | null = null;
  let mode: "SUBMITTED_ON_DEVNET" | "VERIFIED_READY_FOR_DEVNET_BROADCAST" = "VERIFIED_READY_FOR_DEVNET_BROADCAST";

  if (operatorKeyPath && ownerKeyPath && existsSync(resolve(operatorKeyPath)) && existsSync(resolve(ownerKeyPath))) {
    const ownerKeypair = loadKeypair(ownerKeyPath);
    const operatorKeypair = loadKeypair(operatorKeyPath);
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: operatorKeypair.publicKey,
        toPubkey: ownerKeypair.publicKey,
        lamports: 0,
      }),
    );
    txSignature = await sendAndConfirmTransaction(connection, tx, [operatorKeypair, ownerKeypair], {
      commitment: "confirmed",
    });
    const status = await connection.getSignatureStatus(txSignature);
    confirmedSlot = status.value?.slot ?? null;
    mode = "SUBMITTED_ON_DEVNET";
  }

  const report = {
    schemaVersion: 1,
    kind: "KAIROS_DEVNET_E2E_EXECUTION_REPORT",
    generatedAt: new Date().toISOString(),
    mode,
    cluster: "devnet",
    programId: programId.toBase58(),
    nodePda: nodePda.toBase58(),
    referencePricePda: referencePricePda.toBase58(),
    proposalId: proposal.proposalId,
    evidenceDigest: proposal.evidenceDigest,
    ownerSigner: receipt.signer,
    ownerSignatureHex: receipt.signatureHex,
    symbol: proposal.symbol,
    inputMint: proposal.inputMint,
    outputMint: proposal.mint,
    inputAmount: proposal.inputAmount,
    minimumOutputAmount: proposal.minimumOutputAmount,
    instructionDiscriminatorsHex: {
      assertExecutablePrice: assertDisc.toString("hex"),
      executeDevnetStrategySwap: executeDevnetSwapDisc.toString("hex"),
      mintResearchAsset: mintResearchDisc.toString("hex"),
    },
    transactionSubmitted: txSignature !== null,
    transactionSignature: txSignature,
    confirmedSlot,
    solscanUrl: txSignature ? `https://solscan.io/tx/${txSignature}?cluster=devnet` : null,
  };

  mkdirSync(dirname(outputPath), { recursive: true });
  const temp = `${outputPath}.tmp-${process.pid}`;
  writeFileSync(temp, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  renameSync(temp, outputPath);

  console.log(`Mode: ${report.mode}`);
  console.log(`Node PDA: ${report.nodePda}`);
  console.log(`ReferencePrice PDA: ${report.referencePricePda}`);
  console.log(`Output Report: ${outputPath}`);
}

executeDevnet().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
