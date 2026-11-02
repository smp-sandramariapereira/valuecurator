# UX1 — validação

Data: 2026-11-02. Checkout `feature/proofgate-multiasset-devnet-e2e`, HEAD `c157c810dc36fb874763e14f8234b974c3491838` mais as alterações locais. Nenhum commit, push ou deploy.

## Testes

| Comando | Resultado | Classificação |
| --- | --- | --- |
| `pnpm --filter @valuecurator/web test:ux` | 5/5 | desta implementação |
| `pnpm security:check` | 225 arquivos, passou | sem regressão |
| `pnpm test` | 13/13 | sem regressão |
| `pnpm test:agent` | 117/117 | sem regressão |
| `pnpm typecheck` | passou | sem regressão |
| Authorization Service `node --test test/*.test.mjs` | 18/18 | sem regressão |
| `pnpm build:web` | passou, exit 0, rotas novas incluídas | sem regressão; o `next dev` simultâneo respondeu 500 até ser reiniciado |

A suíte Surfpool `programs/settlement-lab-tests/run.mjs` não foi executada. Ela sobe outro ledger na porta 18999 e apagaria o laboratório local que já está no ar para o teste manual. `cargo test` do programa também não foi repetido nesta etapa.

## Interface

Nesta execução, o navegador percorreu o fluxo em `127.0.0.1:43147`.

- Em largura estreita, `Abrir navegação` mostrou Início, Portfólio, Ativos, Inteligência, ProofGate e Atividade. Escape e o botão de fechar continuam no componente.
- Em 1280 px, a sidebar fica visível e `Verificação de Ativos` recebe `aria-current`.
- O construtor salvou o rascunho local `Estudo local`, MSFT 40% e AAPL 60%, com alerta de concentração. A soma inválida já tinha sido recusada antes dos pesos finais.
- `/portfolio/rebalance` leu esse rascunho como `SIMULATED` e `PLANEJADO`.
- `/app` responde 307 para `/`, redirecionamento que já existia. A sidebar agora acompanha `/`, que é o dashboard real.
- `/assets`, `/lab`, `/interview` e `/about` responderam 200. O catálogo e o laboratório não foram substituídos.

Durante `pnpm build:web` o servidor de desenvolvimento chegou a responder 500 em `/assets/verify` porque os dois processos usam `.next`. Depois do reinício, a mesma rota voltou a 200. Isso não é ausência de página: o build lista `/assets/verify` e os quatro dossiês.

## Preservação

Não foram editados KAIROS on-chain, Settlement Lab, Authorization Service, contratos, oráculos, `market-refresh.ts`, `market-data.ts` nem `multiasset-proofgate.ts`. O header e o botão de carteira não foram reimplementados.

## Limitações

Não há posição observada, histórico persistido de propostas nem preço consultado nas páginas novas. O rascunho e a watchlist existem só no navegador. A execução continua nas telas que já a implementavam.
