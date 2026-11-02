"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CatalogAsset } from "@/lib/asset-registry";
import { assetPath, presentAsset, type AssetPresentation } from "@/lib/asset-verification-view";
import { WATCHLIST_STORAGE_KEY, parseWatchlist } from "@/lib/portfolio-draft";
import { JourneyNotice, JourneyScreen } from "@/components/journey/journey-screen";

function readWatchlist(): string[] {
  try {
    return parseWatchlist(JSON.parse(window.localStorage.getItem(WATCHLIST_STORAGE_KEY) ?? "null"));
  } catch {
    return [];
  }
}

function writeWatchlist(assetIds: string[]) {
  window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify({ kind: "experimental-local-watchlist", assetIds }));
}

function StatusList({ view }: { view: AssetPresentation }) {
  return (
    <dl className="mt-2 space-y-1 text-sm">
      <div><dt className="inline font-semibold">Identidade: </dt><dd className="inline">{view.identityLabel}</dd></div>
      <div><dt className="inline font-semibold">Dados de mercado: </dt><dd className="inline">{view.marketDataLabel}</dd></div>
      <div><dt className="inline font-semibold">Execução: </dt><dd className="inline">{view.executionLabel}</dd></div>
    </dl>
  );
}

export function AssetVerification({ assets }: { assets: readonly CatalogAsset[] }) {
  return (
    <JourneyScreen kicker="Registro de pesquisa" title="Verificação de Ativos" lede="Identidade, dados de mercado e elegibilidade de execução são verificações separadas. Nenhuma delas é uma ordem de compra.">
      <JourneyNotice>Nenhum preço é consultado ao abrir esta página.</JourneyNotice>
      <ul className="space-y-3">
        {assets.map((asset) => {
          const view = presentAsset(asset);
          return (
            <li key={asset.assetId} className="rounded-xl border border-stocklana-border bg-stocklana-card p-4">
              <h2 className="text-lg font-semibold">{view.ticker} · {view.displayName}</h2>
              <p className="text-xs text-stocklana-muted">{view.assetId} · {view.researchLabel}</p>
              <StatusList view={view} />
              <Link className="mt-3 inline-flex min-h-11 items-center text-sm text-stocklana-accent underline" href={assetPath(asset.assetId)}>Abrir dossiê</Link>
            </li>
          );
        })}
      </ul>
    </JourneyScreen>
  );
}

export function AssetDossier({ asset }: { asset: CatalogAsset }) {
  const view = presentAsset(asset);
  return (
    <JourneyScreen kicker={view.researchLabel} title={`${view.ticker} · ${view.displayName}`} lede="Os campos abaixo vêm do Asset Registry. O que o registro não contém aparece como não disponível.">
      <StatusList view={view} />
      <section className="grid gap-3 sm:grid-cols-2" aria-label="Dossiê">
        <Fact label="Identificador" value={view.assetId} />
        <Fact label="Categoria" value={view.category} />
        <Fact label="Rede" value={view.network} />
        <Fact label="Mint" value={view.mint} />
        <Fact label="Programa de token" value={view.tokenProgram} />
        <Fact label="Símbolo de referência" value={view.referenceSymbol} />
        <Fact label="Origem dos dados" value={view.source} />
        <Fact label="Preço de referência" value="Não disponível" />
        <Fact label="Fonte do preço" value="Não disponível" />
        <Fact label="Horário de atualização" value="Não disponível" />
        <Fact label="Unidade monetária do preço" value="Não disponível" />
      </section>
      <section aria-label="Riscos" className="text-sm">
        <h2 className="font-semibold">Riscos conhecidos por ausência de dado</h2>
        <ul className="mt-2 list-disc pl-5 text-stocklana-muted">
          <li>Fonte de mercado não consultada nesta sessão.</li>
          {view.mint === "Não disponível" ? <li>Identidade de token não confirmada no registro.</li> : null}
          <li>Ativo não autorizado para execução nesta tela.</li>
        </ul>
      </section>
    </JourneyScreen>
  );
}

export function AssetCompare({ assets }: { assets: readonly CatalogAsset[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  function toggle(id: string) {
    setSelected((current) => {
      if (current.includes(id)) return current.filter((value) => value !== id);
      if (current.length >= 4) return current;
      return [...current, id];
    });
  }
  const chosen = selected.flatMap((id) => {
    const asset = assets.find((item) => item.assetId === id);
    return asset ? [presentAsset(asset)] : [];
  });
  return (
    <JourneyScreen kicker="Comparação" title="Comparar Ativos" lede="Selecione de dois a quatro ativos. Não há recomendação de compra.">
      <ul className="flex flex-wrap gap-2">
        {assets.map((asset) => (
          <li key={asset.assetId}>
            <label className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-stocklana-border px-3 text-sm">
              <input type="checkbox" checked={selected.includes(asset.assetId)} aria-label={`Comparar ${asset.ticker}`} onChange={() => toggle(asset.assetId)} />
              {asset.ticker}
            </label>
          </li>
        ))}
      </ul>
      {chosen.length < 2 ? <p className="text-sm text-stocklana-muted">Escolha ao menos dois ativos.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Comparação de campos disponíveis</caption>
            <thead><tr><th className="py-2">Campo</th>{chosen.map((view) => <th key={view.assetId}>{view.ticker}</th>)}</tr></thead>
            <tbody>
              {([
                ["category", "Categoria"],
                ["network", "Rede"],
                ["identityLabel", "Identidade"],
                ["marketDataLabel", "Evidências"],
                ["source", "Fonte dos dados"],
                ["executionLabel", "Elegibilidade"],
              ] as const).map(([field, label]) => (
                <tr key={field} className="border-t border-stocklana-border">
                  <th className="py-2 font-medium" scope="row">{label}</th>
                  {chosen.map((view) => <td key={view.assetId}>{view[field] || "Não disponível"}</td>)}
                </tr>
              ))}
              <tr className="border-t border-stocklana-border"><th className="py-2" scope="row">Preço</th>{chosen.map((view) => <td key={view.assetId}>Não disponível</td>)}</tr>
            </tbody>
          </table>
        </div>
      )}
    </JourneyScreen>
  );
}

export function AssetWatchlist({ assets }: { assets: readonly CatalogAsset[] }) {
  const [ids, setIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const known = new Set(assets.map((asset) => asset.assetId));
    setIds(readWatchlist().filter((id) => known.has(id)));
    setReady(true);
  }, [assets]);
  function update(next: string[]) {
    setIds(next);
    writeWatchlist(next);
  }
  return (
    <JourneyScreen kicker="Lista local" title="Lista de Observação" lede="A lista fica neste navegador. Não há alerta de preço nem monitoramento contínuo.">
      <JourneyNotice>Nenhum alerta está ativo. Não existe um serviço acompanhando estes ativos.</JourneyNotice>
      <ul className="space-y-2" aria-label="Ativos do registro">
        {assets.map((asset) => {
          const included = ids.includes(asset.assetId);
          return (
            <li key={asset.assetId} className="flex flex-wrap items-center gap-2">
              <button type="button" className="min-h-11 rounded-lg border border-stocklana-border px-3 text-sm" onClick={() => update(included ? ids.filter((id) => id !== asset.assetId) : [...ids, asset.assetId])}>{included ? `Remover ${asset.ticker}` : `Adicionar ${asset.ticker}`}</button>
              <Link className="inline-flex min-h-11 items-center text-sm text-stocklana-accent underline" href={assetPath(asset.assetId)}>Detalhes</Link>
            </li>
          );
        })}
      </ul>
      {ready ? (
        <ol aria-label="Ordem da lista">
          {ids.map((id, index) => (
            <li key={id} className="mt-2 flex items-center gap-2 text-sm">
              <span>{assets.find((asset) => asset.assetId === id)?.ticker}</span>
              <button type="button" className="min-h-11 px-2" disabled={index === 0} onClick={() => {
                const next = [...ids];
                [next[index - 1], next[index]] = [next[index], next[index - 1]];
                update(next);
              }}>Subir</button>
              <button type="button" className="min-h-11 px-2" disabled={index === ids.length - 1} onClick={() => {
                const next = [...ids];
                [next[index + 1], next[index]] = [next[index], next[index + 1]];
                update(next);
              }}>Descer</button>
            </li>
          ))}
        </ol>
      ) : null}
    </JourneyScreen>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return <article className="rounded-xl border border-stocklana-border p-3"><h2 className="text-xs uppercase tracking-wider text-stocklana-muted">{label}</h2><p className="mt-1 break-all text-sm">{value}</p></article>;
}
