"use client";

import { useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { ArrowLeft, ArrowRight, Check, ChevronDown, ChevronUp, Lightbulb, LockKeyhole, Mic, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_DISCOVERY_API_URL ?? "http://localhost:3001";

const steps = [
  "Consent","Context","Autonomy","Controls","Risk","Authorization",
  "Audit","Infrastructure","ValueCurator","Objections","Pilot",
];

const answerExamples: Record<string, string> = {
  CONSENT: "For example: “Yes, I consent to participate.”",
  CONTEXT: "For example: “We are building an agent that helps manage treasury operations.”",
  AUTONOMY: "For example: “Human approval is required today.” or “It can act within predefined limits.”",
  CURRENT_CONTROLS: "For example: “We use an internal approval process.” or “We don't currently have formal controls.”",
  RISK: "For example: “Acting on incorrect information.” or “Executing outside the intended mandate.”",
  AUTHORIZATION: "For example: “I would want clear limits on what the agent is allowed to do.”",
  AUDITABILITY: "For example: “We need to know what evidence was used and why an action was approved.”",
  BUILD_VS_BUY: "For example: “We would prefer infrastructure we can integrate.” or “We would likely build this internally.”",
  VALUECURATOR_REVEAL: "For example: “That addresses part of the problem.” or “I would need to understand the integration model.”",
  OBJECTIONS: "For example: “Security review would be required.” or “I don't see a blocker yet.”",
  PILOT_INTEREST: "For example: “Yes, I would consider a shadow-mode pilot.” or “No, not at this stage.”",
};

type InterviewView = {
  session: {
    id: string;
    state: string;
    evidence: Array<{ finding: string; evidence: string }>;
  };
  nextQuestion: string | null;
  researchProfile?: Record<string, unknown>;
  authorizationBlueprint?: {
    status: string;
    controlsMentioned: string[];
    missingThresholds: string[];
    disclaimer: string;
  };
};

export function DiscoveryInterview() {
  const { publicKey, connected, signMessage } = useWallet();
  const [token, setToken] = useState<string>();
  const [sessionId, setSessionId] = useState<string>();
  const [view, setView] = useState<InterviewView>();
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [showExample, setShowExample] = useState(false);

  const stepIndex = useMemo(() => {
    if (!view) return 0;
    const states = ["CONSENT","CONTEXT","AUTONOMY","CURRENT_CONTROLS","RISK","AUTHORIZATION","AUDITABILITY","BUILD_VS_BUY","VALUECURATOR_REVEAL","OBJECTIONS","PILOT_INTEREST","COMPLETE"];
    return Math.max(0, states.indexOf(view.session.state));
  }, [view]);

  async function authenticate() {
    if (!publicKey || !signMessage) {
      setError("This wallet does not support message signing.");
      return;
    }
    setBusy(true); setError(undefined);
    try {
      const walletAddress = publicKey.toBase58();
      const challengeRes = await fetch(`${API}/auth/challenge`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ walletAddress }),
      });
      if (!challengeRes.ok) throw new Error("Could not create authentication challenge.");
      const challenge = await challengeRes.json() as { nonce: string; message: string };
      const signature = await signMessage(new TextEncoder().encode(challenge.message));
      const signatureBase58 = base58Encode(signature);
      const verifyRes = await fetch(`${API}/auth/verify`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ walletAddress, nonce: challenge.nonce, signature: signatureBase58 }),
      });
      if (!verifyRes.ok) throw new Error("Wallet signature could not be verified.");
      const auth = await verifyRes.json() as { token: string; sessionId: string };
      setToken(auth.token); setSessionId(auth.sessionId);
      const sessionRes = await fetch(`${API}/interviews/${auth.sessionId}`, {
        headers: { authorization: `Bearer ${auth.token}` },
      });
      if (!sessionRes.ok) throw new Error("Could not load interview.");
      setView(await sessionRes.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Authentication failed.");
    } finally { setBusy(false); }
  }

  async function submitAnswer() {
    if (!token || !sessionId || !answer.trim()) return;
    setBusy(true); setError(undefined);
    try {
      const res = await fetch(`${API}/interviews/${sessionId}/answers`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ answer }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not save answer.");
      setView(body); setAnswer(""); setShowExample(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save answer.");
    } finally { setBusy(false); }
  }

  const evidence = view?.session.evidence ?? [];

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="rounded-xl border border-stocklana-border bg-stocklana-card/80 p-2.5 text-stocklana-muted transition hover:border-discovery-accent/60 hover:text-white" aria-label="Back to ValueCurator">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-discovery-accent">ValueCurator / Discovery</div>
              <h1 className="mt-1 text-xl font-semibold tracking-tight">Research Interview</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {token && <span className="hidden items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-emerald-300 sm:flex"><ShieldCheck className="h-3.5 w-3.5"/> Authenticated</span>}
            <WalletMultiButton />
          </div>
        </header>

        {!token ? (
          <section className="discovery-hero mx-auto max-w-3xl overflow-hidden rounded-3xl border p-7 sm:p-10">
            <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl border border-discovery-accent/35 bg-discovery-accent/10 text-discovery-accent">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-discovery-accent">Customer Discovery · Protocol v1</div>
            <h2 className="mt-4 max-w-2xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">Help define the authorization layer for autonomous finance.</h2>
            <p className="mt-5 max-w-2xl text-base leading-7 text-stocklana-muted">Participate in a focused 5–8 minute research interview about autonomy, financial controls, evidence and authorization.</p>

            <div className="mt-8 rounded-2xl border border-stocklana-border bg-[#0c1724]/75 p-5">
              <div className="flex gap-3">
                <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-discovery-accent" />
                <div>
                  <p className="text-sm font-semibold">Authentication only</p>
                  <p className="mt-1 text-sm leading-6 text-stocklana-muted">Your Solana wallet authenticates this research session. No transaction will be created or submitted, and the login signature is never financial authorization.</p>
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              {!connected ? <WalletMultiButton /> : (
                <button onClick={authenticate} disabled={busy} className="discovery-button inline-flex h-11 items-center gap-2 rounded-xl px-5 font-mono text-xs font-bold uppercase tracking-wider disabled:opacity-50">
                  <Wallet className="h-4 w-4" /> {busy ? "Signing..." : "Sign research session"}
                </button>
              )}
              <span className="font-mono text-[10px] uppercase tracking-wider text-stocklana-muted">No balance or transaction history collected</span>
            </div>
            {error && <p className="mt-5 text-sm text-red-300">{error}</p>}
          </section>
        ) : view?.session.state === "COMPLETE" ? (
          <Completion view={view} />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section className="discovery-panel rounded-3xl border p-6 sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-discovery-accent">Discovery Interview</div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-stocklana-muted">Step {Math.min(stepIndex + 1, 11)} / 11</div>
              </div>
              <div className="mt-4 grid grid-cols-11 gap-1.5" aria-label="Interview progress">
                {steps.map((step, i) => <div key={step} title={step} className={`h-1.5 rounded-full ${i <= stepIndex ? "bg-discovery-accent shadow-[0_0_12px_rgba(178,140,255,.3)]" : "bg-stocklana-border"}`} />)}
              </div>

              <div className="py-10 sm:py-14">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-stocklana-muted">{steps[Math.min(stepIndex, 10)]}</p>
                <h2 className="mt-4 max-w-3xl text-2xl font-medium leading-relaxed tracking-tight sm:text-3xl">{view?.nextQuestion}</h2>
              </div>

              <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={6} placeholder="Type your answer…" className="w-full resize-none rounded-2xl border border-stocklana-border bg-[#0b1623]/90 p-4 text-[15px] leading-6 text-white outline-none transition placeholder:text-slate-600 focus:border-discovery-accent/70 focus:ring-2 focus:ring-discovery-accent/10" />

              {view?.session.state && answerExamples[view.session.state] && (
                <div className="mt-3">
                  <button type="button" onClick={() => setShowExample((value) => !value)} aria-expanded={showExample} className="inline-flex items-center gap-2 text-xs text-stocklana-muted transition hover:text-discovery-light">
                    <Lightbulb className="h-3.5 w-3.5 text-discovery-accent" />
                    Need an example?
                    {showExample ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                  {showExample && (
                    <div className="mt-3 rounded-xl border border-discovery-accent/20 bg-discovery-accent/5 px-4 py-3">
                      <p className="text-sm leading-6 text-slate-300">{answerExamples[view.session.state]}</p>
                      <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.12em] text-stocklana-muted">Format example only · use your own experience</p>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <button type="button" disabled title="Voice input is the next implementation stage" className="inline-flex items-center gap-2 rounded-xl border border-stocklana-border px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider text-stocklana-muted opacity-60">
                  <Mic className="h-4 w-4"/> Record answer · soon
                </button>
                <button onClick={submitAnswer} disabled={busy || !answer.trim()} className="discovery-button inline-flex items-center gap-2 rounded-xl px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-40">
                  {busy ? "Saving..." : "Continue"} <ArrowRight className="h-4 w-4"/>
                </button>
              </div>
              {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
            </section>

            <aside className="space-y-4">
              <InfoCard title="Research session">
                <Status label="Wallet authenticated" />
                <Status label="Protocol v1" />
                <Status label={stepIndex > 0 ? "Consent recorded" : "Consent pending"} ok={stepIndex > 0} />
                <p className="pt-2 font-mono text-[10px] uppercase tracking-wider text-stocklana-muted">{Math.min(stepIndex + 1, 11)} / 11 blocks</p>
              </InfoCard>
              <InfoCard title="Evidence captured">
                {evidence.length ? evidence.slice(-5).map((e, i) => (
                  <div key={i} className="flex gap-2 text-sm text-slate-300"><span className="mt-1 text-discovery-accent">◆</span><span>{humanize(e.finding)}</span></div>
                )) : <p className="text-sm leading-6 text-stocklana-muted">Findings appear here only when supported by your responses.</p>}
              </InfoCard>
              <InfoCard title="Privacy">
                <p className="text-sm leading-6 text-stocklana-muted">No transaction is created. The interview does not inspect wallet balances, holdings or transaction history.</p>
              </InfoCard>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-2xl border border-stocklana-border bg-stocklana-card/80 p-5 shadow-terminal"><h3 className="mb-4 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-discovery-accent">{title}</h3><div className="space-y-3">{children}</div></div>;
}

function Status({ label, ok = true }: { label: string; ok?: boolean }) {
  return <div className="flex items-center gap-2 text-sm text-slate-300"><span className={`flex h-4 w-4 items-center justify-center rounded-full border ${ok ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" : "border-stocklana-border text-stocklana-muted"}`}>{ok && <Check className="h-2.5 w-2.5"/>}</span>{label}</div>;
}

function Completion({ view }: { view: InterviewView }) {
  const blueprint = view.authorizationBlueprint;
  const profile = view.researchProfile ?? {};

  const profileRows = [
    ["Autonomy model", readProfile(profile, ["autonomyModel", "modelo de autonomia"])],
    ["Current controls", readProfile(profile, ["currentControls", "controlesAtual"])],
    ["Concerns", readProfile(profile, ["concerns", "preocupações"])],
    ["Authorization needs", readProfile(profile, ["authorizationNeeds"])],
    ["Auditability", readProfile(profile, ["auditabilityNeeds", "Necessidades de auditabilidade"])],
    ["Build vs buy", readProfile(profile, ["buildVsBuySignals"])],
  ] as const;

  return (
    <div className="mx-auto max-w-5xl">
      <section className="discovery-hero rounded-3xl border p-7 sm:p-10">
        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-discovery-accent">Interview complete</div>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-5">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">Research evidence captured.</h2>
            <p className="mt-3 max-w-2xl text-stocklana-muted">A readable research profile and a non-binding authorization blueprint were generated from your answers.</p>
          </div>
          <div className="rounded-xl border border-discovery-accent/25 bg-discovery-accent/5 px-4 py-3">
            <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-stocklana-muted">Pilot interest</div>
            <div className="mt-1 text-sm font-semibold text-white">{readBoolean(profile, ["pilotInterest", "interesse do piloto"]) ? "Interested" : "Not indicated"}</div>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-stocklana-border bg-stocklana-card/80 p-6 shadow-terminal sm:p-7">
          <div className="mb-6">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-discovery-accent">Research profile</p>
            <h3 className="mt-2 text-xl font-semibold">What we heard</h3>
          </div>
          <div className="divide-y divide-stocklana-border/70">
            {profileRows.map(([label, values]) => (
              <div key={label} className="grid gap-2 py-4 sm:grid-cols-[150px_1fr]">
                <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-stocklana-muted">{label}</div>
                <div className="space-y-1.5">
                  {values.length ? values.map((value) => (
                    <div key={value} className="flex gap-2 text-sm leading-6 text-slate-200">
                      <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-discovery-accent" />
                      <span>{value}</span>
                    </div>
                  )) : <span className="text-sm text-stocklana-muted">Not specified</span>}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-stocklana-border bg-stocklana-card/80 p-6 shadow-terminal sm:p-7">
          <div className="mb-6">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-discovery-accent">Authorization blueprint</p>
            <h3 className="mt-2 text-xl font-semibold">Stated control requirements</h3>
          </div>

          <div className="rounded-xl border border-discovery-accent/25 bg-discovery-accent/5 px-3 py-2 font-mono text-[9px] uppercase tracking-wider text-discovery-accent">
            {blueprint?.status ? humanize(blueprint.status) : "Non-binding research artifact"}
          </div>

          {!!blueprint?.controlsMentioned.length && (
            <div className="mt-6">
              <p className="mb-3 font-mono text-[9px] uppercase tracking-[0.15em] text-stocklana-muted">Captured from responses</p>
              <div className="space-y-2">
                {blueprint.controlsMentioned.map((x) => (
                  <div key={x} className="flex items-center gap-3 rounded-xl border border-emerald-400/15 bg-emerald-400/5 px-3 py-2.5 text-sm text-slate-200">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-300"><Check className="h-3 w-3"/></span>
                    {humanize(x)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!!blueprint?.missingThresholds.length && (
            <div className="mt-6">
              <p className="mb-3 font-mono text-[9px] uppercase tracking-[0.15em] text-stocklana-muted">Quantitative parameters not specified</p>
              <div className="space-y-2">
                {blueprint.missingThresholds.map((x) => (
                  <div key={x} className="flex items-center justify-between gap-3 rounded-xl border border-stocklana-border bg-[#0c1724]/60 px-3 py-2.5">
                    <span className="text-sm text-slate-300">{thresholdLabel(x)}</span>
                    <span className="shrink-0 rounded-md border border-stocklana-border px-2 py-1 font-mono text-[8px] uppercase tracking-wider text-stocklana-muted">Not defined</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 border-t border-stocklana-border pt-5">
            <div className="flex gap-3">
              <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-discovery-accent" />
              <p className="text-xs leading-5 text-stocklana-muted">{blueprint?.disclaimer ?? "Research artifact only. It does not authorize financial execution."}</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function readProfile(profile: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = profile[key];
    if (Array.isArray(value)) return value.map(String).filter(Boolean);
    if (typeof value === "string" && value.trim()) return [value];
  }
  return [];
}

function readBoolean(profile: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = profile[key];
    if (typeof value === "boolean") return value;
  }
  return false;
}

function thresholdLabel(value: string) {
  const labels: Record<string, string> = {
    per_transaction_limit: "Per-transaction amount",
    daily_exposure_limit: "Daily exposure amount",
    maximum_evidence_age: "Maximum evidence age",
    maximum_source_deviation: "Maximum source deviation",
    maximum_price_impact: "Maximum price impact",
  };
  return labels[value] ?? humanize(value);
}

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function base58Encode(bytes: Uint8Array) {
  if (!bytes.length) return "";
  const digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let j = 0; j < digits.length; j++) {
      const x = digits[j] * 256 + carry;
      digits[j] = x % 58; carry = Math.floor(x / 58);
    }
    while (carry) { digits.push(carry % 58); carry = Math.floor(carry / 58); }
  }
  let result = "";
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) result += "1";
  for (let i = digits.length - 1; i >= 0; i--) result += ALPHABET[digits[i]];
  return result;
}
