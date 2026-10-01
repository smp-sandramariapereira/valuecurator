export type ReportScenario = "live" | "safe" | "stale" | "divergent";

export type ReportEvidence = {
  source: "fixture" | "pyth-pro";
  simulated: boolean;
  generatedAt: string;
  symbol: string;
  mint?: string | null;
  marketNetwork?: "mainnet-beta" | null;
  executableSource?: "jupiter" | null;
  quoteInputMint?: string | null;
  quoteInputAmount?: string | null;
  quoteInputDecimals?: number | null;
  quoteExpectedOutputAmount?: string | null;
  quoteMinimumOutputAmount?: string | null;
  quoteOutputDecimals?: number | null;
  multiplierNano?: string | null;
  priceImpactBps?: number | null;
  routeHops?: number | null;
  referenceFeedId: string;
  referencePriceMicros: string;
  executablePriceMicros: string | null;
  confidenceMicros?: string;
  publishTimeMs?: number;
  priceAgeMs: number;
  deviationBps: number | null;
  confidenceBps: number;
  maximumPriceAgeMs: number;
  maximumDeviationBps: number;
  maximumConfidenceBps: number;
  maximumPriceImpactBps?: number;
  calculationPolicyVersion?: string;
  calculations?: readonly unknown[];
  decision: "APPROVED" | "BLOCKED";
  reasons: readonly string[];
  transactionSubmitted: boolean;
};

export type ReportProposal = {
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

export type ReportApprovalReceipt = {
  kind: "KAIROS_PROPOSAL_APPROVAL";
  proposalId: string;
  evidenceDigest: string;
  signer: string;
  signatureHex: string;
  signedAt: string;
  transactionSubmitted: false;
};

const SIMULATION_NOT_SIGNABLE_REASON = "only live Pyth Pro evidence can create an approval proposal";
const SIMULATION_EXPIRY_REASON = "market evidence expired before proposal creation";

/** Policy failures stay on the evidence reasons. Simulation-only proposal reasons stay off that list. */
export function visiblePolicyReasons(input: {
  evidenceDecision: "APPROVED" | "BLOCKED";
  evidenceReasons: readonly string[];
  proposalReasons: readonly string[];
}): readonly string[] {
  if (input.evidenceDecision === "BLOCKED") return input.evidenceReasons;
  return input.proposalReasons;
}

export function approvedSimulationIsNotSignable(input: {
  simulated: boolean;
  decision: "APPROVED" | "BLOCKED";
  proposalStatus: "READY_FOR_APPROVAL" | "BLOCKED";
  proposalReasons: readonly string[];
}): boolean {
  return input.simulated
    && input.decision === "APPROVED"
    && input.proposalStatus === "BLOCKED"
    && input.proposalReasons.includes(SIMULATION_NOT_SIGNABLE_REASON)
    && input.proposalReasons.every((reason) =>
      reason === SIMULATION_NOT_SIGNABLE_REASON || reason === SIMULATION_EXPIRY_REASON);
}

export type FinalExecutionReport = ReturnType<typeof createFinalExecutionReport>;

export function createFinalExecutionReport(options: {
  scenario: ReportScenario;
  evidence: ReportEvidence;
  proposal: ReportProposal;
  receipt?: ReportApprovalReceipt | null;
  nowMs?: number;
}) {
  const { scenario, evidence, proposal } = options;
  const receipt = options.receipt ?? null;
  const nowMs = options.nowMs ?? Date.now();
  const expired = nowMs > Date.parse(proposal.validUntil);
  const simulationNotSignable = approvedSimulationIsNotSignable({
    simulated: evidence.simulated,
    decision: evidence.decision,
    proposalStatus: proposal.status,
    proposalReasons: proposal.reasons,
  });
  const operationStatus = receipt
    ? "AUTHORIZED_NOT_SUBMITTED" as const
    : simulationNotSignable
      ? "SIMULATION_NOT_SIGNABLE" as const
      : proposal.status === "BLOCKED"
        ? "BLOCKED" as const
        : expired
          ? "EXPIRED" as const
          : "AWAITING_APPROVAL" as const;
  const statement = operationStatus === "AUTHORIZED_NOT_SUBMITTED"
    ? "Operation authorized by signature, but not submitted."
    : operationStatus === "SIMULATION_NOT_SIGNABLE"
      ? "Simulation approved by policy. The proposal cannot be signed and no transaction was submitted."
      : operationStatus === "BLOCKED"
        ? "Operation blocked; no transaction was constructed or submitted."
        : operationStatus === "EXPIRED"
          ? "Proposal expired; no transaction was constructed or submitted."
          : "Proposal ready for approval; no transaction was constructed or submitted.";
  const reasons = [...new Set([...evidence.reasons, ...proposal.reasons])];

  return {
    schemaVersion: 1 as const,
    kind: "KAIROS_FINAL_EXECUTION_REPORT" as const,
    generatedAt: new Date(nowMs).toISOString(),
    operationStatus,
    statement,
    disclosure: {
      scenario,
      simulated: evidence.simulated,
      evidenceSource: evidence.source,
      executionMode: proposal.executionMode,
      executionEnabled: proposal.executionEnabled,
    },
    asset: {
      symbol: evidence.symbol,
      mint: evidence.mint ?? proposal.mint,
      marketNetwork: evidence.marketNetwork ?? proposal.marketNetwork,
      programNetwork: proposal.programNetwork,
    },
    mandate: {
      referenceFeedId: proposal.referenceFeedId,
      maximumPriceAgeMs: proposal.mandate.maximumPriceAgeMs,
      maximumConfidenceBps: proposal.mandate.maximumConfidenceBps,
      maximumDeviationBps: proposal.mandate.maximumDeviationBps,
      maximumPriceImpactBps: evidence.maximumPriceImpactBps ?? null,
      inputMint: proposal.inputMint,
      maximumInputAmountForProposal: proposal.inputAmount,
      minimumOutputAmount: proposal.minimumOutputAmount,
      validUntil: proposal.validUntil,
    },
    marketEvidence: {
      generatedAt: evidence.generatedAt,
      provider: evidence.source === "pyth-pro" ? "Pyth Pro" : "fixture",
      reference: {
        feedId: evidence.referenceFeedId,
        priceMicros: evidence.referencePriceMicros,
        confidenceMicros: evidence.confidenceMicros ?? null,
        confidenceBps: evidence.confidenceBps,
        publishTimeMs: evidence.publishTimeMs ?? null,
        ageMs: evidence.priceAgeMs,
      },
      executableQuote: {
        provider: evidence.executableSource ?? null,
        priceMicros: evidence.executablePriceMicros,
        inputMint: evidence.quoteInputMint ?? null,
        inputAmount: evidence.quoteInputAmount ?? null,
        inputDecimals: evidence.quoteInputDecimals ?? null,
        expectedOutputAmount: evidence.quoteExpectedOutputAmount ?? null,
        minimumOutputAmount: evidence.quoteMinimumOutputAmount ?? null,
        outputDecimals: evidence.quoteOutputDecimals ?? null,
        multiplierNano: evidence.multiplierNano ?? null,
        priceImpactBps: evidence.priceImpactBps ?? null,
        routeHops: evidence.routeHops ?? null,
      },
      deviationBps: evidence.deviationBps,
      calculationPolicyVersion: evidence.calculationPolicyVersion ?? null,
      calculations: evidence.calculations ?? [],
    },
    decision: {
      market: evidence.decision,
      proposal: proposal.status,
      reasons,
      executionBlockers: proposal.executionBlockers,
    },
    authorization: {
      requiredApprover: proposal.requiredApprover,
      status: receipt ? "SIGNED" as const : "NOT_SIGNED" as const,
      signer: receipt?.signer ?? null,
      signedAt: receipt?.signedAt ?? null,
      receipt,
    },
    stateTransition: {
      before: {
        proposalId: proposal.proposalId,
        evidenceDigest: proposal.evidenceDigest,
        proposedInputAmount: proposal.inputAmount,
        proposedMinimumOutputAmount: proposal.minimumOutputAmount,
        transactionConstructed: false as const,
      },
      after: {
        transactionConstructed: false as const,
        transactionSubmitted: false as const,
        transactionSignature: null,
        dailyQuotaConsumed: false as const,
        portfolioChangedByKairos: false as const,
      },
    },
    integrity: {
      proposalId: proposal.proposalId,
      evidenceDigest: proposal.evidenceDigest,
      receiptMatchesProposal: receipt
        ? receipt.proposalId === proposal.proposalId && receipt.evidenceDigest === proposal.evidenceDigest
        : null,
    },
  };
}
