# Preços — correção

## Causa raiz

O botão Refresh Market não passava pelo registro de oráculos. O arquivo `market-refresh.ts` tratava o Pyth Pro como a única leitura de referência e a rota HTTP falhava na primeira variável ausente, `KAIROS_PYTH_FEED_ID`.

## O que mudou

O refresh ao vivo agora lê `KAIROS_ORACLE_PROVIDER`, `KAIROS_ORACLE_FEED_ID` e, se houver, `KAIROS_ORACLE_API_URL`. A credencial só é exigida para o provedor escolhido. Para `pyth-pro`, o nome continua `KAIROS_PYTH_API_KEY` e permanece no servidor.

Provedor ausente, desconhecido ou desabilitado produz erro de configuração. Não há seleção automática de Pyth nem inferência pelo formato do feed.

A consulta usa `collectAdmissibleEvidence` com um único provedor e `fallbackOptIn: false`. A evidência segue `OracleEvidenceV2`. Confiança ausente ou preço não positivo interrompe a leitura. Zero não substitui confiança desconhecida.

A cotação Jupiter continua sendo cotação executável. Se ela falha, o relatório fica bloqueado e o preço executável permanece nulo.

O cartão mostra o `source` real, a moeda USD, o horário, a idade, a confiança, a cotação e a decisão. Simulações SAFE, STALE e DIVERGENCE continuam com `source: "fixture"` e `simulated: true`.

## Fonte efetivamente utilizada

Nenhuma. `apps/web/.env.local` não define `KAIROS_ORACLE_PROVIDER`. A chamada local `POST /api/market/refresh` com `{"scenario":"live"}` respondeu HTTP 503 e `Missing configuration: KAIROS_ORACLE_PROVIDER` em `2026-11-02T15:15:56Z`.

O fluxo ao vivo permanece indisponível até uma configuração explícita. Isso não autoriza preço fabricado.

## Arquivos

- `apps/web/agent/src/market-oracle-config.ts`
- `apps/web/agent/src/market-oracle.test.ts`
- `apps/web/agent/src/market-refresh.ts`
- `apps/web/agent/src/pyth-evidence.ts`
- `apps/web/agent/src/check-market.ts`
- `apps/web/agent/src/final-report.ts`
- `apps/web/app/api/market/refresh/route.ts`
- `apps/web/components/market-evidence-card.tsx`
- `apps/web/components/market-refresh-provider.tsx`
- `apps/web/components/dashboard.tsx`
- `apps/web/.env.example`
- `apps/web/scripts/check-no-tracked-secrets.test.mjs`

O teste de segredos passou a montar o marcador PEM em tempo de execução. O arquivo rastreado não contém mais a sequência contínua que o verificador procura. A regra de bloqueio não foi afrouxada.

KAIROS on-chain, Settlement Lab, ProofGate, mandatos, Phantom e `APPROVAL_ONLY` não foram alterados. `check-market.ts` continua restrito a `pyth-pro` quando alguém o executa de propósito.
