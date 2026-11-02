# Navegação — linha de base

Registro antes da camada UX1. Checkout `/home/aquila/darvin/valuecurator-feature-proofgate-multiasset-devnet-e2e`, branch `feature/proofgate-multiasset-devnet-e2e`, HEAD `c157c810dc36fb874763e14f8234b974c3491838`. O commit citado na validação C2, `0cd5ebb7bddb23594a5a9c141bfde2d627963ce0`, é ancestral deste HEAD. Há alterações locais de preços e documentação que não foram descartadas. O outro checkout `/home/aquila/valuecurator` não foi usado.

## Navegação atual

O layout raiz (`apps/web/app/layout.tsx`) renderiza `SiteHeader` e o conteúdo. Não existe sidebar.

`SiteHeader` aparece em todas as páginas. Fora das páginas institucionais, ele mostra o logo (`HomeButton`), o link `ProofGate Lab` para `/lab`, o link `About` para `/about` e a versão. Nas rotas `/about`, `/technology`, `/solutions`, `/journey`, `/team`, `/roadmap`, `/partners` e `/pitchdeck`, o header troca para os links de `NAV_LINKS` em `apps/web/lib/institutional.ts`.

A carteira não está no header. `WalletConnectButton` é usado por `dashboard.tsx` (`/app`), `proofgate-lab.tsx` (`/lab`), `discovery-interview.tsx` (`/interview`) e `subscription-card.tsx` (`/subscribe`).

O dashboard em `/app` troca de vista por query `view`: `overview`, `mandate`, `gate`, `audit` (`apps/web/lib/dashboard-navigation.ts`). Isso não é uma rota separada.

## Rotas existentes

| Rota | Função |
| --- | --- |
| `/` | Página institucional inicial |
| `/app` | Dashboard KAIROS, mandato visual, evidência de mercado e proposta |
| `/assets` | Catálogo de pesquisa |
| `/lab` | Settlement Lab local |
| `/about`, `/technology`, `/solutions`, `/journey`, `/team`, `/roadmap`, `/partners`, `/pitchdeck` | Conteúdo institucional |
| `/interview`, `/interview/analysis` | Entrevista de descoberta |
| `/subscribe` | Assinatura |
| `/discovery` | Redireciona para `/interview` |

APIs preservadas: `/api/lab/*`, `/api/market/refresh`, `/api/oracles/catalog`, `/api/subscriptions/entitlements`, `/api/mandates/validate`.

## O que não pode regredir

Phantom e o botão de carteira, o dashboard e as vistas por query, o fluxo AAPLx de evidência, o Asset Registry, o Research Lab visual do catálogo, as políticas do dashboard, o Authorization Service, Ed25519, nonce, epoch, mandatos, limites, Settlement Lab, recibos, reconciliação, leitura Mainnet e os testes de segurança.

Componentes compartilhados e quem os usa:

- `app/layout.tsx`: todas as páginas. A alteração permitida é envolver o conteúdo com uma moldura que não muda as rotas institucionais.
- `site-header.tsx`: todas as páginas. Não será editado.
- `wallet-connect-button.tsx`: `/app`, `/lab`, `/interview`, `/subscribe`. Não será editado.
- `dashboard.tsx`: somente `/app`. Pode receber um painel de atalhos, sem mudar a lógica das vistas.
- `asset-catalog-viewer.tsx`: somente `/assets`. Não será editado.
- `proofgate-lab.tsx`: somente `/lab`. Não será editado.

## Componentes e identidade reutilizáveis

Cores `stocklana` em `tailwind.config.ts`, fontes Geist e JetBrains Mono, `Button`, `Card`, `Badge`, ícones `lucide-react`. O catálogo vem de `apps/web/lib/asset-registry.ts` e `apps/web/data/asset-catalog.json`. Não há banco de portfólio nem histórico persistido de propostas fora da sessão do laboratório.

## Rotas novas

`/portfolio`, `/portfolio/build`, `/portfolio/rebalance`, `/portfolio/mandates`, `/assets/verify`, `/assets/compare`, `/assets/watchlist`, `/assets/[assetId]`, `/research`, `/research/evidence`, `/research/scenarios`, `/proofgate`, `/proofgate/policies`, `/proofgate/authorizations`, `/activity`, `/activity/proposals`, `/activity/operations`, `/activity/receipts`.

`/assets/verify`, `/assets/compare` e `/assets/watchlist` são segmentos estáticos e não colidem com `/assets/[assetId]`. Não existe rota dinâmica anterior em `/assets`.

## Conflitos evitados

A sidebar não substitui o header, o dashboard nem o laboratório. Research Lab continua em `/interview`. O item de laboratório aponta para `/lab`. Não há redirect novo. Nenhuma API paga é chamada ao abrir as páginas novas. Rascunhos ficam no `localStorage` do navegador, marcados como experimentais e fora da blockchain.

## Estratégia

Criar a configuração e os componentes em `apps/web/components/navigation/` e a lógica de apresentação em `apps/web/lib/`. As páginas novas só leem o catálogo e, na página de mandatos, a API de configuração já existente. O layout raiz ganha a moldura apenas quando o caminho é de produto: `/app`, `/assets`, `/lab`, `/portfolio`, `/research`, `/proofgate`, `/activity`.
