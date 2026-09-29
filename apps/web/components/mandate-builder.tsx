"use client";

import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { AlertTriangle, CheckCircle2, Download, ExternalLink, RefreshCw, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useMarketRefresh } from "@/components/market-refresh-provider";
import {
  INPUT_ASSET,
  VERIFIED_ASSET,
  buildAdverseEvidence,
  buildCanonicalMandate,
  canonicalMandateJson,
  evaluateMandateEvidence,
  validateMandateDraft,
  type MandateArtifact,
  type MandateDraft,
} from "@/lib/mandate-builder";
import {
  canVisitMandateStep,
  mandateStepSearch,
  parseMandateStep,
} from "@/lib/dashboard-navigation";

const stepLabels = ["Verified asset", "Risk limits", "Simulation", "Review & export"] as const;

function initialDates(): Pick<MandateDraft, "validFrom" | "validUntil"> {
  const start = new Date();
  start.setSeconds(0, 0);
  const end = new Date(start.getTime() + 7 * 86_400_000);
  return { validFrom: start.toISOString(), validUntil: end.toISOString() };
}

function initialDraft(): MandateDraft {
  return {
    maximumTradeUsdc: 100,
    maximumDailyUsdc: 500,
    maximumAllocationPercent: 30,
    maximumPriceAgeSeconds: 30,
    maximumConfidenceBps: 100,
    maximumDeviationBps: 200,
    maximumSlippageBps: 100,
    advisorMode: "shadow",
    ...initialDates(),
  };
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await window.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function isoToLocal(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function localToIso(value: string): string {
  return value ? new Date(value).toISOString() : "";
}

function Field({
  label,
  value,
  unit,
  minimum = 0,
  maximum,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  unit: string;
  minimum?: number;
  maximum?: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="rounded-xl border border-stocklana-border bg-stocklana-bg/35 p-3">
      <span className="block text-xs font-medium text-stocklana-muted">{label}</span>
      <span className="mt-2 flex items-center gap-2">
        <input
          type="number"
          min={minimum}
          max={maximum}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="min-w-0 flex-1 rounded-lg border border-stocklana-border bg-stocklana-card px-3 py-2 font-mono text-sm text-white outline-none transition focus:border-stocklana-accent"
        />
        <span className="min-w-12 font-mono text-xs text-stocklana-accent">{unit}</span>
      </span>
    </label>
  );
}

function ResultBadge({ decision }: { decision: "APPROVED" | "BLOCKED" }) {
  return decision === "APPROVED" ? (
    <Badge className="border-stocklana-accent/40 bg-stocklana-accent/10 text-stocklana-accent">APPROVED</Badge>
  ) : (
    <Badge className="border-red-500/40 bg-red-500/10 text-red-300">BLOCKED</Badge>
  );
}

export function MandateBuilder() {
  const { publicKey } = useWallet();
  const { evidence, refresh, status, pendingScenario } = useMarketRefresh();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<MandateDraft>(() => initialDraft());
  const [hash, setHash] = useState("");
  const [serverArtifact, setServerArtifact] = useState<MandateArtifact | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const owner = publicKey?.toBase58() ?? "UNASSIGNED";
  const errors = useMemo(() => validateMandateDraft(draft), [draft]);
  const mandate = useMemo(() => buildCanonicalMandate(draft, owner), [draft, owner]);
  const canonicalJson = useMemo(() => canonicalMandateJson(mandate), [mandate]);

  useEffect(() => {
    let cancelled = false;
    void sha256Hex(canonicalJson).then((nextHash) => {
      if (!cancelled) setHash(nextHash);
    });
    setServerArtifact(null);
    setServerError(null);
    return () => { cancelled = true; };
  }, [canonicalJson]);

  const currentEvaluation = useMemo(
    () => evaluateMandateEvidence(evidence, mandate),
    [evidence, mandate],
  );
  const adverseEvaluation = useMemo(
    () => evaluateMandateEvidence(buildAdverseEvidence(mandate), mandate),
    [mandate],
  );

  function update<K extends keyof MandateDraft>(key: K, value: MandateDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  const focusStep = useCallback((index: number, target: "panel" | "tab" = "panel") => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      const panel = document.getElementById(`mandate-panel-${index}`);
      panel?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
      document.getElementById(`mandate-${target}-${index}`)?.focus({ preventScroll: true });
    }));
  }, []);

  function navigateStep(
    index: number,
    options: { history?: "push" | "replace" | "none"; focus?: "panel" | "tab" } = {},
  ) {
    if (!canVisitMandateStep(index, errors.length)) return;
    setStep(index);
    const historyMode = options.history ?? "push";
    if (historyMode !== "none") {
      const nextUrl = `${window.location.pathname}${mandateStepSearch(window.location.search, index)}${window.location.hash}`;
      if (historyMode === "replace") window.history.replaceState({}, "", nextUrl);
      else window.history.pushState({}, "", nextUrl);
    }
    focusStep(index, options.focus);
  }

  function handleStepKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = stepLabels.length - 1;
    let next = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = index === last ? 0 : index + 1;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = index === 0 ? last : index - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    else return;
    event.preventDefault();
    if (canVisitMandateStep(next, errors.length)) navigateStep(next, { focus: "tab" });
  }

  useEffect(() => {
    const syncFromLocation = () => {
      const requested = parseMandateStep(new URLSearchParams(window.location.search).get("step"));
      const next = canVisitMandateStep(requested, errors.length) ? requested : 1;
      setStep(next);
      focusStep(next);
    };
    const requested = parseMandateStep(new URLSearchParams(window.location.search).get("step"));
    if (canVisitMandateStep(requested, errors.length)) setStep(requested);
    window.addEventListener("popstate", syncFromLocation);
    return () => window.removeEventListener("popstate", syncFromLocation);
  }, [errors.length, focusStep]);

  async function validateOnServer() {
    if (errors.length) return;
    setValidating(true);
    setServerError(null);
    try {
      const response = await fetch("/api/mandates/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft, owner }),
      });
      const body = await response.json() as { artifact?: MandateArtifact; error?: string };
      if (!response.ok || !body.artifact) throw new Error(body.error || "Server validation failed.");
      setServerArtifact(body.artifact);
    } catch (cause) {
      setServerError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setValidating(false);
    }
  }

  function downloadArtifact() {
    if (!serverArtifact) return;
    const blob = new Blob([JSON.stringify(serverArtifact, null, 2) + "\n"], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${serverArtifact.mandateId}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="space-y-5" aria-labelledby="mandate-builder-title">
      <Card className="overflow-hidden border-stocklana-accent/30">
        <CardHeader className="bg-gradient-to-r from-stocklana-accent/10 via-stocklana-blue/5 to-transparent">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle id="mandate-builder-title" className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-stocklana-accent" /> Configure Execution Mandate
              </CardTitle>
              <CardDescription className="mt-2 max-w-3xl">
                Turn treasury preferences into a deterministic policy without editing .env files or exposing keys.
                This flow creates a draft attestation; it never constructs or submits a transaction.
              </CardDescription>
            </div>
            <Badge>DRAFT · NO TRANSACTION</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          <div className="grid gap-2 sm:grid-cols-4" role="tablist" aria-label="Mandate configuration steps">
            {stepLabels.map((label, index) => (
              <button
                key={label}
                type="button"
                role="tab"
                id={`mandate-tab-${index}`}
                aria-controls={`mandate-panel-${index}`}
                aria-selected={step === index}
                tabIndex={step === index ? 0 : -1}
                disabled={!canVisitMandateStep(index, errors.length)}
                title={!canVisitMandateStep(index, errors.length) ? "Resolve the risk-limit errors before continuing." : undefined}
                onClick={() => navigateStep(index)}
                onKeyDown={(event) => handleStepKey(event, index)}
                className={`rounded-xl border p-3 text-left transition ${step === index
                  ? "border-stocklana-accent/50 bg-stocklana-accent/10 text-white"
                  : "border-stocklana-border bg-stocklana-bg/25 text-stocklana-muted hover:text-white"}`}
              >
                <span className="block text-xs font-semibold sm:text-sm">{label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {step === 0 ? (
        <Card id="mandate-panel-0" aria-labelledby="mandate-tab-0" tabIndex={-1} role="tabpanel" className="scroll-mt-6 outline-none">
          <CardHeader>
            <CardTitle>Verified asset allowlist</CardTitle>
            <CardDescription>Asset identifiers are pinned by ValueCurator and cannot be typed or replaced in the browser.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {[
              ["Asset", VERIFIED_ASSET.symbol], ["Evidence network", "Solana Mainnet Beta"],
              ["AAPLx mint", VERIFIED_ASSET.mint], ["Pyth feed", VERIFIED_ASSET.pythFeedId],
              ["Input asset", INPUT_ASSET.symbol], ["USDC mint", INPUT_ASSET.mint],
              ["Issuer", VERIFIED_ASSET.issuer], ["Origin", VERIFIED_ASSET.origin],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-stocklana-border bg-stocklana-bg/30 p-3">
                <p className="text-xs text-stocklana-muted">{label}</p>
                <p className="mt-1 break-all font-mono text-xs text-white">{value}</p>
              </div>
            ))}
            <div className="flex flex-wrap gap-2 md:col-span-2">
              <a href={`https://solscan.io/token/${VERIFIED_ASSET.mint}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-stocklana-accent hover:underline">Explorer <ExternalLink className="h-3 w-3" /></a>
              <a href="https://www.pyth.network/price-feeds" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-stocklana-accent hover:underline">Pyth <ExternalLink className="h-3 w-3" /></a>
              <a href="https://assets.backed.fi/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-stocklana-accent hover:underline">xStocks <ExternalLink className="h-3 w-3" /></a>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 1 ? (
        <Card id="mandate-panel-1" aria-labelledby="mandate-tab-1" tabIndex={-1} role="tabpanel" className="scroll-mt-6 outline-none">
          <CardHeader>
            <CardTitle>Human-readable risk limits</CardTitle>
            <CardDescription>Values are converted to six-decimal micros, milliseconds and basis points in the canonical JSON.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Maximum per trade" value={draft.maximumTradeUsdc} unit="USDC" minimum={0.01} step={0.01} onChange={(v) => update("maximumTradeUsdc", v)} />
              <Field label="Daily limit" value={draft.maximumDailyUsdc} unit="USDC" minimum={0.01} step={0.01} onChange={(v) => update("maximumDailyUsdc", v)} />
              <Field label="Maximum allocation" value={draft.maximumAllocationPercent} unit="%" maximum={100} step={0.1} onChange={(v) => update("maximumAllocationPercent", v)} />
              <Field label="Maximum price age" value={draft.maximumPriceAgeSeconds} unit="sec" minimum={1} maximum={300} onChange={(v) => update("maximumPriceAgeSeconds", v)} />
              <Field label="Maximum confidence" value={draft.maximumConfidenceBps} unit="bps" maximum={1000} onChange={(v) => update("maximumConfidenceBps", v)} />
              <Field label="Maximum deviation" value={draft.maximumDeviationBps} unit="bps" maximum={2000} onChange={(v) => update("maximumDeviationBps", v)} />
              <Field label="Maximum slippage" value={draft.maximumSlippageBps} unit="bps" maximum={1000} onChange={(v) => update("maximumSlippageBps", v)} />
              <label className="rounded-xl border border-stocklana-border bg-stocklana-bg/35 p-3">
                <span className="block text-xs font-medium text-stocklana-muted">Valid from</span>
                <input type="datetime-local" value={isoToLocal(draft.validFrom)} onChange={(event) => update("validFrom", localToIso(event.target.value))} className="mt-2 w-full rounded-lg border border-stocklana-border bg-stocklana-card px-3 py-2 font-mono text-xs text-white" />
              </label>
              <label className="rounded-xl border border-stocklana-border bg-stocklana-bg/35 p-3">
                <span className="block text-xs font-medium text-stocklana-muted">Valid until</span>
                <input type="datetime-local" value={isoToLocal(draft.validUntil)} onChange={(event) => update("validUntil", localToIso(event.target.value))} className="mt-2 w-full rounded-lg border border-stocklana-border bg-stocklana-card px-3 py-2 font-mono text-xs text-white" />
              </label>
            </div>
            <div className="rounded-xl border border-stocklana-blue/30 bg-stocklana-blue/5 p-3 text-xs leading-5 text-stocklana-muted">
              <strong className="text-white">How to read bps:</strong> 200 bps = 2%. If Jupiter is more than 2% away from Pyth, the operation is blocked. Advisor mode remains <span className="font-mono text-stocklana-accent">SHADOW</span>: AI can advise but cannot override policy.
            </div>
            {errors.length ? (
              <ul className="space-y-1 rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-300">
                {errors.map((error) => <li key={error}>• {error}</li>)}
              </ul>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {step === 2 ? (
        <div id="mandate-panel-2" aria-labelledby="mandate-tab-2" tabIndex={-1} role="tabpanel" className="scroll-mt-6 grid gap-4 outline-none lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Current market</CardTitle>
                <Badge className={evidence?.simulated ? "border-amber-500/40 text-amber-300" : "border-stocklana-blue/30 text-blue-300"}>{evidence?.simulated ? "SIMULATED SOURCE" : "LIVE READ-ONLY"}</Badge>
              </div>
              <CardDescription>Re-evaluates the loaded Pyth/Jupiter evidence against this draft mandate.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between"><ResultBadge decision={currentEvaluation.decision} /><Button size="sm" variant="outline" disabled={status === "refreshing"} onClick={() => void refresh("live")}><RefreshCw className={`mr-2 h-3 w-3 ${pendingScenario === "live" ? "animate-spin" : ""}`} />Refresh live</Button></div>
              {currentEvaluation.checks.map((check) => <div key={check.label} className="flex items-center justify-between gap-3 border-t border-stocklana-border pt-2 text-xs"><span className="text-stocklana-muted">{check.label}</span><span className={check.passed ? "text-stocklana-accent" : "text-red-300"}>{check.value} / {check.limit}</span></div>)}
              {currentEvaluation.reasons.map((reason) => <p key={reason} className="text-xs text-red-300">{reason}</p>)}
            </CardContent>
          </Card>
          <Card className="border-amber-500/30">
            <CardHeader>
              <div className="flex items-center justify-between gap-2"><CardTitle>Adverse scenario</CardTitle><Badge className="border-amber-500/40 text-amber-300">SIMULATED</Badge></div>
              <CardDescription>A deliberately stale price proves the same mandate fails closed.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ResultBadge decision={adverseEvaluation.decision} />
              {adverseEvaluation.checks.map((check) => <div key={check.label} className="flex items-center justify-between gap-3 border-t border-stocklana-border pt-2 text-xs"><span className="text-stocklana-muted">{check.label}</span><span className={check.passed ? "text-stocklana-accent" : "text-red-300"}>{check.value} / {check.limit}</span></div>)}
              {adverseEvaluation.reasons.map((reason) => <p key={reason} className="flex gap-2 text-xs text-red-300"><AlertTriangle className="h-3 w-3 shrink-0" />{reason}</p>)}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {step === 3 ? (
        <Card id="mandate-panel-3" aria-labelledby="mandate-tab-3" tabIndex={-1} role="tabpanel" className="scroll-mt-6 outline-none">
          <CardHeader>
            <CardTitle>Canonical review</CardTitle>
            <CardDescription>Validate the draft on the server, then export the exact JSON. Wallet signing is intentionally reserved for Phase B.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-stocklana-border p-3"><p className="text-xs text-stocklana-muted">Owner</p><p className="mt-1 break-all font-mono text-xs text-white">{owner}</p></div>
              <div className="rounded-xl border border-stocklana-border p-3"><p className="text-xs text-stocklana-muted">Canonical hash preview</p><p className="mt-1 break-all font-mono text-xs text-white">{hash || "Calculating…"}</p></div>
              <div className="rounded-xl border border-stocklana-border p-3"><p className="text-xs text-stocklana-muted">Attestation</p><p className="mt-1 font-mono text-xs text-amber-300">NOT SIGNED · PHASE B</p></div>
            </div>
            <pre className="max-h-96 overflow-auto rounded-xl border border-stocklana-border bg-black/25 p-4 font-mono text-[11px] leading-5 text-blue-100">{JSON.stringify(mandate, null, 2)}</pre>
            {serverError ? <p className="text-xs text-red-300">{serverError}</p> : null}
            {serverArtifact ? <p className="flex items-center gap-2 text-xs text-stocklana-accent"><CheckCircle2 className="h-4 w-4" />Server validated · {serverArtifact.mandateId}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" aria-describedby="mandate-export-help" disabled={errors.length > 0 || validating} onClick={() => void validateOnServer()}>{validating ? "Validating…" : "Validate on server"}</Button>
              <Button type="button" variant="outline" aria-describedby="mandate-export-help" disabled={!serverArtifact} title={!serverArtifact ? "Validate the draft on the server before downloading." : undefined} onClick={downloadArtifact}><Download className="mr-2 h-4 w-4" />Download draft JSON</Button>
            </div>
            <p id="mandate-export-help" className="text-xs leading-5 text-stocklana-muted">Validate on the server to enable the download. No Pyth API key, wallet secret, operator key, endpoint or local path is present in this payload. Transaction constructed: NO · submitted: NO.</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" disabled={step === 0} onClick={() => navigateStep(Math.max(0, step - 1))}>Previous</Button>
        <Button type="button" disabled={step === stepLabels.length - 1 || !canVisitMandateStep(step + 1, errors.length)} title={step === 1 && errors.length > 0 ? "Resolve the risk-limit errors before continuing." : undefined} onClick={() => navigateStep(Math.min(stepLabels.length - 1, step + 1))}>Next</Button>
      </div>
    </section>
  );
}
