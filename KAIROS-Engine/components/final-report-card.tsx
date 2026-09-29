"use client";

import { useMemo, useState } from "react";
import { Code2, Download, ExternalLink, FileCheck2 } from "lucide-react";
import { createFinalExecutionReport } from "@/agent/src/final-report";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useMarketRefresh } from "@/components/market-refresh-provider";
import { formatAgeMs, formatTokenAmount, translateMarketReason } from "@/lib/market-format";

function usd(micros: string | null): string {
  if (micros === null) return "unavailable";
  const value = BigInt(micros);
  const whole = value / 1_000_000n;
  const fraction = (value % 1_000_000n).toString().padStart(6, "0");
  return `$${whole}.${fraction}`;
}

function short(value: string | null): string {
  if (!value) return "—";
  return value.length > 18 ? `${value.slice(0, 8)}…${value.slice(-8)}` : value;
}

function downloadJson(value: unknown, proposalId: string): void {
  const url = URL.createObjectURL(new Blob([`${JSON.stringify(value, null, 2)}\n`], {
    type: "application/json",
  }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `kairos-final-report-${proposalId.slice(0, 12)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function FinalReportCard() {
  const { evidence, proposal, activeScenario, history } = useMarketRefresh();
  const [showJson, setShowJson] = useState(false);
  const receipt = useMemo(() => proposal
    ? history.find((entry) => entry.proposal.proposalId === proposal.proposalId)?.receipt ?? null
    : null, [history, proposal]);
  const report = evidence && proposal
    ? createFinalExecutionReport({
        scenario: activeScenario ?? "live",
        evidence,
        proposal,
        receipt,
      })
    : null;

  const stateTone = report?.operationStatus === "AUTHORIZED_NOT_SUBMITTED"
    ? "border-stocklana-accent/40 text-stocklana-accent"
    : report?.operationStatus === "BLOCKED"
      ? "border-red-900/60 text-red-400"
      : "border-amber-500/60 text-amber-300";

  function exportReport(): void {
    if (!evidence || !proposal) return;
    downloadJson(createFinalExecutionReport({
      scenario: activeScenario ?? "live",
      evidence,
      proposal,
      receipt,
    }), proposal.proposalId);
  }

  return (
    <Card className={report?.operationStatus === "BLOCKED" ? "border-red-900/60" : undefined}>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <FileCheck2 className="h-4 w-4 text-stocklana-purple" /> Final report
          </CardTitle>
          {report ? <Badge className={stateTone}>{report.operationStatus}</Badge> : null}
        </div>
        <CardDescription>
          Consolidates mandate, evidence, decision, authorization and before/after state into an auditable JSON file.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!report || !proposal ? (
          <p className="font-mono text-xs text-stocklana-muted">
            Refresh the market or run a scenario to generate the report.
          </p>
        ) : (
          <div className="space-y-4">
            <div className={`rounded-md border p-3 text-sm ${stateTone}`}>
              {report.statement}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <section className="rounded-md border border-stocklana-border p-3">
                <p className="text-[10px] uppercase tracking-wider text-stocklana-muted">Mandate</p>
                <p className="mt-2 font-mono text-xs text-white">age ≤ {formatAgeMs(report.mandate.maximumPriceAgeMs)}</p>
                <p className="mt-1 font-mono text-xs text-white">confidence ≤ {report.mandate.maximumConfidenceBps} bps</p>
                <p className="mt-1 font-mono text-xs text-white">deviation ≤ {report.mandate.maximumDeviationBps} bps</p>
              </section>
              <section className="rounded-md border border-stocklana-border p-3">
                <p className="text-[10px] uppercase tracking-wider text-stocklana-muted">Pyth / reference</p>
                <p className="mt-2 font-mono text-xs text-white">feed {report.marketEvidence.reference.feedId}</p>
                <p className="mt-1 font-mono text-xs text-stocklana-accent">{usd(report.marketEvidence.reference.priceMicros)}</p>
                <p className="mt-1 font-mono text-xs text-white">age {formatAgeMs(report.marketEvidence.reference.ageMs)}</p>
              </section>
              <section className="rounded-md border border-stocklana-border p-3">
                <p className="text-[10px] uppercase tracking-wider text-stocklana-muted">Jupiter / executable</p>
                <p className="mt-2 font-mono text-xs text-white">{usd(report.marketEvidence.executableQuote.priceMicros)}</p>
                <p className="mt-1 font-mono text-xs text-white">impact {report.marketEvidence.executableQuote.priceImpactBps ?? "—"} bps</p>
                <p className="mt-1 font-mono text-xs text-white">route {report.marketEvidence.executableQuote.routeHops ?? "—"} hops</p>
                <p className="mt-1 font-mono text-xs text-white">
                  input {formatTokenAmount(
                    report.marketEvidence.executableQuote.inputAmount,
                    report.marketEvidence.executableQuote.inputDecimals,
                    "USDC",
                  )}
                </p>
                <p className="mt-1 font-mono text-xs text-stocklana-accent">
                  estimated {formatTokenAmount(
                    report.marketEvidence.executableQuote.expectedOutputAmount,
                    report.marketEvidence.executableQuote.outputDecimals,
                    report.asset.symbol,
                  )}
                </p>
              </section>
              <section className="rounded-md border border-stocklana-border p-3">
                <p className="text-[10px] uppercase tracking-wider text-stocklana-muted">Authorization</p>
                <p className="mt-2 font-mono text-xs text-white">{report.authorization.status}</p>
                <p className="mt-1 font-mono text-xs text-white">owner {short(report.authorization.requiredApprover)}</p>
                <p className="mt-1 font-mono text-xs text-white">signer {short(report.authorization.signer)}</p>
                <p className="mt-1 font-mono text-xs text-white">
                  receipt {report.authorization.receipt ? short(report.authorization.receipt.signatureHex) : "—"}
                </p>
              </section>
            </div>

            <section className="grid gap-3 border-t border-stocklana-border pt-4 sm:grid-cols-2">
              <div className="rounded-md border border-stocklana-border bg-stocklana-bg/30 p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-white">Before</p>
                <p className="mt-2 font-mono text-xs text-stocklana-muted">proposal {short(report.stateTransition.before.proposalId)}</p>
                <p className="mt-1 font-mono text-xs text-stocklana-muted">
                  proposed input {formatTokenAmount(
                    report.stateTransition.before.proposedInputAmount,
                    report.marketEvidence.executableQuote.inputDecimals,
                    "USDC",
                  )}
                </p>
                <p className="mt-1 font-mono text-xs text-stocklana-muted">
                  minimum {formatTokenAmount(
                    report.stateTransition.before.proposedMinimumOutputAmount,
                    report.marketEvidence.executableQuote.outputDecimals,
                    report.asset.symbol,
                  )}
                </p>
                <p className="mt-1 font-mono text-stocklana-muted">transaction constructed: no</p>
              </div>
              <div className="rounded-md border border-stocklana-border bg-stocklana-bg/30 p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-white">After</p>
                <p className="mt-2 font-mono text-xs text-stocklana-muted">wallet changed by KAIROS: no</p>
                <p className="mt-1 font-mono text-xs text-stocklana-muted">daily quota consumed: no</p>
                <p className="mt-1 font-mono text-xs text-stocklana-muted">transaction signature: —</p>
              </div>
            </section>

            <p className="break-all text-xs text-stocklana-muted">
              proposal {report.integrity.proposalId} · evidence {report.integrity.evidenceDigest}
              {report.decision.reasons.length ? ` · ${report.decision.reasons.map(translateMarketReason).join("; ")}` : ""}
            </p>

            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={exportReport}>
                <Download className="h-3.5 w-3.5" /> Download JSON report
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setShowJson((value) => !value)}>
                <Code2 className="h-3.5 w-3.5" /> {showJson ? "Hide JSON" : "Show JSON"}
              </Button>
              <Button asChild type="button" size="sm" variant="outline">
                <a href={`https://explorer.solana.com/address/${report.asset.mint}`} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" /> Open mint
                </a>
              </Button>
              <Button asChild type="button" size="sm" variant="outline">
                <a href="https://www.pyth.network/price-feeds" target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" /> Open Pyth
                </a>
              </Button>
              <Badge className="border-stocklana-border text-stocklana-muted">
                No on-chain transaction
              </Badge>
            </div>

            {showJson ? (
              <pre className="max-h-[36rem] overflow-auto rounded-md border border-stocklana-border bg-stocklana-bg/80 p-4 font-mono text-[11px] leading-5 text-stocklana-muted">
                {JSON.stringify(report, null, 2)}
              </pre>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
