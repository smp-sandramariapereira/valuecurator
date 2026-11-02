"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { JourneyNotice, JourneyScreen } from "@/components/journey/journey-screen";

type LabConfig = {
  ok?: boolean;
  network?: string;
  programId?: string;
  paused?: boolean;
  policyVersion?: string;
  authorizationEpoch?: string;
};

export function MandateAccess() {
  const [config, setConfig] = useState<LabConfig | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/lab/config", { signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<LabConfig> : null)
      .then((body) => { if (body?.ok) setConfig(body); })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);
  return (
    <JourneyScreen kicker="Settlement Lab" title="Meus Mandatos" lede="Esta página não cria nem altera mandatos. A inicialização continua no laboratório, assinada pela carteira.">
      <JourneyNotice>Mandatos experimentais do Settlement Lab.</JourneyNotice>
      {config ? (
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-stocklana-muted">Rede</dt><dd>{config.network}</dd></div>
          <div><dt className="text-stocklana-muted">Programa</dt><dd className="break-all">{config.programId}</dd></div>
          <div><dt className="text-stocklana-muted">Política</dt><dd>{config.policyVersion}</dd></div>
          <div><dt className="text-stocklana-muted">Epoch</dt><dd>{config.authorizationEpoch}</dd></div>
          <div><dt className="text-stocklana-muted">Pausa</dt><dd>{config.paused ? "pausado" : "não pausado"}</dd></div>
        </dl>
      ) : <p className="text-sm text-stocklana-muted">A configuração local do laboratório não está disponível nesta sessão. Limites, gastos e prazos de um mandato só aparecem depois que a carteira os grava em /lab.</p>}
      <p className="text-sm text-stocklana-muted">Proprietário, pool, ativos, limites e gastos não são presumidos a partir desta tela.</p>
      <Link className="inline-flex min-h-11 items-center text-sm text-stocklana-accent underline" href="/lab">Abrir o laboratório</Link>
    </JourneyScreen>
  );
}
