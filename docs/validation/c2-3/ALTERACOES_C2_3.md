# Alterações do Marco C2.3

As mudanças abaixo foram feitas nesta sessão. O commit permanece `0cd5ebb`. Nada foi commitado.

## Alterações desta sessão

### `apps/web/scripts/check-no-tracked-secrets.mjs`

- Problema: `pnpm security:check` reprovava `.env.lab.example` pelo padrão de caminho `.env`.
- Causa: a allowlist só tinha `.env.example` e `agent/.env.example`.
- Alteração: inclusão explícita de `.env.lab.example` e `apps/web/.env.lab.example`. A checagem de PEM e de array de 64 bytes continua valendo para esses exemplos. Outros `.env*` e `*-keypair.json` continuam proibidos. As funções de caminho e conteúdo foram exportadas para teste.
- Teste: `apps/web/scripts/check-no-tracked-secrets.test.mjs` e `pnpm security:check`.
- Resultado: código 0, 218 arquivos inspecionados.
- Risco residual: um exemplo novo de ambiente continua bloqueado até entrar na allowlist pelo nome exato.

### `apps/web/scripts/check-no-tracked-secrets.test.mjs`

- Problema: o verificador não tinha regressão própria.
- Causa: o script só rodava contra o Git real.
- Alteração: testes de caminho proibido, exemplos nomeados, PEM e keypair dentro de exemplo, e leitura do `.env.lab.example` real.
- Teste: `pnpm --filter @valuecurator/web test:lab-http`.
- Resultado: parte dos 10 testes aprovados.
- Risco residual: o teste não cria um repositório Git temporário; ele exercita as funções puras e o arquivo real.

### `apps/web/agent/src/multiasset-proofgate.test.ts`

- Problema: TS2322 em `registry[0]` espalhado num registro que exige `assetId`.
- Causa: `noUncheckedIndexedAccess` faz `registry[0]` ser `RegistryRecord | undefined`, e o spread de `undefined` torna os campos opcionais.
- Alteração: leitura de `registry[0]` com retorno antecipado se o fixture estiver vazio, e spread só do registro presente. O status `CANDIDATE` permanece.
- Teste: `pnpm test:agent` e `pnpm typecheck`.
- Resultado: 105/105 e typecheck código 0.
- Risco residual: nenhum na regra de ativo. O caso de candidato não verificado continua exigindo a frase `verified Devnet`.

### `apps/web/agent/src/multiasset-proofgate.ts`

- Problema: TS2532 nas linhas 181 e 182.
- Causa: `matching[0]` pode ser indefinido para o compilador mesmo depois de `matching.length !== 1`.
- Alteração: `const verified = matching[0]` e a condição inclui `verified === undefined` antes de ler `status` e `devnetMint`. A mensagem `asset has no verified Devnet settlement mapping` não mudou.
- Teste: `pnpm test:agent`.
- Resultado: 105/105, incluindo os casos de candidato, ativo fora do mandato, slippage e teto diário.
- Risco residual: a política financeira não foi relaxada. Um array de tamanho 1 com buraco ainda cai na mesma rejeição.

### `apps/web/lib/lab-authorize-status.mjs`

- Problema: corpo malformado voltava HTTP 200.
- Causa: a rota só promovia os status 413 e 429; o 400 ficava no corpo.
- Alteração: função que devolve 400, 413 ou 429 quando o gateway manda esse status numérico, 503 quando a decisão é `ERROR`, e 200 para `BLOCKED` e `AUTHORIZED`.
- Teste: `apps/web/lib/lab-authorize-status.test.mjs` e a sonda HTTP em `43147`.
- Resultado: corpo `{` respondeu HTTP 400; proposta inválida respondeu HTTP 200 `BLOCKED`.
- Risco residual: status numérico fora de 400, 413 e 429 continua caindo em 200 ou 503, conforme a decisão.

### `apps/web/lib/lab-authorize-status.test.mjs`

- Problema: não havia teste da correspondência HTTP.
- Causa: a rota Next não tinha runner próprio.
- Alteração: testes da função de status e da rejeição de origem via `assertSameOrigin`.
- Teste: `pnpm --filter @valuecurator/web test:lab-http`, 10 aprovados.
- Resultado: código 0.
- Risco residual: o teste da origem chama a função do serviço, e a sonda HTTP confirma o 403 da rota.

### `apps/web/app/api/lab/authorize/route.ts`

- Problema: o mesmo HTTP 200 do corpo inválido.
- Causa: o status do gateway era descartado, exceto 413 e 429.
- Alteração: a resposta usa `labAuthorizeHttpStatus`.
- Teste: sonda `POST /api/lab/authorize` com `{`.
- Resultado: HTTP 400.
- Risco residual: o processo que atendeu a sonda é o Next antigo, pid 8984, depois de carregar `.env.local`.

### `apps/web/package.json`

- Problema: os testes novos não tinham comando.
- Causa: o pacote web não executava `node --test` nesses arquivos.
- Alteração: script `test:lab-http`.
- Teste: o próprio script.
- Resultado: código 0.
- Risco residual: `pnpm test` da raiz continua sendo só a discovery API. O comando novo precisa ser chamado à parte.

### `apps/web/components/dashboard.tsx`

- Problema: aviso de build no import nomeado `version`.
- Causa: o bundler trata `package.json` como export default.
- Alteração desta sessão: `import webPackage from "../package.json"` e uso de `webPackage.version`.
- Teste: `pnpm build:web`.
- Resultado: `Compiled successfully`, sem o aviso de named export.
- Risco residual: o arquivo já estava modificado antes deste marco. O diff também contém o trabalho anterior de logo e texto. Esse trabalho não foi reescrito.

### `apps/web/components/institutional/site-header.tsx`

- Problema: o mesmo import nomeado `version`.
- Causa: a mesma.
- Alteração: import default e `webPackage.version`.
- Teste: `pnpm build:web`.
- Resultado: o aviso não reapareceu.
- Risco residual: nenhum no conteúdo do cabeçalho.

### `apps/web/components/institutional/about-index.tsx`

- Problema: o mesmo import, na página About.
- Causa: a mesma.
- Alteração: import default e `webPackage.version`.
- Teste: `pnpm build:web` compilou a rota `/about`.
- Resultado: sem o aviso de named export.
- Risco residual: nenhum no texto da página.

### `pnpm-workspace.yaml` e `pnpm-lock.yaml`

- Problema: `programs/settlement-lab-tests` ficava fora do workspace.
- Causa: o workspace listava só `apps/*`, `apps/web/agent` e `packages/*`.
- Alteração: entrada `programs/settlement-lab-tests`. O lockfile foi atualizado com `pnpm install --no-frozen-lockfile` e depois conferido com `CI=true pnpm install --frozen-lockfile`, código 0.
- Teste: resolução de `@solana/web3.js` a partir do `package.json` da suíte, dentro deste repositório, e `node settlement-lab-tests/run.mjs`.
- Resultado: 74/74.
- Risco residual: o aviso de peer `utf-8-validate` em `jayson/ws` permanece. O `package-lock.json` solto da suíte, já não rastreado antes, não foi apagado.

### `apps/web/.env.local`

- Problema: o arquivo não existia, e o servidor precisa dos caminhos do laboratório.
- Causa: só havia `.env.lab.example`.
- Alteração: cópia dos nomes e caminhos do exemplo. Nenhuma chave privada foi escrita.
- Teste: `GET /api/lab/config` retornou `surfpool-local` e o program ID.
- Resultado: HTTP 200.
- Risco residual: o arquivo é gitignored. Outro clone precisa criá-lo de novo. O pid 8984 foi encerrado depois e o dev atual, pid 25392, leu o runtime da carteira informada.

## Preservado e não atribuído ao C2.3

Estes itens já estavam sujos ou não rastreados no início da sessão e não foram revertidos:

- `apps/web/README.md`
- `apps/web/app/layout.tsx`
- `apps/web/components/home-button.tsx`
- parte anterior de `apps/web/components/dashboard.tsx`
- `apps/web/public/valuecurator-logo.png`
- `apps/web/public/valuecurator-mark.png`
- `package-lock.json`
- `programs/settlement-lab-tests/package-lock.json`
- `docs/validation/VALIDACAO_C2.md`, `RESULTADOS_C2.json`, `EXECUCAO_C2.log`, `PENDENCIAS_C2.md` e `docs/validation/raw/`

O diretório `programs/` do contrato KAIROS e o Program ID do Settlement Lab não entraram no diff.

## Preparação operacional de 2026-11-02T14:05Z

Nenhum arquivo de código foi alterado nesta etapa.

- Problema: o Surfpool já em execução tinha o programa implantado com outra autoridade de upgrade, e o Next pid 8984 guardava o runtime anterior.
- Causa: `provision-lab.mjs` cria um administrador local novo e faz deploy. O ledger antigo não aceitou essa autoridade.
- Alteração: o Surfpool pid 22875 foi encerrado e outro foi iniciado, pid 25043, com os mesmos argumentos locais. O provisionamento com o endereço público informado terminou com código 0. Os pids 8968 e 8984 foram encerrados e o dev subiu de novo no pid 25392.
- Teste: saldos da carteira no RPC local e HTTP 200 de `/lab`, `/api/lab/config` e `/api/lab/assets`. A página mostrou o mint novo e o botão de decisão desabilitado sem carteira.
- Resultado: ambiente pronto. Phantom continua `NOT_EXECUTED`.
- Risco residual: um novo provisionamento troca os mints e exige outro reinício do Next. A Phantom ainda pode recusar o RPC local.

## Guia da página `/lab`

- Arquivo: `apps/web/components/proofgate-lab.tsx`, `apps/web/lib/lab-progress.mjs`, `apps/proofgate-authorization-service/src/gateway.mjs`.
- Problema: a página não nomeava o token de entrada nem dizia qual assinatura a Phantom pediria.
- Causa: o mint de entrada só aparecia depois do mandato, e o progresso da carteira não era calculado.
- Alteração: rótulo Synthetic dUSDC, par com os dois mints, RPC local e cinco passos. O mandato passa a informar se o portfólio já existe. A política de autorização não mudou.
- Teste: `node --test lib/lab-progress.test.mjs lib/lab-authorize-status.test.mjs`, 12/12. Authorization Service, 18/18. A página em `http://127.0.0.1:43147/lab` mostrou o par, os mints novos e o passo “Connect the wallet”.
- Resultado: o botão de decisão permanece desabilitado sem carteira.
- Risco residual: os nomes são rótulos da página. A Phantom continua mostrando o mint.
