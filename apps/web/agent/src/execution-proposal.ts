import { createHash } from "node:crypto";
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { LivePythEvidenceReport } from "./pyth-evidence.js";

type ProposalEvidenceReport = Omit<LivePythEvidenceReport, "source" | "simulated"> & {
  source: "pyth-pro" | "fixture";
  simulated: boolean;
  simulationScenario?: "safe" | "stale" | "divergent";
};

export type ExecutionProposal = {
  schemaVersion: 1;
  proposalId: string;
  evidenceDigest: string;
  createdAt: string;
  validUntil: string;
  status: "READY_FOR_APPROVAL" | "BLOCKED";
  executionMode: "APPROVAL_ONLY";
  executionEnabled: false;
  programNetwork: "devnet";
  marketNetwork: "mainnet-beta";
  requiredApprover: string | null;
  symbol: string;
  mint: string;
  inputMint: string;
  inputAmount: string;
  minimumOutputAmount: string;
  referenceFeedId: string;
  mandate: {
    maximumPriceAgeMs: number;
    maximumConfidenceBps: number;
    maximumDeviationBps: number;
  };
  reasons: readonly string[];
  executionBlockers: readonly string[];
};

function canonicalize(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) =>
    `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(",")}}`;
}

function digest(value: unknown): string {
  return createHash("sha256").update(canonicalize(value)).digest("hex");
}

function nonEmpty(value: string | null | undefined, label: string, reasons: string[]): string {
  if (!value?.trim()) {
    reasons.push(`${label} is unavailable`);
    return "UNAVAILABLE";
  }
  return value;
}

export function createExecutionProposal(options: {
  evidence: ProposalEvidenceReport;
  requiredApprover?: string | null;
  nowMs?: number;
}): ExecutionProposal {
  const { evidence } = options;
  const nowMs = options.nowMs ?? Date.now();
  const reasons = [...evidence.reasons];
  const validUntilMs = evidence.publishTimeMs + evidence.maximumPriceAgeMs;

  if (evidence.schemaVersion !== 1) reasons.push("unsupported evidence schema");
  if (evidence.source !== "pyth-pro" || evidence.simulated) {
    reasons.push("only live Pyth Pro evidence can create an approval proposal");
  }
  if (evidence.transactionSubmitted) reasons.push("evidence already reports a submitted transaction");
  if (evidence.decision !== "APPROVED") reasons.push("market evidence is not approved");
  if (nowMs > validUntilMs) reasons.push("market evidence expired before proposal creation");
  if (evidence.marketNetwork !== "mainnet-beta") reasons.push("market network is unavailable or unsupported");

  const mint = nonEmpty(evidence.mint, "output mint", reasons);
  const inputMint = nonEmpty(evidence.quoteInputMint, "input mint", reasons);
  const inputAmount = nonEmpty(evidence.quoteInputAmount, "input amount", reasons);
  const minimumOutputAmount = nonEmpty(
    evidence.quoteMinimumOutputAmount,
    "minimum output amount",
    reasons,
  );
  const uniqueReasons = [...new Set(reasons)];
  const evidenceDigest = digest(evidence);
  const body = {
    schemaVersion: 1 as const,
    evidenceDigest,
    createdAt: new Date(nowMs).toISOString(),
    validUntil: new Date(validUntilMs).toISOString(),
    status: uniqueReasons.length === 0 ? "READY_FOR_APPROVAL" as const : "BLOCKED" as const,
    executionMode: "APPROVAL_ONLY" as const,
    executionEnabled: false as const,
    programNetwork: "devnet" as const,
    marketNetwork: "mainnet-beta" as const,
    requiredApprover: options.requiredApprover?.trim() || null,
    symbol: evidence.symbol,
    mint,
    inputMint,
    inputAmount,
    minimumOutputAmount,
    referenceFeedId: evidence.referenceFeedId,
    mandate: {
      maximumPriceAgeMs: evidence.maximumPriceAgeMs,
      maximumConfidenceBps: evidence.maximumConfidenceBps,
      maximumDeviationBps: evidence.maximumDeviationBps,
    },
    reasons: uniqueReasons,
    executionBlockers: [
      "KAIROS program is deployed on devnet while the AAPLx market evidence is mainnet-beta",
      "approval signature is an auditable attestation and cannot submit a transaction",
    ],
  };

  return { ...body, proposalId: digest(body) };
}

export function verifyExecutionProposal(proposal: ExecutionProposal, nowMs = Date.now()): {
  valid: boolean;
  expired: boolean;
  reason: string | null;
} {
  const { proposalId, ...body } = proposal;
  if (digest(body) !== proposalId) {
    return { valid: false, expired: false, reason: "proposal digest does not match its contents" };
  }
  const validUntilMs = Date.parse(proposal.validUntil);
  if (!Number.isFinite(validUntilMs)) {
    return { valid: false, expired: false, reason: "proposal expiry is invalid" };
  }
  if (nowMs > validUntilMs) {
    return { valid: true, expired: true, reason: "proposal market evidence has expired" };
  }
  return { valid: true, expired: false, reason: null };
}

export function proposalApprovalMessage(proposal: ExecutionProposal): string {
  return [
    "KAIROS EXECUTION PROPOSAL APPROVAL",
    `proposalId=${proposal.proposalId}`,
    `evidenceDigest=${proposal.evidenceDigest}`,
    `validUntil=${proposal.validUntil}`,
    `mode=${proposal.executionMode}`,
    "transactionSubmitted=false",
  ].join("\n");
}

export function writeProposalAtomically(path: string, proposal: ExecutionProposal): string {
  const destination = resolve(path);
  mkdirSync(dirname(destination), { recursive: true });
  const temporary = `${destination}.tmp-${process.pid}`;
  writeFileSync(temporary, `${JSON.stringify(proposal, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  renameSync(temporary, destination);
  return destination;
}
