# Preços — linha de base

Registro de `2026-11-02T15:15:56Z`. Nenhuma credencial foi lida ou impressa.

## Fluxo anterior

`POST /api/market/refresh` com `scenario: "live"` chamava `refreshMarketEvidence`, que chamava `fetchPythProPrice` antes de qualquer outra fonte.

A rota exigia, sem alternativa:

- `KAIROS_PYTH_FEED_ID`
- `KAIROS_PYTH_API_KEY`

O dashboard mostrava `Refresh failed: Missing configuration: KAIROS_PYTH_FEED_ID`. Os números de $343,44 vinham de `createMarketSimulation` e já estavam marcados como simulação.

## Módulos que exigiam Pyth

- `apps/web/app/api/market/refresh/route.ts` lia as duas variáveis Pyth em todo refresh ao vivo.
- `apps/web/agent/src/market-refresh.ts` importava só `fetchPythProPrice`.
- `apps/web/agent/src/pyth-evidence.ts` gravava `source: "pyth-pro"` em toda evidência produzida por `createLivePythEvidence`.
- `apps/web/components/market-evidence-card.tsx` dizia “Querying Pyth, xStocks and Jupiter” e rotulava qualquer dado não simulado como `LIVE PYTH PRO`.

## Arquitetura que já existia e não era usada pelo refresh

`apps/web/agent/src/oracle/` já registra cinco provedores. `oracle-selector.ts` só aceita o identificador pedido. `oracle-manager.ts` coleta evidência admissível. `OracleEvidenceV2` em `packages/oracle-contracts` já carrega provedor, feed, preço, confiança, horário e proveniência.

`KAIROS_ORACLE_PROVIDER` existia no agente. Quando ausente, `config.ts` e `check-market.ts` ainda assumem `pyth-pro` para o caminho de linha de comando. Esse padrão não foi copiado para o dashboard.

## Provedores no registro

| Provedor | Implementação | Habilitado | Credencial | AAPLx |
| --- | --- | --- | --- | --- |
| pyth-pro | adaptador sobre o REST Pro, feed numérico, confiança e USD | sim | `KAIROS_PYTH_API_KEY` | feed documentado `922` |
| pyth-hermes | adaptador sobre o Hermes, feed hexadecimal, confiança e USD | sim | não | feed público documentado em outro texto, não configurado aqui |
| chainlink | lança erro de desabilitado | não | exigiria credencial | não comprovado |
| switchboard | lança erro de desabilitado | não | exigiria credencial | não comprovado |
| redstone | lança erro de desabilitado | não | exigiria credencial | não comprovado |
