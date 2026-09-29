"use client";

import { useState } from "react";
import { Activity, Calculator, Code2, Download, ExternalLink, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useMarketRefresh, type MarketEvidence } from "@/components/market-refresh-provider";
import { formatAgeComparison, formatMeasuredValue, formatTokenAmount, translateMarketReason } from "@/lib/market-format";

function usd(micros: string): string {
  const value = BigInt(micros);
  const whole = value / 1_000_000n;
  const fraction = (value % 1_000_000n).toString().padStart(6, "0").slice(0, 2);
  return `$${whole}.${fraction}`;
}

function multiplier(value: string): string {
  const nano = BigInt(value);
  const whole = nano / 1_000_000_000n;
  const fraction = (nano % 1_000_000_000n).toString().padStart(9, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

function isSolanaAddress(value: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}

function downloadEvidence(evidence: MarketEvidence): void {
  const url = URL.createObjectURL(new Blob([`${JSON.stringify(evidence, null, 2)}\n`], {
    type: "application/json",
  }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `kairos-market-evidence-${evidence.symbol.toLowerCase()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function MarketEvidenceCard() {
  const { evidence, status, error, activeScenario, pendingScenario, refresh } = useMarketRefresh();
  const [showJson, setShowJson] = useState(false);
  const refreshing = status === "refreshing";
  const pathChosen = activeScenario !== null;

  return (
    <Card className={pathChosen && evidence?.decision === "BLOCKED" ? "border-red-900/60" : undefined}>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-stocklana-accent" /> Market evidence
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {evidence ? (
              <Badge className={evidence.simulated
                ? "border-amber-500/60 text-amber-300"
                : "border-stocklana-accent/30 text-stocklana-accent"}>
                {evidence.simulated ? "SIMULATED DATA" : "LIVE PYTH PRO"}
              </Badge>
            ) : null}
            <Button type="button" size="sm" variant="outline" disabled={refreshing} onClick={() => void refresh("live")}>
              <RefreshCw className={`h-3.5 w-3.5 ${pendingScenario === "live" ? "animate-spin" : ""}`} />
              {pendingScenario === "live" ? "Querying…" : "Refresh market"}
            </Button>
          </div>
        </div>
        <CardDescription>
          Policy compares the reference price, confidence, age and executable price before any transaction.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <section className="mb-4 rounded-md border border-stocklana-border bg-stocklana-bg/30 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-white">Demo scenarios</p>
              <p className="mt-1 text-xs text-stocklana-muted">
                Block turns the decision red. Safe approves the simulation and still does not sign. Neither path submits a transaction.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" disabled={refreshing} onClick={() => void refresh("safe")}>
                {pendingScenario === "safe" ? "Simulating…" : "Safe · APPROVED"}
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={refreshing} onClick={() => void refresh("stale")}>
                {pendingScenario === "stale" ? "Simulating…" : "Block · stale price"}
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={refreshing} onClick={() => void refresh("divergent")}>
                {pendingScenario === "divergent" ? "Simulating…" : "Block · divergence"}
              </Button>
            </div>
          </div>
        </section>
        {error ? (
          <p className="mb-3 rounded-md border border-red-900/60 bg-red-950/20 p-3 text-xs text-red-300">
            Refresh failed: {error}
          </p>
        ) : null}
        {refreshing ? (
          <p className="mb-3 font-mono text-xs text-stocklana-muted">
            {pendingScenario === "live"
              ? "Querying Pyth, xStocks and Jupiter on the server…"
              : "Generating a simulated scenario on the server…"}
          </p>
        ) : null}
        {!evidence ? (
          <p className="font-mono text-xs text-stocklana-muted">Evidence unavailable — execution must remain blocked.</p>
        ) : (
          <div className="space-y-4">
            {evidence.simulated ? (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs leading-5 text-amber-200">
                {pathChosen
                  ? `CONTROLLED SIMULATION · scenario ${activeScenario} · documented AAPLx mint · these prices are not a live quote · transaction submitted: no.`
                  : "CONTROLLED SIMULATION · preview · documented AAPLx mint · these prices are not a live quote · choose a path to see the decision · transaction submitted: no."}
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div><p className="text-xs uppercase tracking-wider text-stocklana-muted">Asset</p><p className="font-mono text-white">{evidence.symbol}</p></div>
              <div><p className="text-xs uppercase tracking-wider text-stocklana-muted">Reference</p><p className="font-mono text-stocklana-accent">{usd(evidence.referencePriceMicros)}</p></div>
              <div><p className="text-xs uppercase tracking-wider text-stocklana-muted">Executable</p><p className="font-mono text-white">{evidence.executablePriceMicros === null ? "unavailable" : usd(evidence.executablePriceMicros)}</p></div>
              <div>
                <p className="text-xs uppercase tracking-wider text-stocklana-muted">Decision</p>
                <p className={pathChosen
                  ? evidence.decision === "APPROVED" ? "font-mono text-stocklana-accent" : "font-mono text-red-400"
                  : "font-mono text-stocklana-muted"}>
                  {pathChosen ? evidence.decision : "—"}
                </p>
              </div>
            </div>
            <div className="grid gap-2 font-mono text-xs text-stocklana-muted sm:grid-cols-3">
              <p>age {formatAgeComparison(evidence.priceAgeMs, evidence.maximumPriceAgeMs)}</p>
              <p>confidence {evidence.confidenceBps} / {evidence.maximumConfidenceBps} bps</p>
              <p>deviation {evidence.deviationBps === null ? "—" : evidence.deviationBps} / {evidence.maximumDeviationBps} bps</p>
            </div>
            {evidence.executableSource ? (
              <div className="grid gap-2 font-mono text-xs text-stocklana-muted sm:grid-cols-3">
                <p>source {evidence.executableSource} · {evidence.marketNetwork}</p>
                <p>impact {evidence.priceImpactBps ?? "—"} bps · {evidence.routeHops ?? "—"} hops</p>
                <p>multiplier {evidence.multiplierNano ? multiplier(evidence.multiplierNano) : "—"}</p>
              </div>
            ) : null}
            {evidence.quoteInputAmount ? (
              <section className="grid gap-3 rounded-md border border-stocklana-border bg-stocklana-bg/30 p-3 sm:grid-cols-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-stocklana-muted">Input</p>
                  <p className="mt-1 font-mono text-white">
                    {formatTokenAmount(evidence.quoteInputAmount, evidence.quoteInputDecimals, "USDC")}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-stocklana-muted">Estimated AAPLx</p>
                  <p className="mt-1 font-mono text-stocklana-accent">
                    {formatTokenAmount(evidence.quoteExpectedOutputAmount, evidence.quoteOutputDecimals, evidence.symbol)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-stocklana-muted">Protected minimum</p>
                  <p className="mt-1 font-mono text-white">
                    {formatTokenAmount(evidence.quoteMinimumOutputAmount, evidence.quoteOutputDecimals, evidence.symbol)}
                  </p>
                </div>
              </section>
            ) : null}
            <p className="break-all text-xs text-stocklana-muted">
              Feed {evidence.referenceFeedId}{evidence.mint ? ` · mint ${evidence.mint}` : ""} · transaction submitted: {evidence.transactionSubmitted ? "yes" : "no"}
              {pathChosen && evidence.reasons.length ? ` · ${evidence.reasons.map(translateMarketReason).join("; ")}` : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              {evidence.mint && isSolanaAddress(evidence.mint) ? (
                <Button asChild type="button" size="sm" variant="outline">
                  <a href={`https://explorer.solana.com/address/${evidence.mint}?cluster=mainnet-beta`} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" /> Open mint on Mainnet
                  </a>
                </Button>
              ) : null}
              <Button asChild type="button" size="sm" variant="outline">
                <a href="https://www.pyth.network/price-feeds" target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" /> Pyth catalog · feed {evidence.referenceFeedId}
                </a>
              </Button>
              <Badge className="border-stocklana-border text-stocklana-muted">
                On-chain transaction unavailable
              </Badge>
            </div>
            {evidence.calculations?.length ? (
              <section className="space-y-3 border-t border-stocklana-border pt-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                      <Calculator className="h-4 w-4 text-stocklana-purple" /> Auditable calculations
                    </h3>
                    <p className="mt-1 font-mono text-[11px] text-stocklana-muted">
                      {evidence.calculationPolicyVersion}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => setShowJson((value) => !value)}>
                      <Code2 className="h-3.5 w-3.5" /> {showJson ? "Hide JSON" : "Show JSON"}
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => downloadEvidence(evidence)}>
                      <Download className="h-3.5 w-3.5" /> Download JSON
                    </Button>
                  </div>
                </div>
                <div className="overflow-x-auto rounded-md border border-stocklana-border">
                  <table className="w-full min-w-[760px] text-left text-xs">
                    <thead className="bg-stocklana-bg/60 font-mono uppercase tracking-wider text-stocklana-muted">
                      <tr>
                        <th className="px-3 py-2">Measurement</th>
                        <th className="px-3 py-2">Formula</th>
                        <th className="px-3 py-2">Inputs</th>
                        <th className="px-3 py-2">Result / limit</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {evidence.calculations.map((calculation) => (
                        <tr key={calculation.id} className="border-t border-stocklana-border align-top">
                          <td className="px-3 py-3 font-medium text-white">{calculation.label}</td>
                          <td className="px-3 py-3 font-mono text-stocklana-purple">{calculation.formula}</td>
                          <td className="px-3 py-3 font-mono text-stocklana-muted">
                            {Object.entries(calculation.operands).map(([key, value]) => (
                              <span key={key} className="block">{key}={value ?? "—"}</span>
                            ))}
                          </td>
                          <td className="px-3 py-3 font-mono text-white">
                            {calculation.result.value === null
                              ? "—"
                              : formatMeasuredValue(calculation.result.value, calculation.result.unit)}
                            {calculation.threshold
                              ? ` / ${calculation.threshold.operator} ${formatMeasuredValue(calculation.threshold.value, calculation.threshold.unit)}`
                              : ""}
                          </td>
                          <td className={!pathChosen
                            ? "px-3 py-3 font-mono text-stocklana-muted"
                            : calculation.passed === true
                              ? "px-3 py-3 font-mono text-stocklana-accent"
                              : calculation.passed === false
                                ? "px-3 py-3 font-mono text-red-400"
                                : "px-3 py-3 font-mono text-stocklana-muted"}>
                            {!pathChosen ? "—" : calculation.passed === true ? "PASS" : calculation.passed === false ? "BLOCK" : "N/A"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {showJson ? (
                  <pre className="max-h-[32rem] overflow-auto rounded-md border border-stocklana-border bg-stocklana-bg/80 p-4 font-mono text-[11px] leading-5 text-stocklana-muted">
                    {JSON.stringify({
                      schemaVersion: 1,
                      calculationPolicyVersion: evidence.calculationPolicyVersion,
                      symbol: evidence.symbol,
                      generatedAt: evidence.generatedAt,
                      calculations: evidence.calculations,
                      ...(pathChosen ? { decision: evidence.decision } : {}),
                    }, null, 2)}
                  </pre>
                ) : null}
              </section>
            ) : (
              <p className="border-t border-stocklana-border pt-3 font-mono text-xs text-stocklana-muted">
                This report was generated before auditable calculations were added. Generate it again with check:market.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
