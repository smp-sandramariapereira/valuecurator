/**
 * ProofGate Multi-Asset: independent off-chain, fail-closed policy evaluator.
 *
 * Stage 3 is REVIEW ONLY. It does not authenticate oracle attestations, create
 * owner approvals, sign transactions, consume quotas or enforce rules on-chain.
 * Stage 4 must revalidate the critical invariants inside the settlement program.
 */
import { createHash } from "node:crypto";

export type EvidenceMode = "DEVNET_LAB" | "PRICE_PROTECTED";
export type PriceSource = "SYNTHETIC_TEST" | "AUTHENTICATED_ORACLE";

export type PolicyAsset = Readonly<{
  assetId: string;
  mint: string;
  maxPerTrade: string;
  maxDailyInput: string;
}>;

export type MultiAssetMandate = Readonly<{
  schemaVersion: 1;
  mandateId: string;
  owner: string;
  network: "devnet";
  evidenceMode: EvidenceMode;
  oracleRequired: boolean;
  inputMint: string;
  allowedAssets: readonly PolicyAsset[];
  maxPortfolioTrade: string;
  maxPortfolioDailyInput: string;
  maxSlippageBps: number;
  maxEvidenceAgeMs: number;
  expiresAtMs: number;
}>;

export type ProposedTrade = Readonly<{
  assetId: string;
  outputMint: string;
  inputMint: string;
  amountIn: string;
  minAmountOut: string;
}>;

export type PriceEvidence = Readonly<{
  source: PriceSource;
  network: "devnet";
  assetId: string;
  inputMint: string;
  outputMint: string;
  amountIn: string;
  expectedAmountOut: string;
  observedAtMs: number;
  expiresAtMs: number;
  // Authentication of an oracle report must be implemented in a trusted
  // adapter and eventually verified at the on-chain trust boundary.
}>;

export type RegistryRecord = Readonly<{
  assetId: string;
  status: string;
  devnetMint: string | null;
}>;

export type RiskSnapshot = Readonly<{
  // Advisory snapshot only: no persistent counters are changed by this module.
  dailyInputByAsset: Readonly<Record<string, string>>;
  dailyInputTotal: string;
}>;

export type ResearchSummary = Readonly<{
  schema_version: string;
  mode: string;
  dataset: { id: string; revision: string; snapshot_sha256: string };
  experiment: { model_sha256: string };
  per_asset: readonly { asset_id: string; proposed_action: string; authorized: boolean }[];
  execution: { allowed: boolean };
}>;

export type GateDecision = Readonly<{
  schemaVersion: 1;
  status: "REVIEWABLE" | "BLOCKED";
  executionEnabled: false;
  mode: "OFF_CHAIN_REVIEW_ONLY";
  mandateId: string;
  assetId: string;
  evidenceDigest: string;
  researchDigest: string | null;
  proposalDigest: string;
  reasons: readonly string[];
}>;

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") {
    if (typeof value === "number" && !Number.isFinite(value)) throw new Error("Non-finite JSON value");
    if (value === undefined) throw new Error("Undefined cannot be hashed");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  const obj = value as Record<string, unknown>;
  return "{" + Object.keys(obj).sort().map((key) => JSON.stringify(key) + ":" + canonical(obj[key])).join(",") + "}";
}

export function contentDigest(value: unknown): string {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

function unsigned(value: unknown): bigint | null {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]*)$/.test(value)) return null;
  try { return BigInt(value); } catch { return null; }
}
function validMs(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
function unique(reasons: string[]): readonly string[] { return [...new Set(reasons)]; }
function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

/**
 * Explicitly quarantine Research Lab output: a research report can be linked
 * to a decision for audit, but it can never be a trading authorization.
 * The report hash is calculated over the received object. Future ingestion
 * must compare it to a signed/pinned manifest from a trusted storage layer.
 */
export function parseResearchSummary(value: unknown, assetId: string): { digest: string; reasons: readonly string[] } {
  const reasons: string[] = [];
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { digest: contentDigest({ invalid: true }), reasons: ["invalid research report"] };
  }
  const data = value as Partial<ResearchSummary>;
  if (data.schema_version !== "research-relevance-v1" || data.mode !== "RESEARCH_ONLY" ||
      data.execution?.allowed !== false) reasons.push("research report mode or execution flag invalid");
  if (!data.dataset || typeof data.dataset.id !== "string" || !data.dataset.id.trim() ||
      typeof data.dataset.revision !== "string" || !data.dataset.revision.trim() ||
      !isSha256(data.dataset.snapshot_sha256) ||
      !isSha256(data.experiment?.model_sha256)) reasons.push("research dataset or model provenance missing");
  if (!Array.isArray(data.per_asset) ||
      !data.per_asset.some((item) => item.asset_id === assetId) ||
      data.per_asset.some((item) => item.proposed_action !== "NONE" || item.authorized !== false)) {
    reasons.push("research output cannot authorize assets or trades");
  }
  return { digest: contentDigest(value), reasons: unique(reasons) };
}

export function evaluateMultiAssetProposal(input: {
  mandate: MultiAssetMandate;
  proposal: ProposedTrade;
  evidence: PriceEvidence;
  registry: readonly RegistryRecord[];
  risk: RiskSnapshot;
  nowMs: number;
  research?: unknown;
}): GateDecision {
  const { mandate: m, proposal: p, evidence: e, registry, risk, nowMs } = input;
  const reasons: string[] = [];

  if (m.schemaVersion !== 1 || m.network !== "devnet" || !m.owner ||
      !m.mandateId || !validMs(m.expiresAtMs)) reasons.push("invalid Devnet mandate");
  if (!validMs(nowMs) || nowMs > m.expiresAtMs) reasons.push("mandate expired");
  if (m.evidenceMode !== "DEVNET_LAB" && m.evidenceMode !== "PRICE_PROTECTED") reasons.push("invalid evidence mode");
  if (typeof m.oracleRequired !== "boolean" ||
      (m.evidenceMode === "PRICE_PROTECTED" && m.oracleRequired !== true)) {
    reasons.push("protected mandate must require an authenticated oracle");
  }
  if (!Number.isInteger(m.maxSlippageBps) || m.maxSlippageBps < 0 || m.maxSlippageBps > 10_000 ||
      !Number.isSafeInteger(m.maxEvidenceAgeMs) || m.maxEvidenceAgeMs < 1) reasons.push("invalid risk thresholds");
  if (!Array.isArray(m.allowedAssets) || new Set(m.allowedAssets.map((a) => a.assetId)).size !== m.allowedAssets.length) {
    reasons.push("invalid or duplicate asset allowances");
  }
  const allowance = m.allowedAssets?.find((a) => a.assetId === p.assetId);
  if (!allowance) reasons.push("asset is not in owner mandate");
  if (!p.assetId || !p.outputMint || !p.inputMint ||
      p.inputMint !== m.inputMint || p.outputMint === p.inputMint ||
      (allowance && p.outputMint !== allowance.mint)) reasons.push("proposal mint/identity mismatch");

  const matching = registry.filter((asset) => asset.assetId === p.assetId);
  if (matching.length !== 1 || matching[0].status !== "VERIFIED" ||
      matching[0].devnetMint !== p.outputMint) reasons.push("asset has no verified Devnet settlement mapping");

  const amount = unsigned(p.amountIn);
  const minimum = unsigned(p.minAmountOut);
  const expected = unsigned(e.expectedAmountOut);
  const maxPerTrade = allowance ? unsigned(allowance.maxPerTrade) : null;
  const maxDaily = allowance ? unsigned(allowance.maxDailyInput) : null;
  const portfolioTrade = unsigned(m.maxPortfolioTrade);
  const portfolioDaily = unsigned(m.maxPortfolioDailyInput);
  const spentAsset = unsigned(risk.dailyInputByAsset?.[p.assetId] ?? "0");
  const spentTotal = unsigned(risk.dailyInputTotal);
  if (amount === null || amount <= 0n || minimum === null || minimum <= 0n ||
      expected === null || expected <= 0n || maxPerTrade === null || maxPerTrade <= 0n ||
      maxDaily === null || maxDaily <= 0n || portfolioTrade === null || portfolioTrade <= 0n ||
      portfolioDaily === null || portfolioDaily <= 0n || spentAsset === null || spentTotal === null) {
    reasons.push("invalid integer amounts or risk snapshot");
  } else {
    if (amount > maxPerTrade || amount > portfolioTrade) reasons.push("trade exceeds risk limits");
    if (spentAsset + amount > maxDaily || spentTotal + amount > portfolioDaily) reasons.push("daily exposure exceeded");
    if (typeof m.maxSlippageBps === "number" && Number.isInteger(m.maxSlippageBps) &&
        m.maxSlippageBps >= 0 && m.maxSlippageBps <= 10_000 &&
        minimum * 10_000n < expected * BigInt(10_000 - m.maxSlippageBps)) {
      reasons.push("minimum output permits excessive slippage");
    }
    if (minimum > expected) reasons.push("minimum output exceeds quoted output");
  }

  if (e.network !== "devnet" || e.assetId !== p.assetId ||
      e.inputMint !== p.inputMint || e.outputMint !== p.outputMint ||
      e.amountIn !== p.amountIn) reasons.push("quote does not match the exact Devnet proposal");
  if (!validMs(e.observedAtMs) || !validMs(e.expiresAtMs) ||
      !validMs(nowMs) || e.observedAtMs > nowMs || e.expiresAtMs <= nowMs ||
      e.expiresAtMs <= e.observedAtMs ||
      !Number.isSafeInteger(m.maxEvidenceAgeMs) || nowMs - e.observedAtMs > m.maxEvidenceAgeMs) {
    reasons.push("quote missing, stale, future-dated or expired");
  }
  if (e.source !== "SYNTHETIC_TEST" && e.source !== "AUTHENTICATED_ORACLE") reasons.push("unsupported price source");
  if (m.evidenceMode === "DEVNET_LAB" && e.source === "SYNTHETIC_TEST" && m.oracleRequired === true) {
    reasons.push("oracle is mandatory for this mandate");
  }
  // No authenticated-oracle adapter exists at Stage 3; fail closed rather than
  // believing an untrusted string that says AUTHENTICATED_ORACLE.
  if (e.source === "AUTHENTICATED_ORACLE") reasons.push("authenticated oracle attestation verifier is not implemented");
  if (m.evidenceMode === "PRICE_PROTECTED" && e.source !== "AUTHENTICATED_ORACLE") {
    reasons.push("protected mode requires authenticated oracle evidence");
  }

  let researchDigest: string | null = null;
  if (input.research !== undefined) {
    const research = parseResearchSummary(input.research, p.assetId);
    researchDigest = research.digest;
    reasons.push(...research.reasons);
  }
  return {
    schemaVersion: 1, status: reasons.length ? "BLOCKED" : "REVIEWABLE",
    executionEnabled: false, mode: "OFF_CHAIN_REVIEW_ONLY",
    mandateId: m.mandateId, assetId: p.assetId,
    evidenceDigest: contentDigest(e), researchDigest,
    proposalDigest: contentDigest({ mandate: m, proposal: p, evidence: e, researchDigest }),
    reasons: unique(reasons),
  };
}
