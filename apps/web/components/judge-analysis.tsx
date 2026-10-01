"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const API = process.env.NEXT_PUBLIC_DISCOVERY_API_URL ?? "http://localhost:3001";

type Indicator = { id: string; segment: "B2B" | "B2A"; label: string };
type Matched = Indicator;
type SessionRow = {
  interviewId: string;
  wallet: string;
  state: string;
  completed: boolean;
  segment: string;
  possibleUser: string;
  pilotInterest: boolean | null;
  matchedIndicators: Matched[];
};
type Analysis = {
  protocolVersion: string;
  promptVersion: string;
  disclaimer: string;
  segments: Array<{ id: string; label: string; definition: string }>;
  indicators: Indicator[];
  summary: {
    consented: number;
    completed: number;
    inProgress: number;
    b2b: number;
    b2a: number;
    both: number;
    unclassified: number;
    pilotYes: number;
    pilotNo: number;
  };
  sessions: SessionRow[];
};

export function JudgeAnalysis() {
  const [analysis, setAnalysis] = useState<Analysis>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/interviews/analysis`)
      .then(async (response) => {
        if (!response.ok) throw new Error("The research analysis is unavailable.");
        return response.json() as Promise<Analysis>;
      })
      .then((body) => {
        if (!cancelled) setAnalysis(body);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "The research analysis is unavailable.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="rounded-xl border border-stocklana-border bg-stocklana-card/80 p-2.5 text-stocklana-muted transition hover:text-white" aria-label="Back to ValueCurator">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-discovery-accent">ValueCurator / Judges</div>
              <h1 className="mt-1 text-xl font-semibold tracking-tight">B2B and B2A research analysis</h1>
            </div>
          </div>
          <Link href="/interview" className="inline-flex h-11 items-center rounded-xl border border-stocklana-border bg-stocklana-card/40 px-4 font-mono text-xs font-semibold uppercase tracking-wider text-white hover:border-discovery-accent/50">Interview</Link>
        </header>

        <section className="discovery-hero rounded-3xl border p-7 sm:p-10">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-discovery-accent">English interview · protocol v2</p>
          <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight">Possible users, read from what people already do.</h2>
          <p className="mt-3 max-w-3xl text-stocklana-muted">
            B2B is a business that allocates capital. B2A is an agent or runtime that proposes an action for that capital. A match is an indicator, not a signed customer.
          </p>
        </section>

        {error && <p className="mt-6 text-sm text-red-300">{error} Start the Discovery API on port 3001.</p>}

        {analysis && (
          <>
            <p className="mt-6 text-sm leading-6 text-stocklana-muted">{analysis.disclaimer}</p>
            <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Completed", String(analysis.summary.completed)],
                ["B2B", String(analysis.summary.b2b)],
                ["B2A", String(analysis.summary.b2a)],
                ["Both", String(analysis.summary.both)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-stocklana-border bg-stocklana-card/80 px-4 py-4">
                  <dt className="font-mono text-[10px] uppercase tracking-wider text-stocklana-muted">{label}</dt>
                  <dd className="mt-1 text-2xl font-semibold text-white">{value}</dd>
                </div>
              ))}
            </dl>

            <section className="mt-8 grid gap-6 lg:grid-cols-2">
              {analysis.segments.map((segment) => (
                <article key={segment.id} className="rounded-3xl border border-stocklana-border bg-stocklana-card/80 p-6">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-discovery-accent">{segment.id}</p>
                  <h3 className="mt-2 text-xl font-semibold">{segment.label}</h3>
                  <p className="mt-3 text-sm leading-6 text-stocklana-muted">{segment.definition}</p>
                  <ul className="mt-4 space-y-2">
                    {analysis.indicators.filter((item) => item.segment === segment.id).map((item) => (
                      <li key={item.id} className="text-sm leading-6 text-slate-200">{item.label}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </section>

            <section className="mt-8">
              <h3 className="text-xl font-semibold">Recorded sessions</h3>
              <p className="mt-2 text-sm text-stocklana-muted">
                {analysis.summary.inProgress} in progress · {analysis.summary.unclassified} completed without a segment · pilot yes {analysis.summary.pilotYes} · pilot no {analysis.summary.pilotNo}
              </p>
              <div className="mt-4 space-y-4">
                {analysis.sessions.length === 0 && (
                  <p className="rounded-2xl border border-stocklana-border bg-[#0c1724]/60 px-4 py-4 text-sm text-stocklana-muted">
                    No consented interview is stored yet. The indicator list above is the analysis the panel will apply to each session.
                  </p>
                )}
                {analysis.sessions.map((session) => (
                  <article key={session.interviewId} className="rounded-2xl border border-stocklana-border bg-stocklana-card/80 p-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                      <h4 className="text-base font-semibold text-white">{segmentTitle(session.segment)}</h4>
                      <p className="font-mono text-[10px] uppercase tracking-wider text-stocklana-muted">
                        {session.wallet} · {session.completed ? "Complete" : session.state} · pilot {pilotText(session.pilotInterest)}
                      </p>
                    </div>
                    <p className="mt-2 text-sm text-slate-200">{session.possibleUser}</p>
                    <ul className="mt-3 space-y-2">
                      {session.matchedIndicators.map((item) => (
                        <li key={item.id} className="text-sm leading-6 text-slate-300">
                          <span className="text-discovery-accent">{item.segment}.</span> {item.label}
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function segmentTitle(segment: string) {
  if (segment === "B2B_AND_B2A") return "B2B and B2A";
  if (segment === "UNCLASSIFIED") return "Unclassified";
  return segment;
}

function pilotText(value: boolean | null) {
  if (value === true) return "yes";
  if (value === false) return "no";
  return "not indicated";
}
