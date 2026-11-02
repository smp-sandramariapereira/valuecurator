# Pendências C2.3

Registro de `2026-11-02T13:56:11Z`.

## P1-01 — Phantom manual ainda não executada

- Prioridade: P1
- Descrição: não houve conexão, assinatura de portfólio, assinatura de mandato nem swap pela extensão.
- Evidência: `phantom.status` = `NOT_EXECUTED`. Em `2026-11-02T14:06:23Z` o provisionamento com o endereço público `CTgn…BKPU` concluiu. A página em `http://127.0.0.1:43147/lab` mostra o runtime novo e o botão de decisão desabilitado sem carteira.
- Impacto: os critérios 9 a 15 do marco continuam abertos. A classificação máxima desta execução é `APPROVED_WITH_RESERVATIONS`.
- Recomendação: na Phantom, usar o RPC `http://127.0.0.1:18999`, conectar essa carteira, inicializar portfólio e mandato, autorizar e assinar o swap. Não enviar seed nem chave privada.
- Arquivos relacionados: `apps/web/components/proofgate-lab.tsx`, `programs/settlement-lab-tests/provision-lab.mjs`
- Estado: aberta. O ambiente local está preparado.

## P2-01 — Processo antigo na porta documentada

- Prioridade: P2
- Descrição: pid `8984`, `next-server`, iniciado às 09:04:20 no horário local, escutava `127.0.0.1:43147`.
- Evidência: `docs/validation/c2-3/raw/web-dev.log` e `docs/validation/c2-3/raw/web-dev-restart.log`.
- Ação: em `2026-11-02T14:07:10Z` os pids `8968` e `8984` deste checkout foram encerrados. O dev novo subiu no pid `25392`.
- Estado: fechada.

## P3-01 — Avisos restantes do build

- Prioridade: P3
- Descrição: o aviso do import `version` sumiu. O build ainda avisa dependência de `useMemo` em `market-refresh-provider.tsx`, uso de `<img>` em `wallet-providers.tsx`, e `bigint: Failed to load bindings`.
- Evidência: `docs/validation/c2-3/raw/build-web.log`, código 0.
- Impacto: não impede o build.
- Recomendação: tratar esses avisos numa mudança própria de interface.
- Arquivos relacionados: `apps/web/components/market-refresh-provider.tsx`, `apps/web/components/wallet-providers.tsx`
- Estado: aberta

## P3-02 — Logs fora do Git

- Prioridade: P3
- Descrição: `.gitignore` ignora `*.log`. `EXECUCAO_C2_3.log` e `docs/validation/c2-3/raw/*.log` ficam no disco e fora do `git status`.
- Evidência: mesma regra já registrada no C2.
- Impacto: um commit comum não leva o log. O Markdown e o JSON deste diretório entram como arquivos novos.
- Recomendação: versionar uma exceção se a evidência de log precisar ir no histórico.
- Arquivos relacionados: `.gitignore`, `docs/validation/c2-3/EXECUCAO_C2_3.log`
- Estado: aberta
