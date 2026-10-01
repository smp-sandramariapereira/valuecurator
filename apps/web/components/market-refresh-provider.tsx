"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { applyGatePolicy, type GatePolicyLimits } from "@/lib/gate-policy";
import type { MandateDraft } from "@/lib/mandate-builder";

export type CalculationTrace = {
  id: string;
  label: string;
  formula: string;
  operands: Readonly<Record<string, string | null>>;
  result: { value: string | null; unit: "ms" | "bps" };
  threshold: { operator: "<="; value: string; unit: "ms" | "bps" } | null;
  passed: boolean | null;
};

export type MarketEvidence = {
  source: "fixture" | "pyth-pro";
  simulated: boolean;
  simulationScenario?: "safe" | "stale" | "divergent";
  transactionSubmitted: boolean;
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
  calculations?: readonly CalculationTrace[];
  decision: "APPROVED" | "BLOCKED";
  reasons: readonly string[];
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

export type DecisionHistoryEntry = {
  schemaVersion: 1;
  recordedAt: string;
  scenario: MarketScenario;
  evidence: MarketEvidence;
  proposal: ExecutionProposal;
  receipt: ApprovalReceipt | null;
  transactionSubmitted: false;
};

type RefreshStatus = "loading" | "ready" | "refreshing" | "error";
export type MarketScenario = "live" | "safe" | "stale" | "divergent";

type MarketRefreshContextValue = {
  evidence: MarketEvidence | null;
  proposal: ExecutionProposal | null;
  status: RefreshStatus;
  error: string | null;
  activeScenario: MarketScenario | null;
  pendingScenario: MarketScenario | null;
  history: readonly DecisionHistoryEntry[];
  policyLimits: GatePolicyLimits;
  refresh: (scenario?: MarketScenario) => Promise<void>;
  recordApprovalReceipt: (receipt: ApprovalReceipt) => void;
};

const MarketRefreshContext = createContext<MarketRefreshContextValue | null>(null);
const HISTORY_STORAGE_KEY = "kairos.decision-history.v1";
const MAX_HISTORY_ENTRIES = 40;

function validHistoryEntry(value: unknown): value is DecisionHistoryEntry {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entry = value as Partial<DecisionHistoryEntry> & {
    evidence?: Partial<MarketEvidence>;
    proposal?: Partial<ExecutionProposal>;
    receipt?: Partial<ApprovalReceipt> | null;
  };
  const validScenario = entry.scenario === "live" || entry.scenario === "safe" ||
    entry.scenario === "stale" || entry.scenario === "divergent";
  const validEvidence = Boolean(entry.evidence) &&
    (entry.evidence?.decision === "APPROVED" || entry.evidence?.decision === "BLOCKED") &&
    typeof entry.evidence?.referenceFeedId === "string" && Array.isArray(entry.evidence?.reasons);
  const validProposal = Boolean(entry.proposal) && typeof entry.proposal?.proposalId === "string" &&
    typeof entry.proposal?.evidenceDigest === "string" && typeof entry.proposal?.validUntil === "string" &&
    (entry.proposal?.status === "READY_FOR_APPROVAL" || entry.proposal?.status === "BLOCKED") &&
    Array.isArray(entry.proposal?.reasons);
  const validReceipt = entry.receipt === null || entry.receipt === undefined ||
    (entry.receipt.kind === "KAIROS_PROPOSAL_APPROVAL" &&
      typeof entry.receipt.signer === "string" && typeof entry.receipt.signatureHex === "string");
  return entry.schemaVersion === 1 && typeof entry.recordedAt === "string" &&
    validScenario && validEvidence && validProposal && validReceipt && entry.transactionSubmitted === false;
}

function persistHistory(history: readonly DecisionHistoryEntry[]): void {
  try {
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  } catch {
    // The dashboard remains usable when storage is disabled or full.
  }
}

function policyFromDraft(draft: MandateDraft): GatePolicyLimits {
  return {
    maximumPriceAgeMs: Math.round(draft.maximumPriceAgeSeconds * 1_000),
    maximumConfidenceBps: draft.maximumConfidenceBps,
    maximumDeviationBps: draft.maximumDeviationBps,
    maximumPriceImpactBps: draft.maximumSlippageBps,
  };
}

export function MarketRefreshProvider({
  children,
  mandate,
}: {
  children: ReactNode;
  mandate: MandateDraft;
}) {
  const [evidence, setEvidence] = useState<MarketEvidence | null>(null);
  const [proposal, setProposal] = useState<ExecutionProposal | null>(null);
  const [status, setStatus] = useState<RefreshStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [activeScenario, setActiveScenario] = useState<MarketScenario | null>(null);
  const [pendingScenario, setPendingScenario] = useState<MarketScenario | null>(null);
  const [history, setHistory] = useState<DecisionHistoryEntry[]>([]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(HISTORY_STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as unknown;
      if (!Array.isArray(parsed)) return;
      setHistory(parsed.filter(validHistoryEntry).slice(0, MAX_HISTORY_ENTRIES));
    } catch {
      // Ignore malformed or unavailable browser storage.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadPublishedReports() {
      try {
        const evidenceResponse = await fetch("/market-evidence.json", { cache: "no-store" });
        if (!evidenceResponse.ok) throw new Error("Published evidence unavailable.");
        const nextEvidence = await evidenceResponse.json() as MarketEvidence;
        if (!cancelled) {
          setEvidence(nextEvidence);
          setProposal(null);
          setActiveScenario(null);
          setStatus("ready");
        }
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : String(cause));
          setStatus("error");
        }
      }
    }
    void loadPublishedReports();
    return () => {
      cancelled = true;
    };
  }, []);

  const recordDecision = useCallback((
    scenario: MarketScenario,
    evidence: MarketEvidence,
    proposal: ExecutionProposal,
  ) => {
    setHistory((current) => {
      const previous = current.find((entry) => entry.proposal.proposalId === proposal.proposalId);
      const entry: DecisionHistoryEntry = {
        schemaVersion: 1,
        recordedAt: new Date().toISOString(),
        scenario,
        evidence,
        proposal,
        receipt: previous?.receipt ?? null,
        transactionSubmitted: false,
      };
      const next = [entry, ...current.filter((item) =>
        item.proposal.proposalId !== proposal.proposalId)].slice(0, MAX_HISTORY_ENTRIES);
      persistHistory(next);
      return next;
    });
  }, []);

  const recordApprovalReceipt = useCallback((receipt: ApprovalReceipt) => {
    setHistory((current) => {
      const next = current.map((entry) => entry.proposal.proposalId === receipt.proposalId &&
        entry.proposal.evidenceDigest === receipt.evidenceDigest
        ? { ...entry, receipt }
        : entry);
      persistHistory(next);
      return next;
    });
  }, []);

  const policyLimits = useMemo(() => policyFromDraft(mandate), [
    mandate.maximumPriceAgeSeconds,
    mandate.maximumConfidenceBps,
    mandate.maximumDeviationBps,
    mandate.maximumSlippageBps,
  ]);
  const policyLimitsRef = useRef(policyLimits);
  policyLimitsRef.current = policyLimits;

  const refresh = useCallback(async (scenario: MarketScenario = "live") => {
    setStatus("refreshing");
    setPendingScenario(scenario);
    setError(null);
    try {
      const response = await fetch("/api/market/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario, mandate: policyLimitsRef.current }),
        cache: "no-store",
      });
      const body = await response.json() as {
        evidence?: MarketEvidence;
        proposal?: ExecutionProposal;
        scenario?: MarketScenario;
        error?: string;
      };
      if (!response.ok || !body.evidence || !body.proposal) {
        throw new Error(body.error || `Refresh failed (${response.status}).`);
      }
      setEvidence(body.evidence);
      setProposal(body.proposal);
      setActiveScenario(body.scenario ?? scenario);
      recordDecision(body.scenario ?? scenario, body.evidence, body.proposal);
      setStatus("ready");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setStatus("error");
    } finally {
      setPendingScenario(null);
    }
  }, [recordDecision]);

  const visibleEvidence = useMemo(
    () => (evidence ? applyGatePolicy(evidence, policyLimits) : null),
    [evidence, policyLimits],
  );

  useEffect(() => {
    if (!activeScenario || !evidence) return;
    const aligned = evidence.maximumPriceAgeMs === policyLimits.maximumPriceAgeMs
      && evidence.maximumConfidenceBps === policyLimits.maximumConfidenceBps
      && evidence.maximumDeviationBps === policyLimits.maximumDeviationBps
      && (evidence.maximumPriceImpactBps ?? policyLimits.maximumPriceImpactBps) === policyLimits.maximumPriceImpactBps;
    if (aligned) return;
    const timer = window.setTimeout(() => {
      void refresh(activeScenario);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [activeScenario, evidence, policyLimits, refresh]);

  const value = useMemo(() => ({
    evidence: visibleEvidence,
    proposal,
    status,
    error,
    activeScenario,
    pendingScenario,
    history,
    policyLimits,
    refresh,
    recordApprovalReceipt,
  }), [
    visibleEvidence,
    proposal,
    status,
    error,
    activeScenario,
    pendingScenario,
    history,
    policyLimits,
    refresh,
    recordApprovalReceipt,
  ]);

  return <MarketRefreshContext.Provider value={value}>{children}</MarketRefreshContext.Provider>;
}

export function useMarketRefresh(): MarketRefreshContextValue {
  const value = useContext(MarketRefreshContext);
  if (!value) throw new Error("useMarketRefresh must be used within MarketRefreshProvider");
  return value;
}
