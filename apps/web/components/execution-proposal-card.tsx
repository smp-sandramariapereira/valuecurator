"use client";

import { Clock3, Download, ShieldCheck } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useMarketRefresh,
  type ApprovalReceipt,
  type ExecutionProposal,
} from "@/components/market-refresh-provider";
import { approvedSimulationIsNotSignable } from "@/agent/src/final-report";
import { formatCountdown, formatTokenAmount, translateMarketReason } from "@/lib/market-format";

function canonicalize(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) =>
    `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(",")}}`;
}

async function sha256(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalize(value));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (item) => item.toString(16).padStart(2, "0")).join("");
}

function approvalMessage(proposal: ExecutionProposal): Uint8Array {
  return new TextEncoder().encode([
    "KAIROS EXECUTION PROPOSAL APPROVAL",
    `proposalId=${proposal.proposalId}`,
    `evidenceDigest=${proposal.evidenceDigest}`,
    `validUntil=${proposal.validUntil}`,
    `mode=${proposal.executionMode}`,
    "transactionSubmitted=false",
  ].join("\n"));
}

function short(value: string): string {
  return value.length > 18 ? `${value.slice(0, 8)}…${value.slice(-8)}` : value;
}

function downloadReceipt(receipt: ApprovalReceipt): void {
  const url = URL.createObjectURL(new Blob([`${JSON.stringify(receipt, null, 2)}\n`], {
    type: "application/json",
  }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `kairos-approval-${receipt.proposalId.slice(0, 12)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ExecutionProposalCard() {
  const { connected, publicKey, signMessage } = useWallet();
  const { proposal, evidence, history, recordApprovalReceipt } = useMarketRefresh();
  const [integrity, setIntegrity] = useState<"loading" | "valid" | "invalid">("loading");
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ApprovalReceipt | null>(null);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const storedReceipt = useMemo(() => proposal
    ? history.find((entry) => entry.proposal.proposalId === proposal.proposalId)?.receipt ?? null
    : null, [history, proposal]);

  useEffect(() => {
    let cancelled = false;
    async function verify() {
      if (!proposal || !evidence) {
        setIntegrity("loading");
        return;
      }
      try {
        const { proposalId, ...proposalBody } = proposal;
        const valid = await sha256(proposalBody) === proposalId &&
          await sha256(evidence) === proposal.evidenceDigest;
        if (!cancelled) {
          setIntegrity(valid ? "valid" : "invalid");
          setReceipt(storedReceipt);
          setError(null);
        }
      } catch {
        if (!cancelled) setIntegrity("invalid");
      }
    }
    void verify();
    return () => {
      cancelled = true;
    };
  }, [evidence, proposal, storedReceipt]);

  useEffect(() => {
    setNowMs(Date.now());
    const timer = window.setInterval(() => setNowMs(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const expiresAtMs = proposal ? Date.parse(proposal.validUntil) : 0;
  const expired = proposal && nowMs !== null ? nowMs > expiresAtMs : false;
  const remainingMs = proposal && nowMs !== null ? Math.max(0, expiresAtMs - nowMs) : null;
  const wrongApprover = Boolean(
    proposal?.requiredApprover && publicKey && proposal.requiredApprover !== publicKey.toBase58(),
  );
  const simulationNotSignable = Boolean(
    proposal && evidence && approvedSimulationIsNotSignable({
      simulated: evidence.simulated,
      decision: evidence.decision,
      proposalStatus: proposal.status,
      proposalReasons: proposal.reasons,
    }),
  );
  const policyBlocked = Boolean(proposal && proposal.status === "BLOCKED" && !simulationNotSignable);
  const priceIsStale = Boolean(
    proposal?.reasons.includes("market observation is stale")
    || evidence?.reasons.includes("market observation is stale"),
  );
  const visibleReasons = policyBlocked && priceIsStale
    ? (proposal?.reasons ?? []).filter((reason) => reason === "market observation is stale")
    : (proposal?.reasons ?? []);
  const canApprove = Boolean(
    proposal && nowMs !== null && proposal.status === "READY_FOR_APPROVAL" && integrity === "valid" && !expired &&
    connected && publicKey && signMessage && !wrongApprover && !signing,
  );
  const buttonReason = useMemo(() => {
    if (!proposal) return "Generate the proposal in the agent first";
    if (nowMs === null) return "Validating proposal expiry…";
    if (integrity === "invalid") return "Tampered or invalid proposal";
    if (simulationNotSignable) return "This simulation cannot be signed. No transaction is submitted.";
    if (policyBlocked && priceIsStale) return "Policy blocked this proposal because the price is stale. No transaction is submitted.";
    if (proposal.status === "BLOCKED") return "Policy blocked this proposal";
    if (expired) return "Evidence expired; generate a new proposal";
    if (!connected || !publicKey) return "Connect the authorized wallet";
    if (wrongApprover) return "The connected wallet is not the authorized owner";
    if (!signMessage) return "This wallet does not support message signing";
    return "Sign an auditable authorization; no transaction will be submitted";
  }, [connected, expired, integrity, nowMs, policyBlocked, priceIsStale, proposal, publicKey, signMessage, simulationNotSignable, wrongApprover]);

  async function approve() {
    if (!proposal || !publicKey || !signMessage || !canApprove) return;
    setSigning(true);
    setError(null);
    try {
      const signature = await signMessage(approvalMessage(proposal));
      const nextReceipt: ApprovalReceipt = {
        schemaVersion: 1,
        kind: "KAIROS_PROPOSAL_APPROVAL",
        proposalId: proposal.proposalId,
        evidenceDigest: proposal.evidenceDigest,
        signer: publicKey.toBase58(),
        signatureHex: Array.from(signature, (item) => item.toString(16).padStart(2, "0")).join(""),
        signedAt: new Date().toISOString(),
        executionMode: "APPROVAL_ONLY",
        transactionSubmitted: false,
      };
      setReceipt(nextReceipt);
      recordApprovalReceipt(nextReceipt);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSigning(false);
    }
  }

  return (
    <Card className={
      integrity === "invalid" || (proposal?.status === "BLOCKED" && !simulationNotSignable)
        ? "border-red-900/60"
        : simulationNotSignable
          ? "border-amber-500/40"
          : undefined
    }>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-stocklana-purple" /> Execution proposal
          </CardTitle>
          <Badge className="border-amber-500/60 text-amber-300">APPROVAL ONLY</Badge>
        </div>
        <CardDescription>
          Binds evidence to the mandate and collects explicit approval. This phase does not construct or submit transactions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!proposal ? (
          <div className="space-y-3 text-sm leading-6 text-stocklana-muted">
            <p>The prices above are a simulation preview. Choose a path to see the proposal.</p>
            <p><span className="font-medium text-red-300">Block</span> stops the proposal when the price is stale or the divergence is too high.</p>
            <p><span className="font-medium text-amber-200">Safe</span> approves the simulation. The proposal stays unsigned.</p>
            <p>No transaction is submitted on either path.</p>
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div><p className="text-xs uppercase tracking-wider text-stocklana-muted">Asset</p><p className="font-mono text-white">{proposal.symbol}</p></div>
              <div>
                <p className="text-xs uppercase tracking-wider text-stocklana-muted">Status</p>
                <p className={
                  simulationNotSignable
                    ? "font-mono text-amber-300"
                    : proposal.status === "READY_FOR_APPROVAL" && !expired
                      ? "font-mono text-stocklana-accent"
                      : "font-mono text-red-400"
                }>
                  {simulationNotSignable ? "NOT SIGNABLE" : policyBlocked ? "BLOCKED" : expired ? "EXPIRED" : proposal.status}
                </p>
              </div>
              <div><p className="text-xs uppercase tracking-wider text-stocklana-muted">Integrity</p><p className={integrity === "valid" ? "font-mono text-stocklana-accent" : "font-mono text-red-400"}>{integrity.toUpperCase()}</p></div>
              <div><p className="text-xs uppercase tracking-wider text-stocklana-muted">Networks</p><p className="font-mono text-white">market {proposal.marketNetwork} · program {proposal.programNetwork}</p></div>
            </div>
            <div className="space-y-1 break-all font-mono text-xs text-stocklana-muted">
              <p>proposal {short(proposal.proposalId)} · evidence {short(proposal.evidenceDigest)}</p>
              <p>
                input {formatTokenAmount(proposal.inputAmount, evidence?.quoteInputDecimals, "USDC")} ·
                minimum {formatTokenAmount(proposal.minimumOutputAmount, evidence?.quoteOutputDecimals, proposal.symbol)}
              </p>
              <p>owner {proposal.requiredApprover ?? "not configured"} · valid until {proposal.validUntil}</p>
            </div>
            {simulationNotSignable ? (
              <div className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 font-mono text-sm text-amber-200">
                <Clock3 className="h-4 w-4" />
                Policy approved this simulation. Signing stays disabled.
              </div>
            ) : policyBlocked && priceIsStale ? (
              <div className="flex items-center gap-2 rounded-md border border-red-900/60 bg-red-950/20 p-3 font-mono text-sm text-red-300">
                <Clock3 className="h-4 w-4" />
                Market price is stale. The mandate blocks this proposal. No transaction is submitted.
              </div>
            ) : (
              <div className={expired
                ? "flex items-center gap-2 rounded-md border border-red-900/60 bg-red-950/20 p-3 font-mono text-sm text-red-300"
                : "flex items-center gap-2 rounded-md border border-stocklana-accent/30 bg-stocklana-accent/5 p-3 font-mono text-sm text-stocklana-accent"}>
                <Clock3 className="h-4 w-4" />
                {remainingMs === null ? "Calculating validity…" : expired
                  ? "Proposal expired — refresh the market"
                  : `Expires in ${formatCountdown(remainingMs)}`}
              </div>
            )}
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs leading-5 text-amber-200">
              {proposal.executionBlockers.map(translateMarketReason).join(" · ")}
            </div>
            {visibleReasons.length ? (
              <p className={simulationNotSignable ? "text-xs text-amber-200" : "text-xs text-red-400"}>
                {visibleReasons.map(translateMarketReason).join(" · ")}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" onClick={() => void approve()} disabled={!canApprove} title={!canApprove ? buttonReason : undefined}>
                {signing ? "Signing…" : "Sign approval"}
              </Button>
              {receipt ? (
                <Button type="button" variant="outline" onClick={() => downloadReceipt(receipt)}>
                  <Download className="h-4 w-4" /> Download receipt
                </Button>
              ) : null}
              <p className="text-xs text-stocklana-muted">{receipt ? "Approval signed; transaction submitted: no." : buttonReason}</p>
            </div>
            {receipt ? (
              <section className="rounded-md border border-stocklana-accent/30 bg-stocklana-accent/5 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-stocklana-accent">Signed approval receipt</p>
                  <Badge className="border-stocklana-accent/30 text-stocklana-accent">NO ON-CHAIN SUBMISSION</Badge>
                </div>
                <div className="mt-3 grid gap-2 break-all font-mono text-xs text-stocklana-muted sm:grid-cols-2">
                  <p>signer {receipt.signer}</p>
                  <p>signed {new Date(receipt.signedAt).toLocaleString("en-US")}</p>
                  <p>signature {short(receipt.signatureHex)}</p>
                  <p>transaction submitted: no</p>
                </div>
              </section>
            ) : null}
            {error ? <p className="text-xs text-red-400">Signature not completed: {error}</p> : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
