"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CatalogAsset } from "@/lib/asset-registry";
import { assetPath, presentAsset } from "@/lib/asset-verification-view";
import {
  PORTFOLIO_DRAFT_STORAGE_KEY,
  RISK_PROFILES,
  type PortfolioDraft,
  type RiskProfile,
  parsePortfolioDraft,
  reviewAllocation,
  simulateRebalance,
} from "@/lib/portfolio-draft";
import { JourneyNotice, JourneyScreen } from "@/components/journey/journey-screen";

const EMPTY_OBSERVED = "Nenhum portfólio observado disponível.\n\nVocê pode construir uma composição experimental e analisar sua alocação.";

function readDraft(): PortfolioDraft | null {
  try {
    return parsePortfolioDraft(JSON.parse(window.localStorage.getItem(PORTFOLIO_DRAFT_STORAGE_KEY) ?? "null"));
  } catch {
    return null;
  }
}

function writeDraft(draft: PortfolioDraft) {
  window.localStorage.setItem(PORTFOLIO_DRAFT_STORAGE_KEY, JSON.stringify(draft));
}

export function PortfolioOverview({ assets }: { assets: readonly CatalogAsset[] }) {
  const [draft, setDraft] = useState<PortfolioDraft | null>(null);
  useEffect(() => { setDraft(readDraft()); }, []);
  const names = new Map(assets.map((asset) => [asset.assetId, asset.ticker]));
  return (
    <JourneyScreen kicker="Planejado · observado · executado" title="Visão do Portfólio" lede="Uma composição salva neste navegador é planejamento. Ela não é uma posição, um saldo nem uma execução.">
      <JourneyNotice>{EMPTY_OBSERVED}</JourneyNotice>
      <section className="grid gap-3 sm:grid-cols-3" aria-label="Estados da composição">
        <StateCard label="PLANEJADO" body={draft ? draft.name || "Rascunho local" : "Nenhum rascunho local"} />
        <StateCard label="OBSERVADO" body="Nenhuma fonte de posições está ligada a esta tela." />
        <StateCard label="EXECUTADO" body="Nenhuma execução foi registrada aqui." />
      </section>
      {draft ? (
        <section className="rounded-xl border border-stocklana-border bg-stocklana-card p-4" aria-label="Composição planejada">
          <h2 className="text-lg font-semibold">Composição planejada</h2>
          <p className="mt-2 text-sm text-stocklana-muted">Rascunho local experimental. Não está sincronizado com a blockchain.</p>
          <ul className="mt-3 space-y-2 text-sm">
            {draft.assetIds.map((id) => <li key={id}>{names.get(id) ?? id}: {draft.weights[id] ?? 0}%</li>)}
          </ul>
        </section>
      ) : null}
      <p className="text-sm"><Link className="text-stocklana-accent underline" href="/portfolio/build">Construir uma composição experimental</Link></p>
    </JourneyScreen>
  );
}

export function PortfolioBuilder({ assets }: { assets: readonly CatalogAsset[] }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [horizon, setHorizon] = useState("");
  const [riskProfile, setRiskProfile] = useState<RiskProfile | "">("");
  const [selected, setSelected] = useState<string[]>([]);
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ALL");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const draft = readDraft();
    if (!draft) return;
    setName(draft.name);
    setObjective(draft.objective);
    setHorizon(draft.horizon);
    setRiskProfile(draft.riskProfile);
    setSelected(draft.assetIds);
    setWeights(Object.fromEntries(draft.assetIds.map((id) => [id, String(draft.weights[id] ?? "")])));
  }, []);
  const numericWeights = useMemo(() => Object.fromEntries(selected.map((id) => [id, Number(weights[id] ?? "")])), [selected, weights]);
  const review = reviewAllocation(selected, numericWeights);
  const visible = assets.filter((asset) => {
    const text = `${asset.ticker} ${asset.displayName} ${asset.assetId}`.toLowerCase();
    return text.includes(query.trim().toLowerCase()) && (category === "ALL" || asset.assetClass === category);
  });
  function save() {
    if (!review.valid) return;
    writeDraft({
      kind: "experimental-local-draft",
      name, objective, horizon, riskProfile, currency: "USD",
      assetIds: selected,
      weights: numericWeights,
      updatedAt: new Date().toISOString(),
    });
    setSaved(true);
  }
  return (
    <JourneyScreen kicker="Planejamento" title="Construir Portfólio" lede="As respostas desta construção não autorizam compra, venda nem mandato.">
      <ol className="flex flex-wrap gap-2 text-xs" aria-label="Etapas">
        {["Objetivos", "Seleção de ativos", "Alocação", "Verificação", "Revisão"].map((label, index) => (
          <li key={label}><button type="button" className={"min-h-11 rounded-lg px-3 " + (step === index ? "bg-white/10 text-white" : "text-stocklana-muted")} aria-current={step === index ? "step" : undefined} onClick={() => setStep(index)}>{index + 1}. {label}</button></li>
        ))}
      </ol>
      {step === 0 ? (
        <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); setStep(1); }}>
          <Field label="Nome do portfólio" value={name} onChange={setName} />
          <Field label="Objetivo" value={objective} onChange={setObjective} />
          <Field label="Horizonte de investimento" value={horizon} onChange={setHorizon} />
          <label className="block text-sm">Perfil de risco declarado
            <select className="mt-1 min-h-11 w-full rounded-lg border border-stocklana-border bg-stocklana-bg px-3" value={riskProfile} onChange={(event) => setRiskProfile(event.target.value as RiskProfile | "")}>
              <option value="">Não declarado</option>
              {RISK_PROFILES.map((profile) => <option key={profile} value={profile}>{profile}</option>)}
            </select>
          </label>
          <p className="text-sm text-stocklana-muted">Moeda de referência do planejamento: USD. Isto não é um saldo.</p>
          <button className="min-h-11 rounded-xl bg-stocklana-accent px-4 font-semibold text-stocklana-bg" type="submit">Continuar</button>
        </form>
      ) : null}
      {step === 1 ? (
        <section aria-label="Seleção de ativos">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Pesquisar<input className="mt-1 min-h-11 w-full rounded-lg border border-stocklana-border bg-stocklana-bg px-3" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
            <label className="text-sm">Categoria
              <select className="mt-1 min-h-11 w-full rounded-lg border border-stocklana-border bg-stocklana-bg px-3" value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="ALL">Todas</option>
                <option value="EQUITY">EQUITY</option>
                <option value="ETF">ETF</option>
                <option value="OTHER_RWA">OTHER_RWA</option>
              </select>
            </label>
          </div>
          <ul className="mt-3 space-y-2">
            {visible.map((asset) => {
              const view = presentAsset(asset);
              const checked = selected.includes(asset.assetId);
              return (
                <li key={asset.assetId} className="rounded-xl border border-stocklana-border p-3">
                  <label className="flex min-h-11 items-start gap-3">
                    <input type="checkbox" className="mt-1" checked={checked} aria-label={`Selecionar ${asset.ticker}`} onChange={() => setSelected((current) => checked ? current.filter((id) => id !== asset.assetId) : [...current, asset.assetId])} />
                    <span><span className="font-semibold">{asset.ticker}</span> · {asset.displayName}<span className="mt-1 block text-xs text-stocklana-muted">{view.researchLabel}. Evidência de mercado: {view.marketDataLabel}.</span></span>
                  </label>
                  <Link className="mt-2 inline-flex min-h-11 items-center text-sm text-stocklana-accent underline" href={assetPath(asset.assetId)}>Abrir detalhes</Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
      {step === 2 ? (
        <section aria-label="Alocação">
          {selected.length === 0 ? <p>Nenhum ativo selecionado.</p> : selected.map((id) => {
            const asset = assets.find((item) => item.assetId === id);
            return (
              <label key={id} className="mt-3 block text-sm">{asset?.ticker ?? id}
                <input inputMode="decimal" className="mt-1 min-h-11 w-full rounded-lg border border-stocklana-border bg-stocklana-bg px-3" value={weights[id] ?? ""} aria-label={`Peso de ${asset?.ticker ?? id}`} onChange={(event) => setWeights((current) => ({ ...current, [id]: event.target.value }))} />
              </label>
            );
          })}
          <p className="mt-3 text-sm" role="status">Soma: {Number.isFinite(review.total) ? review.total : 0}%</p>
          {review.errors.map((error) => <p key={error} className="text-sm text-amber-200">{error}</p>)}
          {review.warnings.map((warning) => <p key={warning} className="text-sm text-amber-200">{warning}</p>)}
        </section>
      ) : null}
      {step === 3 ? (
        <ul className="space-y-3" aria-label="Verificação dos ativos selecionados">
          {selected.map((id) => {
            const asset = assets.find((item) => item.assetId === id);
            if (!asset) return null;
            const view = presentAsset(asset);
            return <li key={id} className="rounded-xl border border-stocklana-border p-3 text-sm"><strong>{view.ticker}</strong><span className="mt-1 block">Identidade: {view.identityLabel}</span><span className="block">Dados de mercado: {view.marketDataLabel}</span><span className="block">Execução: {view.executionLabel}</span></li>;
          })}
        </ul>
      ) : null}
      {step === 4 ? (
        <section aria-label="Revisão" className="space-y-2 text-sm">
          <p>Nome: {name || "Não informado"}</p>
          <p>Objetivo: {objective || "Não informado"}</p>
          <p>Horizonte: {horizon || "Não informado"}</p>
          <p>Perfil declarado: {riskProfile || "Não declarado"}</p>
          <p>Moeda de referência: USD</p>
          <ul>{selected.map((id) => <li key={id}>{assets.find((asset) => asset.assetId === id)?.ticker}: {weights[id] || "0"}%</li>)}</ul>
          {review.errors.map((error) => <p key={error} className="text-amber-200">{error}</p>)}
          {review.warnings.map((warning) => <p key={warning} className="text-amber-200">{warning}</p>)}
          <button type="button" className="min-h-11 rounded-xl bg-stocklana-accent px-4 font-semibold text-stocklana-bg disabled:opacity-50" disabled={!review.valid} onClick={save}>Salvar rascunho local</button>
          {saved ? <p role="status">Rascunho local experimental salvo neste navegador. Não está sincronizado com a blockchain.</p> : null}
        </section>
      ) : null}
    </JourneyScreen>
  );
}

export function PortfolioRebalance({ assets }: { assets: readonly CatalogAsset[] }) {
  const [draft, setDraft] = useState<PortfolioDraft | null>(null);
  const [desired, setDesired] = useState<Record<string, string>>({});
  useEffect(() => {
    const stored = readDraft();
    setDraft(stored);
    if (stored) setDesired(Object.fromEntries(stored.assetIds.map((id) => [id, String(stored.weights[id] ?? "")])));
  }, []);
  if (!draft) {
    return (
      <JourneyScreen kicker="Simulador de composição" title="Ajustar Portfólio" lede="Não há composição planejada neste navegador. Nenhuma ordem é enviada daqui.">
        <JourneyNotice>Nenhum portfólio observado disponível. Você pode construir uma composição experimental e analisar sua alocação.</JourneyNotice>
        <Link className="text-sm text-stocklana-accent underline" href="/portfolio/build">Construir Portfólio</Link>
      </JourneyScreen>
    );
  }
  const desiredNumbers = Object.fromEntries(draft.assetIds.map((id) => [id, Number(desired[id] ?? "")]));
  const simulation = simulateRebalance(draft.assetIds, draft.weights, desiredNumbers);
  return (
    <JourneyScreen kicker="Simulador de composição" title="Ajustar Portfólio" lede="A coluna atual é o rascunho planejado, não uma posição observada. Esta tela não cria swap, autorização nem mandato.">
      <p className="text-sm" role="status">Estado: {simulation.state}. Base: {simulation.basis}.</p>
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Diferença entre a alocação planejada e a desejada</caption>
        <thead><tr><th className="py-2">Ativo</th><th>Planejado</th><th>Desejado</th><th>Diferença</th><th>Leitura</th></tr></thead>
        <tbody>
          {simulation.rows.map((row) => (
            <tr key={row.assetId} className="border-t border-stocklana-border">
              <td className="py-2">{assets.find((asset) => asset.assetId === row.assetId)?.ticker ?? row.assetId}</td>
              <td>{row.plannedPercent}%</td>
              <td><input className="min-h-11 w-24 rounded-lg border border-stocklana-border bg-stocklana-bg px-2" inputMode="decimal" aria-label={`Peso desejado de ${row.assetId}`} value={desired[row.assetId] ?? ""} onChange={(event) => setDesired((current) => ({ ...current, [row.assetId]: event.target.value }))} /></td>
              <td>{row.differencePercent}%</td>
              <td>{row.relation === "igual" ? "na meta" : `${row.relation} da meta desejada`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </JourneyScreen>
  );
}

function StateCard({ label, body }: { label: string; body: string }) {
  return <article className="rounded-xl border border-stocklana-border bg-stocklana-card p-4"><h2 className="font-mono text-xs tracking-widest text-stocklana-blue">{label}</h2><p className="mt-2 text-sm">{body}</p></article>;
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block text-sm">{label}<input className="mt-1 min-h-11 w-full rounded-lg border border-stocklana-border bg-stocklana-bg px-3" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}
