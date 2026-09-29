import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createExecutionProposal,
  verifyExecutionProposal,
  writeProposalAtomically,
} from "./execution-proposal.js";
import type { LivePythEvidenceReport } from "./pyth-evidence.js";

function loadLocalEnv(): void {
  const path = resolve(process.cwd(), ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equals = trimmed.indexOf("=");
    if (equals <= 0) continue;
    const key = trimmed.slice(0, equals).trim();
    let value = trimmed.slice(equals + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

loadLocalEnv();

const evidencePath = resolve(argument("--evidence") ?? "../public/market-evidence.json");
const outputPath = argument("--output") ?? "../public/execution-proposal.json";
const evidence = JSON.parse(readFileSync(evidencePath, "utf8")) as LivePythEvidenceReport;
const proposal = createExecutionProposal({
  evidence,
  ...(process.env.KAIROS_NODE_OWNER?.trim()
    ? { requiredApprover: process.env.KAIROS_NODE_OWNER.trim() }
    : {}),
});
const verification = verifyExecutionProposal(proposal);

if (!verification.valid) throw new Error(verification.reason ?? "proposal verification failed");

console.log("Mode: APPROVAL ONLY");
console.log(`Proposal: ${proposal.proposalId}`);
console.log(`Evidence: ${proposal.evidenceDigest}`);
console.log(`Status: ${proposal.status}`);
console.log(`Valid until: ${proposal.validUntil}`);
console.log(`Required approver: ${proposal.requiredApprover ?? "NOT CONFIGURED"}`);
console.log("Transaction constructed: NO");
console.log("Transaction submitted: NO");
if (proposal.reasons.length) console.log(`Reasons: ${proposal.reasons.join("; ")}`);
console.log(`Execution locked: ${proposal.executionBlockers.join("; ")}`);
console.log(`Report: ${writeProposalAtomically(outputPath, proposal)}`);
