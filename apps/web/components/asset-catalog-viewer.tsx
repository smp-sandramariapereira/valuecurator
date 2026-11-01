"use client";

import { useMemo, useState } from "react";
import type { CatalogAsset } from "@/lib/asset-registry";

export function AssetCatalogViewer({ assets }: { assets: readonly CatalogAsset[] }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const filtered = useMemo(() => assets.filter((asset) =>
    [asset.ticker, asset.displayName, asset.assetId].some((part) =>
      part.toLowerCase().includes(query.toLowerCase().trim())
    )
  ), [assets, query]);
  function toggle(id: string) {
    setSelected((previous) => previous.includes(id) ? previous.filter((value) => value !== id) : [...previous, id]);
  }
  return (
    <main className="mx-auto max-w-5xl px-6 py-12 text-white">
      <header className="mb-8 space-y-3">
        <p className="text-sm uppercase tracking-widest text-teal-300">ProofGate / ICM Lab</p>
        <h1 className="text-3xl font-semibold">Multi-asset research catalog</h1>
        <p className="max-w-3xl text-sm leading-6 text-slate-300">
          Select reference assets for future research mandates. A ticker does not prove ownership,
          available liquidity, an issuer-approved token, or settlement eligibility.
        </p>
        <p className="rounded-lg border border-amber-700 bg-amber-950/30 p-3 text-sm text-amber-200" role="status">
          Research-only preview. No proposals, trades, Devnet mints or wallet signatures are created here.
          The existing AAPLx flow remains approval-only.
        </p>
      </header>
      <label className="block space-y-2">
        <span className="text-sm font-medium">Find a reference asset</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ticker, company or asset ID"
          className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-white"
        />
      </label>
      <section aria-label="Research asset candidates" className="mt-6 grid gap-3 sm:grid-cols-2">
        {filtered.map((asset) => (
          <label key={asset.assetId} className="flex cursor-pointer gap-3 rounded-xl border border-slate-700 bg-slate-900 p-4">
            <input
              type="checkbox" className="mt-1" checked={selected.includes(asset.assetId)}
              onChange={() => toggle(asset.assetId)}
              aria-label={`Select ${asset.ticker}`}
            />
            <span className="min-w-0 flex-1 space-y-1">
              <span className="block font-semibold">{asset.ticker} · {asset.displayName}</span>
              <span className="block text-xs text-slate-300">{asset.assetClass} · {asset.status.replaceAll("_", " ")}</span>
              <span className="block break-all text-xs text-slate-400">{asset.assetId}</span>
              <span className="block text-xs text-slate-400">{asset.mint ? "Mainnet mint documented; read-only" : "No verified token deployment"}</span>
              <span className="block text-xs text-slate-400">{asset.devnetMint ? "Devnet mint listed; not automatically enabled" : "No Devnet synthetic mint provisioned"}</span>
            </span>
          </label>
        ))}
      </section>
      {filtered.length === 0 && <p className="mt-5 text-slate-300">No matching asset in the curated catalog.</p>}
      <section className="mt-8 rounded-xl border border-slate-700 p-5" aria-live="polite">
        <h2 className="text-lg font-semibold">Research selection ({selected.length})</h2>
        <p className="mt-2 text-sm text-slate-300">
          {selected.length ? selected.map((id) => assets.find((asset) => asset.assetId === id)?.ticker).join(", ") : "No assets selected"}
        </p>
        <p className="mt-3 text-xs text-slate-400">This selection is local to this page. It is not saved as an investment mandate and grants no execution permission.</p>
      </section>
    </main>
  );
}
