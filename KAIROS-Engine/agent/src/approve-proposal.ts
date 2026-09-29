import { createPrivateKey, sign } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { Keypair } from "@solana/web3.js";
import { dirname, resolve } from "node:path";
import type { ApprovalReceipt } from "./approval-receipt.js";
import {
  proposalApprovalMessage,
  verifyExecutionProposal,
  type ExecutionProposal,
} from "./execution-proposal.js";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const keypairArgument = argument("--keypair");
if (!keypairArgument) throw new Error("Missing explicit --keypair <owner-keypair.json>");
const proposalPath = resolve(argument("--proposal") ?? "../public/execution-proposal.json");
const outputPath = argument("--output") ?? "../public/execution-approval.json";
const proposal = JSON.parse(readFileSync(proposalPath, "utf8")) as ExecutionProposal;
const check = verifyExecutionProposal(proposal);

if (!check.valid || check.expired || proposal.status !== "READY_FOR_APPROVAL") {
  throw new Error(check.reason ?? `Proposal cannot be approved: ${proposal.status}`);
}

const secret = JSON.parse(readFileSync(resolve(keypairArgument), "utf8")) as unknown;
if (!Array.isArray(secret) || secret.length !== 64 || secret.some((item) =>
  !Number.isInteger(item) || Number(item) < 0 || Number(item) > 255)) {
  throw new Error("Owner keypair file must contain a 64-byte Solana secret key array");
}
const keypair = Keypair.fromSecretKey(Uint8Array.from(secret as number[]));
const signer = keypair.publicKey.toBase58();
if (proposal.requiredApprover && signer !== proposal.requiredApprover) {
  throw new Error(`Keypair ${signer} is not the required approver ${proposal.requiredApprover}`);
}

const pkcs8Prefix = Buffer.from("302e020100300506032b657004220420", "hex");
const privateKey = createPrivateKey({
  key: Buffer.concat([pkcs8Prefix, Buffer.from(keypair.secretKey.subarray(0, 32))]),
  format: "der",
  type: "pkcs8",
});
const signature = sign(
  null,
  Buffer.from(proposalApprovalMessage(proposal), "utf8"),
  privateKey,
);
const receipt: ApprovalReceipt = {
  schemaVersion: 1,
  kind: "KAIROS_PROPOSAL_APPROVAL",
  proposalId: proposal.proposalId,
  evidenceDigest: proposal.evidenceDigest,
  signer,
  signatureHex: signature.toString("hex"),
  signedAt: new Date().toISOString(),
  executionMode: "APPROVAL_ONLY",
  transactionSubmitted: false,
};

console.log("Approval: SIGNED");
console.log(`Proposal: ${proposal.proposalId}`);
console.log(`Signer: ${signer}`);
console.log("Private key printed: NO");
console.log("Transaction constructed: NO");
console.log("Transaction submitted: NO");
const destination = resolve(outputPath);
mkdirSync(dirname(destination), { recursive: true, mode: 0o700 });
const temporary = `${destination}.tmp-${process.pid}`;
writeFileSync(temporary, `${JSON.stringify(receipt, null, 2)}\n`, {
  encoding: "utf8",
  mode: 0o600,
});
renameSync(temporary, destination);
console.log(`Receipt: ${destination}`);
