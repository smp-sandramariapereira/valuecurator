import { createPublicKey, verify } from "node:crypto";
import { PublicKey } from "@solana/web3.js";
import {
  proposalApprovalMessage,
  verifyExecutionProposal,
  type ExecutionProposal,
} from "./execution-proposal.js";

export type ApprovalReceipt = {
  schemaVersion: 1;
  kind: "KAIROS_PROPOSAL_APPROVAL";
  proposalId: string;
  evidenceDigest: string;
  signer: string;
  signatureHex: string;
  signedAt: string;
  executionMode: "APPROVAL_ONLY";
  transactionSubmitted: false;
};

export function verifyApprovalReceipt(options: {
  proposal: ExecutionProposal;
  receipt: ApprovalReceipt;
}): { valid: boolean; reason: string | null } {
  const { proposal, receipt } = options;
  const proposalCheck = verifyExecutionProposal(proposal, Date.parse(receipt.signedAt));
  if (!proposalCheck.valid || proposalCheck.expired) {
    return { valid: false, reason: proposalCheck.reason ?? "proposal was not valid when signed" };
  }
  if (receipt.schemaVersion !== 1 || receipt.kind !== "KAIROS_PROPOSAL_APPROVAL" ||
      receipt.executionMode !== "APPROVAL_ONLY" || receipt.transactionSubmitted !== false) {
    return { valid: false, reason: "unsupported approval receipt" };
  }
  if (receipt.proposalId !== proposal.proposalId || receipt.evidenceDigest !== proposal.evidenceDigest) {
    return { valid: false, reason: "receipt is not bound to this proposal and evidence" };
  }
  if (proposal.requiredApprover && receipt.signer !== proposal.requiredApprover) {
    return { valid: false, reason: "receipt signer is not the required approver" };
  }
  const signedAtMs = Date.parse(receipt.signedAt);
  if (!Number.isFinite(signedAtMs) || signedAtMs < Date.parse(proposal.createdAt)) {
    return { valid: false, reason: "receipt signing time is invalid" };
  }
  if (!/^[0-9a-f]{128}$/i.test(receipt.signatureHex)) {
    return { valid: false, reason: "receipt signature must be 64 bytes of hexadecimal" };
  }

  try {
    const rawPublicKey = new PublicKey(receipt.signer).toBytes();
    const spkiPrefix = Buffer.from("302a300506032b6570032100", "hex");
    const publicKey = createPublicKey({
      key: Buffer.concat([spkiPrefix, Buffer.from(rawPublicKey)]),
      format: "der",
      type: "spki",
    });
    const valid = verify(
      null,
      Buffer.from(proposalApprovalMessage(proposal), "utf8"),
      publicKey,
      Buffer.from(receipt.signatureHex, "hex"),
    );
    return valid
      ? { valid: true, reason: null }
      : { valid: false, reason: "approval signature is invalid" };
  } catch (error) {
    return {
      valid: false,
      reason: `cannot verify approval signature: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
