import { createHash } from "node:crypto";

export const EVIDENCE_DOMAIN = Buffer.from("proofgate-authorization-service/lab-evidence-v1");
export const PROPOSAL_DOMAIN = Buffer.from("proofgate-authorization-service/proposal-v1");
const MAX_EVIDENCE_WINDOW_SECONDS = 300;

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

export function evidenceMessage(evidence) {
  return Buffer.concat([
    EVIDENCE_DOMAIN,
    Buffer.from(evidence.assetId, "utf8"),
    evidence.inputMint.toBuffer(),
    evidence.outputMint.toBuffer(),
    u64(evidence.rateNumerator),
    u64(evidence.rateDenominator),
    i64(evidence.observedAt),
    i64(evidence.expiresAt),
  ]);
}

export function evidenceDigest(evidence) {
  return createHash("sha256").update(evidenceMessage(evidence)).digest();
}

export function proposalDigest(fields) {
  return createHash("sha256").update(Buffer.concat([
    PROPOSAL_DOMAIN,
    fields.owner.toBuffer(),
    fields.mandate.toBuffer(),
    fields.pool.toBuffer(),
    fields.inputMint.toBuffer(),
    fields.outputMint.toBuffer(),
    u64(fields.amountIn),
    u64(fields.minimumOut),
    u64(fields.rateNumerator),
    u64(fields.rateDenominator),
    u64(fields.nonce),
    fields.evidenceDigest,
  ])).digest();
}

export function inspectLabEvidence(evidence, proposal, nowSeconds) {
  const reasons = [];
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
    return { ok: false, reasons: ["evidence missing"] };
  }
  if (evidence.schema !== "lab-fixed-rate-v1" || evidence.profile !== "DEVNET_LAB") {
    reasons.push("evidence is not a lab fixed-rate attestation");
  }
  if (evidence.assetId !== proposal.assetId || evidence.inputMint !== proposal.inputMint
      || evidence.outputMint !== proposal.outputMint) {
    reasons.push("evidence does not match the proposal");
  }
  if (evidence.rateNumerator !== proposal.rateNumerator || evidence.rateDenominator !== proposal.rateDenominator) {
    reasons.push("evidence rate does not match the proposal");
  }
  if (!Number.isSafeInteger(evidence.observedAt) || !Number.isSafeInteger(evidence.expiresAt)) {
    reasons.push("evidence timestamps are not safe integers");
  } else if (evidence.observedAt > nowSeconds || evidence.expiresAt <= nowSeconds
      || evidence.expiresAt <= evidence.observedAt
      || evidence.expiresAt - evidence.observedAt > MAX_EVIDENCE_WINDOW_SECONDS) {
    reasons.push("evidence expired, future-dated or outside the lab window");
  }
  return { ok: reasons.length === 0, reasons };
}
