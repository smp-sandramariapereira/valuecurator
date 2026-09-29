"use client";

import { Download, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useMarketRefresh,
  type DecisionHistoryEntry,
  type MarketScenario,
} from "@/components/market-refresh-provider";
import { approvedSimulationIsNotSignable } from "@/agent/src/final-report";
import { translateMarketReason } from "@/lib/market-format";

function short(value: string): string {
  return value.length > 18 ? `${value.slice(0, 8)}…${value.slice(-8)}` : value;
}

function scenarioLabel(scenario: MarketScenario): string {
  if (scenario === "live") return "Live market";
  if (scenario === "safe") return "Safe simulation";
  if (scenario === "stale") return "Stale simulation";
  return "Divergent simulation";
}

function proposalState(entry: DecisionHistoryEntry): "SIGNED" | "EXPIRED" | "READY" | "NOT SIGNABLE" | "BLOCKED" {
  if (entry.receipt) return "SIGNED";
  if (approvedSimulationIsNotSignable({
    simulated: entry.evidence.simulated,
    decision: entry.evidence.decision,
    proposalStatus: entry.proposal.status,
    proposalReasons: entry.proposal.reasons,
  })) return "NOT SIGNABLE";
  if (entry.proposal.status === "BLOCKED") return "BLOCKED";
  if (Date.now() > Date.parse(entry.proposal.validUntil)) return "EXPIRED";
  return "READY";
}

function tone(state: ReturnType<typeof proposalState>): string {
  if (state === "SIGNED" || state === "READY") return "text-stocklana-accent";
  if (state === "BLOCKED") return "text-red-400";
  return "text-amber-300";
}

function downloadHistory(history: readonly DecisionHistoryEntry[]): void {
  const report = {
    schemaVersion: 1,
    kind: "KAIROS_DECISION_HISTORY",
    exportedAt: new Date().toISOString(),
    storage: "browser-local",
    entries: history,
  };
  const url = URL.createObjectURL(new Blob([`${JSON.stringify(report, null, 2)}\n`], {
    type: "application/json",
  }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "kairos-decision-history.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function DecisionHistoryCard() {
  const { history } = useMarketRefresh();

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <History className="h-4 w-4 text-stocklana-accent" /> Decision history
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge>{history.length} {history.length === 1 ? "ENTRY" : "ENTRIES"}</Badge>
            <Button type="button" size="sm" variant="outline" disabled={!history.length}
              onClick={() => downloadHistory(history)}>
              <Download className="h-3.5 w-3.5" /> Export JSON
            </Button>
          </div>
        </div>
        <CardDescription>
          Audit trail stored only in this browser. It records evidence, proposals, blocks and receipts; it is not on-chain history.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!history.length ? (
          <p className="font-mono text-xs text-stocklana-muted">
            No decisions recorded. Refresh the market or run a demo scenario.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-stocklana-border">
            <table className="w-full min-w-[980px] text-left text-xs">
              <thead className="bg-stocklana-bg/60 font-mono uppercase tracking-wider text-stocklana-muted">
                <tr>
                  <th className="px-3 py-2">Time / scenario</th>
                  <th className="px-3 py-2">Decision</th>
                  <th className="px-3 py-2">Proposal / evidence</th>
                  <th className="px-3 py-2">Reasons</th>
                  <th className="px-3 py-2">Signature / submission</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => {
                  const state = proposalState(entry);
                  const reasons = entry.proposal.reasons.length
                    ? entry.proposal.reasons
                    : entry.evidence.reasons;
                  return (
                    <tr key={entry.proposal.proposalId} className="border-t border-stocklana-border align-top">
                      <td className="px-3 py-3">
                        <span className="block text-white">{new Date(entry.recordedAt).toLocaleString("en-US")}</span>
                        <span className="mt-1 block font-mono text-stocklana-muted">{scenarioLabel(entry.scenario)}</span>
                      </td>
                      <td className="px-3 py-3 font-mono">
                        <span className={entry.evidence.decision === "APPROVED"
                          ? "block text-stocklana-accent"
                          : "block text-red-400"}>
                          market {entry.evidence.decision}
                        </span>
                        <span className={`mt-1 block ${tone(state)}`}>proposal {state}</span>
                      </td>
                      <td className="px-3 py-3 font-mono text-stocklana-muted">
                        <span className="block">proposal {short(entry.proposal.proposalId)}</span>
                        <span className="mt-1 block">evidence {short(entry.proposal.evidenceDigest)}</span>
                        <span className="mt-1 block">feed {entry.evidence.referenceFeedId}</span>
                      </td>
                      <td className="max-w-sm px-3 py-3 text-stocklana-muted">
                        {reasons.length
                          ? reasons.map(translateMarketReason).join(" · ")
                          : "No deterministic block."}
                      </td>
                      <td className="px-3 py-3 font-mono text-stocklana-muted">
                        <span className="block">wallet {entry.receipt ? short(entry.receipt.signer) : "—"}</span>
                        <span className="mt-1 block">receipt {entry.receipt ? short(entry.receipt.signatureHex) : "—"}</span>
                        {entry.receipt ? (
                          <span className="mt-1 block">signed {new Date(entry.receipt.signedAt).toLocaleString("en-US")}</span>
                        ) : null}
                        <span className="mt-1 block">transaction submitted: no</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
