# Navegação — arquitetura UX1

A navegação nova é uma camada. O header institucional, o botão de carteira e as páginas `/app`, `/assets` e `/lab` continuam sendo a implementação anterior.

## Onde a camada aparece

`ProductFrame` envolve o conteúdo do layout raiz somente quando o caminho começa por `/app`, `/assets`, `/lab`, `/portfolio`, `/research`, `/proofgate` ou `/activity`. Em `/`, `/about` e nas demais páginas institucionais, o frame devolve o conteúdo sem sidebar.

A configuração está em `apps/web/lib/product-navigation.ts`. Os componentes estão em `apps/web/components/navigation/`.

## Menu

| Grupo | Destino |
| --- | --- |
| Início | `/app` |
| Portfólio | `/portfolio`, `/portfolio/build`, `/portfolio/rebalance`, `/portfolio/mandates` |
| Ativos | `/assets`, `/assets/verify`, `/assets/compare`, `/assets/watchlist` |
| Inteligência | `/research`, `/research/evidence`, `/interview`, `/research/scenarios` |
| ProofGate | `/proofgate`, `/proofgate/policies`, `/proofgate/authorizations`, `/lab` |
| Atividade | `/activity`, `/activity/proposals`, `/activity/operations`, `/activity/receipts` |
| Conta | `/about`, `/subscribe` |

`/assets/[assetId]` mostra o dossiê. Os quatro identificadores do registro são gerados estaticamente. Um identificador fora do registro responde 404. A página de dossiê destaca o item Verificação.

O item ativo é o destino mais específico. `/assets` só fica ativo na própria página do catálogo, para não parecer ativo dentro de `/assets/verify`.

No desktop o menu pode ser recolhido. Em tela estreita ele abre por “Abrir navegação” e fecha com Escape ou ao seguir um link. Os grupos usam `aria-expanded`.

## O que não foi ligado

Não há redirect novo. Research Lab permanece em `/interview`. A carteira permanece onde já estava: dashboard, laboratório, entrevista e assinatura. Não foi criado um segundo botão de conexão.
