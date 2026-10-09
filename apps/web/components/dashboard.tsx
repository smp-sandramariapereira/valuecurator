"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Activity, Wallet } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CapitalGrid } from "@/components/capital-grid";
import { MetabolicCard } from "@/components/metabolic-card";
import { MetabolicPath } from "@/components/metabolic-path";
import { OnChainFeed } from "@/components/on-chain-feed";
import { MarketEvidenceCard } from "@/components/market-evidence-card";
import { ExecutionProposalCard } from "@/components/execution-proposal-card";
import { MarketRefreshProvider, useMarketRefresh } from "@/components/market-refresh-provider";
import { DecisionHistoryCard } from "@/components/decision-history-card";
import { FinalReportCard } from "@/components/final-report-card";
import { MandateBuilder, createInitialMandateDraft } from "@/components/mandate-builder";
import { useDevnetReferencePrice } from "@/components/use-devnet-reference-price";
import { useKairosNode } from "@/components/use-kairos-node";
import {
  DEFAULT_PROGRAM_ID,
  DEVNET_CUSTODY_TXS,
  DEVNET_NODE_ADDRESS,
  DEVNET_PRICE_REJECTION_TX,
  DEVNET_REJECTION_TX,
  MAINNET_AAPLX_MINT,
  MAINNET_PYTH_AAPLX_FEED,
  explorerAddressUrl,
  explorerTxUrl,
  formatReferenceUsd,
  rpcUrl,
  formatTokenAmount,
} from "@/lib/kairos";
import { formatAgeMs, formatTokenAmount as formatMarketAmount } from "@/lib/market-format";
import type { MandateDraft } from "@/lib/mandate-builder";
import {
  DASHBOARD_VIEW_IDS,
  dashboardViewSearch,
  mandateStepSearch,
  parseDashboardView,
  type DashboardView,
} from "@/lib/dashboard-navigation";

const WalletMultiButton = dynamic(
  async () => {
    const mod = await import("@solana/wallet-adapter-react-ui");
    return mod.WalletMultiButton;
  },
  { ssr: false, loading: () => <Button variant="outline">Wallet…</Button> },
);

function mandateLimit(value: number): string {
  return `${value} bps`;
}

function formatDraftNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function shortAddress(value: string): string {
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

function ViewStageHeader({
  step,
  label,
  description,
}: {
  step: string;
  label: string;
  description: string;
}) {
  return (
    <header className="view-stage-header border-b border-stocklana-accent/35 pb-4">
      <p className="font-mono text-sm uppercase tracking-[0.22em] text-stocklana-accent">{step}</p>
      <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-white sm:text-3xl">{label}</h2>
      <p className="mt-1 text-sm text-stocklana-muted">{description}</p>
    </header>
  );
}

function viewPanelClass(): string {
  return "scroll-mt-6 space-y-5 outline-none rounded-2xl border border-stocklana-accent/30 bg-[#1A3148] p-4 sm:space-y-6 sm:p-6";
}

function GateIntro() {
  const { evidence, policyLimits } = useMarketRefresh();
  return (
    <Card className="border-stocklana-accent/30 bg-stocklana-accent/5">
      <CardHeader>
        <CardTitle>Two demo paths</CardTitle>
        <CardDescription>
          This reviewer preview shows why a buy would stop. Block stops on a stale price or on excess divergence. Safe leaves the proposal unsigned. No transaction is submitted from this preview.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 border-t border-stocklana-accent/20 pt-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-stocklana-muted">Mandate</p>
          <p className="mt-1 font-mono text-white">
            {evidence ? `${evidence.symbol} · feed ${evidence.referenceFeedId}` : "AAPLx · feed 922"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-stocklana-muted">Price age</p>
          <p className="mt-1 font-mono text-white">≤ {formatAgeMs(policyLimits.maximumPriceAgeMs)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-stocklana-muted">Confidence</p>
          <p className="mt-1 font-mono text-white">≤ {mandateLimit(policyLimits.maximumConfidenceBps)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-stocklana-muted">Deviation</p>
          <p className="mt-1 font-mono text-white">≤ {mandateLimit(policyLimits.maximumDeviationBps)}</p>
        </div>
        {evidence?.quoteInputAmount ? (
          <div className="sm:col-span-2 lg:col-span-4">
            <p className="font-mono text-xs text-stocklana-muted">
              Order checked by these paths: {formatMarketAmount(evidence.quoteInputAmount, evidence.quoteInputDecimals, "USDC")}
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

const dashboardViews: readonly { id: DashboardView; step: string; label: string; description: string }[] = [
  { id: "overview", step: "01", label: "Overview", description: "Product and status" },
  { id: "mandate", step: "02", label: "Mandate", description: "Configure execution policy" },
  { id: "gate", step: "03", label: "Gate", description: "Evidence and decision" },
  { id: "audit", step: "04", label: "Audit", description: "Reports and history" },
];

export function Dashboard() {
  const { state, events, mint, refresh, connected, publicKey, readOnly, historyMessage } = useKairosNode();
  const referencePrice = useDevnetReferencePrice();
  const [activeSignature, setActiveSignature] = useState<string | null>(null);
  const [playId, setPlayId] = useState(0);
  const [activeView, setActiveView] = useState<DashboardView>("overview");
  const [mandateDraft, setMandateDraft] = useState<MandateDraft>(() => createInitialMandateDraft());
  const [mandateStepRequest, setMandateStepRequest] = useState<{ step: number; nonce: number } | null>(null);
  const lastSeenSignature = useRef<string | null>(null);

  useEffect(() => {
    if (!connected) {
      setActiveSignature(null);
      lastSeenSignature.current = null;
      return;
    }
    const newest = events[0];
    if (!newest) return;
    if (newest.signature === lastSeenSignature.current) return;
    lastSeenSignature.current = newest.signature;
    setActiveSignature(newest.signature);
    setPlayId((n) => n + 1);
  }, [connected, events]);

  const activeEvent = useMemo(
    () => events.find((item) => item.signature === activeSignature) ?? null,
    [activeSignature, events],
  );

  function replay(signature?: string) {
    const target = signature ?? activeSignature ?? events[0]?.signature;
    if (!target) return;
    setActiveSignature(target);
    setPlayId((n) => n + 1);
  }

  const rpcHost = rpcUrl().replace("https://", "");
  const activeViewMeta = dashboardViews.find((view) => view.id === activeView) ?? dashboardViews[0];

  const focusView = useCallback((view: DashboardView, target: "panel" | "tab" = "panel") => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      const panel = document.getElementById(`dashboard-panel-${view}`);
      panel?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
      document.getElementById(`dashboard-${target}-${view}`)?.focus({ preventScroll: true });
    }));
  }, []);

  const navigateTo = useCallback((
    view: DashboardView,
    options: { history?: "push" | "replace" | "none"; focus?: "panel" | "tab" } = {},
  ) => {
    const historyMode = options.history ?? "push";
    setActiveView(view);
    if (historyMode !== "none") {
      const nextUrl = `${window.location.pathname}${dashboardViewSearch(window.location.search, view)}${window.location.hash}`;
      if (historyMode === "replace") window.history.replaceState({}, "", nextUrl);
      else window.history.pushState({}, "", nextUrl);
    }
    focusView(view, options.focus);
  }, [focusView]);

  const openMandate = useCallback((step: number) => {
    setMandateStepRequest({ step, nonce: Date.now() });
    setActiveView("mandate");
    const nextUrl = `${window.location.pathname}${mandateStepSearch(window.location.search, step)}${window.location.hash}`;
    window.history.pushState({}, "", nextUrl);
    focusView("mandate");
  }, [focusView]);

  useEffect(() => {
    const syncFromLocation = () => {
      const view = parseDashboardView(new URLSearchParams(window.location.search).get("view"));
      setActiveView(view);
      focusView(view);
    };
    const initialView = parseDashboardView(new URLSearchParams(window.location.search).get("view"));
    setActiveView(initialView);
    window.addEventListener("popstate", syncFromLocation);
    return () => window.removeEventListener("popstate", syncFromLocation);
  }, [focusView]);

  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = DASHBOARD_VIEW_IDS.length - 1;
    let next = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = index === last ? 0 : index + 1;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = index === 0 ? last : index - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    else return;
    event.preventDefault();
    navigateTo(DASHBOARD_VIEW_IDS[next], { focus: "tab" });
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 pb-28 pt-6 sm:px-6 sm:pb-32 sm:pt-8">
      <header className="proofgate-hero overflow-hidden rounded-2xl border p-5 sm:p-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-4">
              <Image
                src="/proofgate-mark.svg"
                alt="ValueCurator symbol"
                width={56}
                height={56}
                priority
                className="proofgate-brand-mark h-12 w-12 sm:h-14 sm:w-14"
              />
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-stocklana-purple sm:text-[11px]">
                  Stocklana 2026 · Tokenized assets · Built on Solana
                </p>
                <h1 className="mt-0.5 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
                  Value<span className="text-stocklana-accent">Curator</span>
                </h1>
              </div>
            </div>

            <div className="proofgate-pitch mt-6 space-y-3">
              <p className="max-w-2xl text-xl font-semibold leading-snug tracking-[-0.02em] text-white sm:text-2xl">
                You keep the owner key. The other key proposes the buy.
              </p>
              <p className="max-w-2xl text-sm leading-6 text-stocklana-muted sm:text-[15px]">
                You record price age, confidence, and deviation. If a proposal leaves those limits, the buy does not go out. The other key does not sign, or the program rejects it. One USDC is one month of that lock on one node. It is not the purchase of the asset.
              </p>
            </div>

            <dl className="mt-5 grid max-w-2xl gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wider text-stocklana-muted">Your signature</dt>
                <dd className="mt-1 text-sm leading-6 text-white">Sets the limits, or pays 1 USDC for one node for one month.</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-stocklana-muted">The other key</dt>
                <dd className="mt-1 text-sm leading-6 text-white">Proposes the buy. It signs only inside the limits you recorded.</dd>
              </div>
            </dl>

            <div className="mt-5 flex flex-wrap gap-2">
              <Badge className="border-stocklana-blue/30 text-blue-300">Owner key</Badge>
              <Badge className="border-stocklana-purple/30 text-stocklana-purple">Operator key</Badge>
              <Badge className="border-stocklana-accent/30 text-stocklana-accent">Three limits</Badge>
            </div>
            <Link href="/interview/analysis" className="mt-4 inline-flex text-sm font-medium text-stocklana-accent underline-offset-4 hover:underline">
              B2B / B2A research analysis
            </Link>
          </div>
          <div className="flex w-full flex-col gap-3 lg:w-72 lg:shrink-0">
            <Badge className="w-fit border-stocklana-accent/30 text-stocklana-accent lg:self-end">
              <span className={connected ? "live-dot mr-2" : "live-dot live-dot-purple mr-2"} />
              {rpcHost}
            </Badge>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                className="h-11 w-full font-mono text-xs uppercase tracking-wider"
                onClick={() => openMandate(0)}
              >
                Start demo
              </Button>
              <div className="min-w-0 [&_.wallet-adapter-button]:h-11 [&_.wallet-adapter-button]:w-full">
                <WalletMultiButton />
              </div>
            </div>
            <Button asChild variant="outline" className="h-11 w-full font-mono text-xs uppercase tracking-wider">
              <Link href="/interview">Interview</Link>
            </Button>
            <Button asChild variant="outline" className="h-11 w-full font-mono text-xs uppercase tracking-wider">
              <Link href="/subscribe">Subscription</Link>
            </Button>
          </div>
        </div>

        <section className="mt-6 overflow-hidden rounded-xl border border-stocklana-border bg-[#0E1824]">
          <p className="border-b border-stocklana-border bg-[#0A121C] px-4 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-stocklana-purple sm:px-5">
            Why ValueCurator
          </p>
          <div className="grid gap-0 sm:grid-cols-3">
            {[
              {
                title: "The problem",
                body: "Another key can buy on a stale price, a wide feed interval, or a quote far from the reference you accept.",
              },
              {
                title: "The protection",
                body: "You write the three limits. The operator key signs only inside them. Deviation is also rejected inside the program.",
              },
              {
                title: "The proof",
                body: "The reviewer demo below keeps the Devnet program and the mainnet price read apart. The subscription is a separate USDC transfer.",
              },
            ].map((item, index) => (
              <div
                key={item.title}
                className={
                  "space-y-2 px-4 py-4 sm:px-5 " +
                  (index > 0 ? "border-t border-stocklana-border sm:border-t-0 sm:border-l" : "")
                }
              >
                <h2 className="text-base font-semibold text-white">{item.title}</h2>
                <p className="text-sm leading-6 text-stocklana-muted">{item.body}</p>
              </div>
            ))}
          </div>
          <div className="border-t border-stocklana-border px-4 py-4 sm:px-5">
            <p className="text-sm leading-6 text-white">
              Program on Devnet. AAPLx evidence is a mainnet read. No AAPLx transaction is submitted. No mainnet deployment.
            </p>
          </div>
          <div className="grid border-t border-stocklana-border md:grid-cols-2">
            <div className="space-y-3 border-b border-stocklana-border px-4 py-4 sm:px-5 md:border-b-0 md:border-r">
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-blue-300">Devnet</p>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-blue-300">Program executes</span>
              </div>
              <ul className="space-y-2">
                <li>
                  <a
                    href={explorerAddressUrl(referencePrice.address.toBase58(), "devnet")}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between gap-3 rounded-lg border border-blue-300/40 bg-[#0A121C] px-3 py-2 transition hover:border-stocklana-accent/60"
                  >
                    <span>
                      <span className="block text-sm font-semibold text-white">Reference price</span>
                      <span className="mt-0.5 block font-mono text-[11px] text-stocklana-muted">
                        post_reference_price · owner posted
                      </span>
                      <span className="mt-0.5 block font-mono text-[11px] text-blue-300">
                        {referencePrice.status === "ready"
                          ? `${formatReferenceUsd(referencePrice.price.referencePrice)} · ${referencePrice.price.maximumDeviationBps} bps · mint ${shortAddress(referencePrice.price.mint.toBase58())}`
                          : referencePrice.status === "loading"
                            ? "Reading Devnet…"
                            : referencePrice.status === "empty"
                              ? "Owner has not posted this account"
                              : referencePrice.message}
                      </span>
                    </span>
                    <span className="font-mono text-[11px] text-stocklana-accent">
                      {shortAddress(referencePrice.address.toBase58())}
                    </span>
                  </a>
                </li>
                <li>
                  <a
                    href={explorerTxUrl(DEVNET_PRICE_REJECTION_TX.signature)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between gap-3 rounded-lg border border-blue-300/40 bg-[#0A121C] px-3 py-2 transition hover:border-stocklana-accent/60"
                  >
                    <span>
                      <span className="block text-sm font-semibold text-white">{DEVNET_PRICE_REJECTION_TX.label}</span>
                      <span className="mt-0.5 block font-mono text-[11px] text-stocklana-muted">
                        {DEVNET_PRICE_REJECTION_TX.instruction} · {DEVNET_PRICE_REJECTION_TX.error}
                      </span>
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-blue-300">Transaction</span>
                  </a>
                </li>
                <li>
                  <a
                    href={explorerAddressUrl(DEFAULT_PROGRAM_ID, "devnet")}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between gap-3 rounded-lg border border-stocklana-border bg-[#0A121C] px-3 py-2 transition hover:border-stocklana-accent/60"
                  >
                    <span className="text-sm font-semibold text-white">Program</span>
                    <span className="font-mono text-[11px] text-stocklana-accent">{shortAddress(DEFAULT_PROGRAM_ID)}</span>
                  </a>
                </li>
                <li>
                  <a
                    href={explorerAddressUrl(DEVNET_NODE_ADDRESS, "devnet")}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between gap-3 rounded-lg border border-stocklana-border bg-[#0A121C] px-3 py-2 transition hover:border-stocklana-accent/60"
                  >
                    <span className="text-sm font-semibold text-white">Node</span>
                    <span className="font-mono text-[11px] text-stocklana-accent">{shortAddress(DEVNET_NODE_ADDRESS)}</span>
                  </a>
                </li>
                {DEVNET_CUSTODY_TXS.map((tx) => (
                  <li key={tx.id}>
                    <a
                      href={explorerTxUrl(tx.signature)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between gap-3 rounded-lg border border-stocklana-border bg-[#0A121C] px-3 py-2 transition hover:border-stocklana-accent/60"
                    >
                      <span>
                        <span className="block text-sm font-semibold text-white">{tx.label}</span>
                        <span className="mt-0.5 block font-mono text-[11px] text-stocklana-muted">{tx.instruction}</span>
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-blue-300">Transaction</span>
                    </a>
                  </li>
                ))}
                <li>
                  <a
                    href={explorerTxUrl(DEVNET_REJECTION_TX.signature)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between gap-3 rounded-lg border border-stocklana-border bg-[#0A121C] px-3 py-2 transition hover:border-stocklana-accent/60"
                  >
                    <span>
                      <span className="block text-sm font-semibold text-white">{DEVNET_REJECTION_TX.label}</span>
                      <span className="mt-0.5 block font-mono text-[11px] text-stocklana-muted">
                        {DEVNET_REJECTION_TX.instruction} · {DEVNET_REJECTION_TX.error}
                      </span>
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-blue-300">Transaction</span>
                  </a>
                </li>
              </ul>
            </div>
            <div className="space-y-3 px-4 py-4 sm:px-5">
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-stocklana-purple">Mainnet</p>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-stocklana-purple">Read only</span>
              </div>
              <ul className="space-y-2">
                <li>
                  <a
                    href={explorerAddressUrl(MAINNET_AAPLX_MINT, "mainnet-beta")}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between gap-3 rounded-lg border border-stocklana-border bg-[#0A121C] px-3 py-2 transition hover:border-stocklana-accent/60"
                  >
                    <span>
                      <span className="block text-sm font-semibold text-white">AAPLx mint</span>
                      <span className="mt-0.5 block font-mono text-[11px] text-stocklana-muted">{shortAddress(MAINNET_AAPLX_MINT)}</span>
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-stocklana-purple">Read</span>
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.pyth.network/price-feeds"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between gap-3 rounded-lg border border-stocklana-border bg-[#0A121C] px-3 py-2 transition hover:border-stocklana-accent/60"
                  >
                    <span>
                      <span className="block text-sm font-semibold text-white">Pyth price</span>
                      <span className="mt-0.5 block font-mono text-[11px] text-stocklana-muted">Feed {MAINNET_PYTH_AAPLX_FEED}</span>
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-stocklana-purple">Read</span>
                  </a>
                </li>
                <li className="flex items-center justify-between gap-3 rounded-lg border border-stocklana-border bg-[#0A121C] px-3 py-2">
                  <span>
                    <span className="block text-sm font-semibold text-white">Jupiter quote</span>
                    <span className="mt-0.5 block font-mono text-[11px] text-stocklana-muted">USDC to AAPLx</span>
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-stocklana-purple">Read</span>
                </li>
              </ul>
              <p className="text-xs leading-5 text-stocklana-muted">
                No transaction is submitted from this column. The Devnet reference price is the account the swap instruction reads. This column reads the AAPLx mint, Pyth feed 922, and the Jupiter quote.
              </p>
            </div>
          </div>
        </section>
      </header>

      <MarketRefreshProvider mandate={mandateDraft}>
        <nav
          className="safe-bottom-nav fixed left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 items-center gap-1 rounded-2xl border-2 border-stocklana-accent/50 bg-[#1A3148] p-1.5 shadow-[0_18px_50px_rgba(0,0,0,0.65),0_0_0_1px_rgba(125,162,248,0.28)]"
          aria-label="Demo navigation"
          role="tablist"
        >
          {dashboardViews.map((view, index) => {
            const selected = activeView === view.id;
            return (
              <button
                key={view.id}
                type="button"
                role="tab"
                id={`dashboard-tab-${view.id}`}
                aria-controls={`dashboard-panel-${view.id}`}
                aria-selected={selected}
                aria-label={`${view.label}: ${view.description}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => navigateTo(view.id)}
                onKeyDown={(event) => handleTabKey(event, index)}
                className={
                  "min-w-0 flex-1 rounded-xl border px-2 py-2.5 text-center transition-all sm:px-4 " +
                  (selected
                    ? "border-stocklana-accent/40 bg-stocklana-accent/15 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                    : "border-transparent text-stocklana-muted hover:bg-stocklana-bg/55 hover:text-white")
                }
              >
                <span className={selected ? "block font-mono text-[9px] text-stocklana-accent" : "block font-mono text-[9px] text-stocklana-muted"}>
                  {view.step}
                </span>
                <span className="block truncate text-xs font-semibold sm:text-sm">{view.label}</span>
              </button>
            );
          })}
        </nav>

        {activeView === "overview" ? (
          <div id="dashboard-panel-overview" aria-labelledby="dashboard-tab-overview" tabIndex={-1} className={viewPanelClass()} role="tabpanel">
            <ViewStageHeader step={activeViewMeta.step} label={activeViewMeta.label} description={activeViewMeta.description} />
            <div className="demo-zebra space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>Current mandate</CardTitle>
                    <CardDescription>
                      Draft limits for the gate. The bars on Mandate update this row. The Devnet program does not store this policy.
                    </CardDescription>
                  </div>
                  <Button type="button" variant="outline" onClick={() => openMandate(1)}>Configure mandate</Button>
                </div>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-0 overflow-hidden rounded-xl border border-stocklana-border bg-[#0E1824] sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ["Per trade", `${formatDraftNumber(mandateDraft.maximumTradeUsdc)} USDC`],
                    ["Daily", `${formatDraftNumber(mandateDraft.maximumDailyUsdc)} USDC`],
                    ["Price age", `${formatDraftNumber(mandateDraft.maximumPriceAgeSeconds)} sec`],
                    ["Deviation", `${formatDraftNumber(mandateDraft.maximumDeviationBps)} bps`],
                  ].map(([label, detail], index) => (
                    <div
                      key={label}
                      className={[
                        "min-w-0 px-4 py-4",
                        index > 0 ? "border-t border-stocklana-border sm:border-t-0" : "",
                        index % 2 === 1 ? "sm:border-l" : "",
                        index >= 2 ? "lg:border-l lg:border-t-0" : "",
                        index === 2 ? "sm:border-t" : "",
                      ].filter(Boolean).join(" ")}
                    >
                      <dt className="text-sm font-semibold text-white">{label}</dt>
                      <dd className="mt-1 font-mono text-sm text-stocklana-accent">{detail}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
            <section>
              <Card>
                <CardHeader>
                  <CardTitle>What ValueCurator verifies</CardTitle>
                  <CardDescription>
                    The gate checks the mandate and the market evidence. In this demo the result is an approval receipt or a block. No AAPLx transaction is submitted.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <dl className="grid gap-0 overflow-hidden rounded-xl border border-stocklana-border bg-[#0E1824] sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      ["Mandate", "Asset, amount and validity"],
                      ["Market", "Pyth price and confidence"],
                      ["Quote", "Read-only Jupiter price"],
                      ["Receipt", "Approve, block, or sign"],
                    ].map(([label, detail], index) => (
                      <div
                        key={label}
                        className={[
                          "min-w-0 px-4 py-4",
                          index > 0 ? "border-t border-stocklana-border" : "",
                          index % 2 === 1 ? "sm:border-l" : "",
                          index < 2 ? "sm:border-t-0" : "sm:border-t",
                          index > 0 ? "lg:border-l lg:border-t-0" : "lg:border-t-0",
                        ].filter(Boolean).join(" ")}
                      >
                        <dt className="text-sm font-semibold text-white">{label}</dt>
                        <dd className="mt-1 text-xs leading-5 text-stocklana-muted">{detail}</dd>
                      </div>
                    ))}
                  </dl>
                </CardContent>
              </Card>
            </section>

            {readOnly ? (
              <Card className="border-stocklana-blue/30 bg-stocklana-blue/5">
                <CardHeader>
                  <CardTitle>Public query · read only</CardTitle>
                  <CardDescription className="break-all">
                    Owner: {publicKey?.toBase58()}. No signature or private key required.
                  </CardDescription>
                </CardHeader>
              </Card>
            ) : null}

            {!connected ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-stocklana-purple" /> Connect wallet
                  </CardTitle>
                  <CardDescription>
                    Phantom or Solflare. The connection selects the owner; public queries require no signature.
                    You can also set NEXT_PUBLIC_NODE_OWNER for wallet-free read access.
                  </CardDescription>
                </CardHeader>
              </Card>
            ) : null}

            {state.status === "loading" ? (
              <Card>
                <CardContent className="py-10 font-mono text-sm text-stocklana-muted">
                  Reading Devnet…
                </CardContent>
              </Card>
            ) : null}

            {state.status === "error" ? (
              <Card className="border-red-900/60">
                <CardHeader>
                  <CardTitle>Unable to read the node</CardTitle>
                  <CardDescription>{state.message}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button type="button" variant="outline" onClick={() => void refresh()}>
                    Try again
                  </Button>
                </CardContent>
              </Card>
            ) : null}

            {state.status === "empty" ? (
              <Card>
                <CardHeader>
                  <CardTitle>Node not initialized yet</CardTitle>
                  <CardDescription className="font-mono text-xs">{state.reason}</CardDescription>
                </CardHeader>
              </Card>
            ) : null}

            {state.status === "ready" ? (
              <section className="grid gap-3 sm:grid-cols-3">
                <MetabolicCard
                  label="Node status"
                  value="ATIVO"
                  hint="confirmed data on Solana Devnet"
                  tone="accent"
                  live
                />
                <MetabolicCard
                  label="Treasury (infrastructure)"
                  value={
                    state.treasuryBalance === null
                      ? mint
                        ? "Balance unavailable"
                        : "define NEXT_PUBLIC_MINT"
                      : formatTokenAmount(state.treasuryBalance, state.decimals)
                  }
                  hint={state.treasuryAta ? state.treasuryAta.toBase58() : "Token-2022"}
                  tone="purple"
                  live={state.treasuryBalance !== null}
                />
                <MetabolicCard
                  label="Infrastructure fee"
                  value={`${state.node.infrastructureFeeBps / 100}%`}
                  hint={`owner ${publicKey?.toBase58() ?? ""}`}
                  tone="blue"
                />
              </section>
            ) : null}
            </div>
          </div>
        ) : null}

        {activeView === "mandate" ? (
          <div id="dashboard-panel-mandate" aria-labelledby="dashboard-tab-mandate" tabIndex={-1} className={viewPanelClass()} role="tabpanel">
            <ViewStageHeader step={activeViewMeta.step} label={activeViewMeta.label} description={activeViewMeta.description} />
            <div className="demo-zebra space-y-6">
              <MandateBuilder
                draft={mandateDraft}
                onDraftChange={setMandateDraft}
                stepRequest={mandateStepRequest}
                onOpenGate={() => navigateTo("gate")}
              />
            </div>
          </div>
        ) : null}

        {activeView === "gate" ? (
          <div id="dashboard-panel-gate" aria-labelledby="dashboard-tab-gate" tabIndex={-1} className={viewPanelClass()} role="tabpanel">
            <ViewStageHeader step={activeViewMeta.step} label={activeViewMeta.label} description={activeViewMeta.description} />
            <div className="demo-zebra space-y-6">
              <GateIntro />
              <MarketEvidenceCard />
              <ExecutionProposalCard />
            </div>
          </div>
        ) : null}

        {activeView === "audit" ? (
          <div id="dashboard-panel-audit" aria-labelledby="dashboard-tab-audit" tabIndex={-1} className={viewPanelClass()} role="tabpanel">
            <ViewStageHeader step={activeViewMeta.step} label={activeViewMeta.label} description={activeViewMeta.description} />
            <div className="demo-zebra space-y-6">
            <Card className="border-stocklana-blue/30 bg-stocklana-blue/5">
              <CardHeader>
                <CardTitle>Custody signatures</CardTitle>
                <CardDescription>
                  Explorer signatures on this page are confirmed Devnet custody events. They are not the AAPLx approval receipt and they do not move AAPLx.
                </CardDescription>
              </CardHeader>
            </Card>

            <FinalReportCard />
            <DecisionHistoryCard />

            {state.status === "ready" ? (
              <>
                <MetabolicPath
                  event={activeEvent}
                  playId={playId}
                  onReplay={() => replay()}
                />
                <CapitalGrid
                  node={state.node}
                  treasuryBalance={state.treasuryBalance}
                  vaultBalance={state.vaultBalance}
                  decimals={state.decimals}
                />
              </>
            ) : null}

            <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <OnChainFeed
                historyMessage={historyMessage}
                events={events}
                activeSignature={activeSignature}
                onSelect={(signature) => replay(signature)}
                connected={connected}
              />
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-stocklana-accent" /> How to read this dashboard
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm leading-6 text-stocklana-muted">
                  <p>
                    The custody signatures come from{" "}
                    <code className="font-mono text-stocklana-purple">metabolize_yield</code> on Devnet.
                    That instruction splits the demo Token-2022 mint. It is not an AAPLx swap, and it is not the signed approval receipt.
                  </p>
                  <p>
                    Balances come from the node account or the treasury token account, or they stay empty.
                    Simulated reports stay labeled and are not presented as Solana transactions.
                  </p>
                </CardContent>
              </Card>
            </section>
            </div>
          </div>
        ) : null}
      </MarketRefreshProvider>

      <footer className="flex flex-col gap-2 border-t border-stocklana-border py-5 text-xs text-stocklana-muted sm:flex-row sm:items-center sm:justify-between">
        <p>
          <span className="font-semibold text-white">ValueCurator</span> · Public product identity
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.12em]">
          KAIROS Engine technical core · Devnet custody / Mainnet evidence
        </p>
      </footer>
    </div>
  );
}
