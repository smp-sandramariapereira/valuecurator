import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { verifyApprovalReceipt, type ApprovalReceipt } from "./approval-receipt.js";
import type { ExecutionProposal } from "./execution-proposal.js";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const proposalPath = resolve(argument("--proposal") ?? "../public/execution-proposal.json");
const receiptArgument = argument("--receipt");
if (!receiptArgument) throw new Error("Missing --receipt <approval-receipt.json>");
const receiptPath = resolve(receiptArgument);
const proposal = JSON.parse(readFileSync(proposalPath, "utf8")) as ExecutionProposal;
const receipt = JSON.parse(readFileSync(receiptPath, "utf8")) as ApprovalReceipt;
const result = verifyApprovalReceipt({ proposal, receipt });

console.log(`Proposal: ${proposal.proposalId}`);
console.log(`Signer: ${receipt.signer}`);
console.log(`Approval receipt: ${result.valid ? "VALID" : "INVALID"}`);
if (result.reason) console.log(`Reason: ${result.reason}`);
if (!result.valid) process.exitCode = 1;
