"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CatalogProvider } from "@/lib/oracle-api";
import { OracleDataFlow } from "./oracle-data-flow";
import { OracleGlyph, isOracleGlyph } from "./oracle-glyphs";
import { oracleChoiceCopy } from "./oracle-selector-model";

export function OracleSelector() {
  const [providers, setProviders] = useState<CatalogProvider[]>([]);
  const [reason, setReason] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/oracles/catalog")
      .then(async (response) => {
        if (!response.ok) throw new Error("catalog unavailable");
        return response.json() as Promise<{ providers: CatalogProvider[] }>;
      })
      .then((body) => {
        if (!cancelled) setProviders(body.providers);
      })
      .catch(() => {
        if (!cancelled) setReason("The oracle catalog could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function choose(providerId: string): Promise<void> {
    setSelected(providerId);
    const response = await fetch("/api/subscriptions/entitlements", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ providerId, requestId: `browser-${providerId}` }),
    });
    const body = await response.json() as { error?: string; reasons?: string[] };
    if (!response.ok) {
      setReason(body.reasons?.join(" ") || body.error || "The server refused this provider.");
      return;
    }
    setReason(null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Oracle evidence</CardTitle>
        <CardDescription>The server chooses the plan. A control on this page cannot grant a provider.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <OracleDataFlow activeIds={providers.filter((provider) => provider.enabled).map((provider) => provider.id)} />
        <div
          aria-label="Oracle selection"
          className="max-h-44 overflow-y-scroll rounded-xl border border-white/10 bg-stocklana-bg/40"
        >
          {providers.map((provider) => (
            <button
              key={provider.id}
              type="button"
              disabled={!provider.enabled}
              onClick={() => void choose(provider.id)}
              className={`flex w-full items-center gap-3 border-b border-white/10 px-4 py-3 text-left last:border-b-0 disabled:opacity-60 ${selected === provider.id ? "bg-white/5" : ""}`}
            >
              <OracleGlyph
                id={isOracleGlyph(provider.id) ? provider.id : "engine"}
                className="h-11 w-11 shrink-0"
              />
              <span>
                <span className="font-medium text-white">{provider.id}</span>
                <span className="mt-1 block text-sm text-stocklana-muted">
                  {oracleChoiceCopy(provider, selected === provider.id ? reason : null)}
                </span>
              </span>
            </button>
          ))}
        </div>
        {reason ? <p className="text-sm text-stocklana-muted">{reason}</p> : null}
      </CardContent>
    </Card>
  );
}
