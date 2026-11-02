# ValueCurator — Validação C2.3

## 1. Identificação da execução

- Início UTC: `2026-11-02T13:47:18Z`
- Encerramento do registro: `2026-11-02T13:56:11Z`
- Repositório: `/home/aquila/darvin/valuecurator-feature-proofgate-multiasset-devnet-e2e`
- Branch: `feature/proofgate-multiasset-devnet-e2e`
- Commit: `0cd5ebb7bddb23594a5a9c141bfde2d627963ce0`
- Checkout `/home/aquila/valuecurator` não foi usado
- Ambiente: local, Surfpool offline em `127.0.0.1:18999`, sem deploy público e sem Mainnet

## 2. Estado inicial do Git

A árvore já continha alterações locais anteriores a este marco. Elas foram preservadas:

- `apps/web/README.md`
- `apps/web/app/layout.tsx`
- `apps/web/components/dashboard.tsx`
- `apps/web/components/home-button.tsx`
- `apps/web/public/valuecurator-logo.png`
- `apps/web/public/valuecurator-mark.png`
- `package-lock.json`
- `programs/settlement-lab-tests/package-lock.json`
- `docs/validation/` do Marco C2

HEAD permaneceu `0cd5ebb`. Nenhum commit foi criado.

## 3. Correções implementadas

- P2-01: a allowlist do verificador de segredos passou a nomear `.env.lab.example` e `apps/web/.env.lab.example`. `.env` real, `*-keypair.json`, `target/deploy` e qualquer outro `.env.*.example` continuam bloqueados. Exemplo aprovado com PEM ou array de 64 bytes continua reprovado pelo conteúdo.
- P2-02: o teste estreita `registry[0]` antes do spread. A checagem do mint verificado estreita `matching[0]` antes de ler `status` e `devnetMint`. A frase de rejeição e as comparações permanecem as mesmas.
- P2-03: a porta `43147` estava ocupada pelo Next.js pid `8984`, iniciado às `2026-11-02 09:04:20` no horário local, diretório `apps/web`. Esse processo foi preservado. Uma segunda instância falhou com `EADDRINUSE`.
- P2-04: `programs/settlement-lab-tests` entrou no workspace pnpm. `@solana/web3.js` resolve dentro deste checkout.
- P3-01: `POST /api/lab/authorize` com corpo inválido responde HTTP 400. `BLOCKED` e `AUTHORIZED` continuam HTTP 200.
- P3-02: o import nomeado `version` de `package.json` foi trocado pelo import default. O aviso desse import não reapareceu no build.

## 4. Arquivos modificados

Detalhados em `docs/validation/c2-3/ALTERACOES_C2_3.md`. O programa KAIROS e os Program IDs não foram alterados.

## 5. Resultado do security:check

- Comando: `pnpm security:check`
- Início/fim: `2026-11-02T13:50:37Z` / `2026-11-02T13:50:38Z`
- Código: 0
- Saída: `Tracked secret check passed (218 files inspected).`
- Testes novos do verificador: incluídos nos 10 testes de `pnpm --filter @valuecurator/web test:lab-http`, código 0

## 6. Resultado do typecheck

- Comando: `pnpm typecheck`
- Código: 0
- Duração: 23,46 s
- Os erros TS2322 e TS2532 não reapareceram

## 7. Testes do monorepo

| Comando | Código | Contagem | Duração |
| --- | ---: | --- | ---: |
| `pnpm test` | 0 | 13 aprovados, 0 reprovados | 8,04 s |
| `pnpm test:agent` | 105 aprovados, 0 reprovados, 0 ignorados | código 0 | 10,75 s |
| `pnpm build:web` | 0 | `Compiled successfully`; `BUILD_ID IAhIdeeqrHcoWtQdJG4nm` | 74,97 s |

O aviso de import nomeado `version` não apareceu. Permanecem avisos anteriores de ESLint em `market-refresh-provider.tsx` e `wallet-providers.tsx`, e a mensagem `bigint: Failed to load bindings`.

## 8. Authorization Service

- Comando: `pnpm --filter @valuecurator/proofgate-authorization-service test`
- Código: 0
- 18 aprovados, 0 reprovados, 0 ignorados
- Duração: 1,29 s
- Cobertura não instrumentada

## 9. Settlement Lab

- `cargo test -p proofgate-settlement-lab` em `programs/`: 6 aprovados, 0 reprovados, código 0, 1,72 s
- `cargo-build-sbf`: código 0, 1,14 s, compilação incremental em 0,61 s, sem aviso novo e sem estouro de stack nesta saída
- Artefato: `programs/target/deploy/proofgate_settlement_lab.so`, 399432 bytes

## 10. Surfpool

- Porta `18999` livre antes da suíte
- `node settlement-lab-tests/run.mjs`: 74 aprovados, 0 reprovados, código 0, 74,99 s
- A suíte encerrou o próprio Surfpool e a porta ficou livre
- Em seguida um Surfpool offline foi iniciado de novo para o teste manual: pid `22875`, `getHealth` = `ok`
- Provisionamento sem `--owner`, porque nenhum endereço público foi informado: código 0, 20,37 s
- Runtime daquela rodada: `programs/target/lab-runtime.json`, 866 bytes
- Program ID: `CJ2NA3E8ZWZFMjrLtzAKxGZNomLBP4Tvnh8hQiFD3ecA`
- Mint de entrada daquela rodada: `8raJvtXRxbDM3Ebh5Uwuebre6c9EUYLt7zrfdFwnYfAu`
- Mint de saída `lab:dAAPL` daquela rodada: `HQcJE5gLz4KRktBqnpBzB245KJqRcTeMhz2P7MMYVqFG`, `verificationStatus` `VERIFIED`, `synthetic` true
- Signatário público da política: `9xDpf4oQgJPa6d5mq2G13CokaYoMRn1mitBu7ZmVV4qW`

Atualização de `2026-11-02T14:06:23Z`, depois que o endereço público `CTgn…BKPU` foi informado:

- A primeira tentativa de `provision-lab.mjs --owner` no Surfpool pid `22875` falhou. A autoridade de upgrade do programa já implantado era `2wehaVUHsYjxUpsPMGVzWnwqbmumeVSmj1grnBer6fcb`, e o script gera um administrador local novo a cada execução.
- O Surfpool pid `22875` foi encerrado e outro foi iniciado com os mesmos argumentos locais. O processo atual é o pid `25043`. `getHealth` voltou `ok`.
- O provisionamento com `--owner` nesse processo limpo terminou com código 0.
- Runtime atual, também 866 bytes: entrada `ETNTRN7WS579TDQRWW65kDZ6epfAy7cGXRWJnckZx77G`, saída `5PvrrRGHUMnqiwrqd8xene59oYvLUepyGCsHCVz7x9Sv`, config `FJbW18soXnWuNSTDJuiytZFXLwGQo7NamN8bW6hh2B83`, pool `6Tji8ootCtxmCGJSzaX6a65sfvQLgw2kqGVoJQWPqTzR`.
- A carteira `CTgn…BKPU` tinha 2 000 000 000 lamports e 10 000 000 unidades-base do mint de entrada. O mint de saída estava em 0. Portfólio e mandato ainda não existiam.

Os processos locais encerraram depois dessa leitura. Um Surfpool novo, pid `6231`, e o Next pid `6509` foram iniciados, e a mesma carteira pública foi provisionada de novo. O runtime vigente passou a ser entrada `23xb6oDGDrQi5VU6ncpFpPRCUn3efzSAzwxuxymsjVzz` e saída `FnZg68f1Yvgj7K4qZhX5gtfH3poiRuZfJCeJQzQg6tft`. A página `/lab` mostra o par Synthetic dUSDC → Synthetic dAAPL, o RPC local e o próximo passo. A Phantom continua sem assinatura de portfólio, mandato ou swap.

## 11. API e interface

`apps/web/.env.local` foi criado a partir do exemplo, só com nomes de variáveis e caminhos. Não contém chave privada e está no `.gitignore`.

`pnpm --filter @valuecurator/web dev` não conseguiu escutar `43147` (`EADDRINUSE`). O processo antigo pid `8984` foi mantido. Depois da criação de `.env.local`, as rotas nesse processo responderam o laboratório configurado:

| Rota | HTTP | Observação |
| --- | ---: | --- |
| `GET /lab` | 200 | título ProofGate Lab |
| `GET /api/lab/config` | 200 | `surfpool-local`, RPC `http://127.0.0.1:18999`, program ID acima, política 1, epoch 1, `paused` false |
| `GET /api/lab/assets` | 200 | quatro ativos `RESEARCH_ONLY` e `lab:dAAPL` `LAB_VERIFIED` |
| `POST /api/lab/authorize` corpo `{}` | 200 | `BLOCKED`, `proof` null |
| `POST /api/lab/authorize` corpo `{` | 400 | `request body must be an object` |
| `POST` com valores inválidos | 200 | `BLOCKED`, `proof` null |
| `POST` com `Origin: https://evil.example` | 403 | origem rejeitada |

URL atual: `http://127.0.0.1:43147/lab`

Em `2026-11-02T14:07:10Z` o Next antigo, pids `8968` e `8984`, foi encerrado para o gateway reler o runtime novo. `pnpm --filter @valuecurator/web dev` passou a escutar a porta no pid `25392` e ficou pronto em 8,4 s.

Nova leitura, no processo limpo:

| Rota | HTTP | Observação |
| --- | ---: | --- |
| `GET /lab` | 200 | título ProofGate Lab |
| `GET /api/lab/config` | 200 | `surfpool-local`, RPC local, program ID inalterado, config `FJbW18soXnWuNSTDJuiytZFXLwGQo7NamN8bW6hh2B83`, política 1, epoch 1, `paused` false |
| `GET /api/lab/assets` | 200 | quatro ativos de pesquisa e `lab:dAAPL` com mint `5PvrrRGHUMnqiwrqd8xene59oYvLUepyGCsHCVz7x9Sv` |

A página aberta no navegador, depois do carregamento da API, mostrou rede `surfpool-local`, RPC `http://127.0.0.1:18999`, programa `CJ2NA3E8ZWZFMjrLtzAKxGZNomLBP4Tvnh8hQiFD3ecA`, config ativa e carteira desconectada. Os quatro ativos de pesquisa aparecem como `RESEARCH_ONLY`. O dAAPL aparece como `LAB_VERIFIED`. O botão `Request ProofGate decision` permanece desabilitado sem carteira.

Variáveis públicas:

```text
LAB_URL=http://127.0.0.1:43147/lab
LAB_RPC_URL=http://127.0.0.1:18999
LAB_PROGRAM_ID=CJ2NA3E8ZWZFMjrLtzAKxGZNomLBP4Tvnh8hQiFD3ecA
LAB_RUNTIME=programs/target/lab-runtime.json
```

## 12. Phantom

```text
NOT_EXECUTED
```

A extensão ainda não foi usada e nenhuma assinatura de carteira foi produzida. O ambiente para essa carteira está pronto. A classificação continua `NOT_EXECUTED`.

Para concluir no navegador onde a Phantom está instalada:

1. Na Phantom, apontar o RPC para `http://127.0.0.1:18999`. Se a carteira recusar o RPC local ou o blockhash, parar e copiar a mensagem. Não mudar para Mainnet e não fazer deploy público.
2. Abrir `http://127.0.0.1:43147/lab`.
3. Conectar a carteira `CTgn…BKPU`.
4. Clicar `Initialize portfolio` e aprovar as duas solicitações: a mensagem de autenticação e a transação.
5. Clicar `Initialize mandate` e aprovar a mensagem e a transação seguintes.
6. Manter Amount `1000` e Minimum output `1000`. Clicar `Request ProofGate decision` e aprovar só a mensagem de autenticação.
7. Conferir owner, valores e digest. Clicar `Sign with wallet and settle` e aprovar a transação do swap.
8. Esperar o recibo. Informar aqui apenas a assinatura pública da transação, o endereço público do recibo, o digest e os saldos mostrados.

Não informar seed, senha, chave privada nem a assinatura da mensagem de autenticação.

## 13. Testes negativos

| ID | O que foi exercitado agora | Classificação |
| --- | --- | --- |
| N01 sem carteira | ativos de pesquisa visíveis na página; `Request ProofGate decision` desabilitado; autorização sem campos válidos fica `BLOCKED` e sem `proof` | interface e HTTP executados |
| N02 ativo não verificado | suíte Surfpool `ativo não verificado não é assinado` | automatizado, 74/74 |
| N03 proposta inválida | HTTP 400 para corpo quebrado e HTTP 200 `BLOCKED` para campos inválidos | HTTP executado |
| N04 serviço indisponível | o servidor atual está configurado; o 503 sem runtime não foi repetido nesta rodada | não reexecutado |
| N05 autorização expirada | coberto pela suíte Surfpool | automatizado |
| N06 parâmetros alterados | coberto pela suíte Surfpool | automatizado |
| N07 carteira recusa | coberto pela suíte com keypair local, `phantom: false` | automatizado; recusa manual não executada |
| N08 sem Ed25519 | coberto pela suíte Surfpool | automatizado |
| N09 configuração pausada | coberto pela suíte Surfpool | automatizado |
| N10 RPC incorreto | origem estrangeira recebeu HTTP 403; o bloqueio de RPC no clique da página não foi exercitado | parcial |

## 14. Segurança e segredos

- `git ls-files` não lista `*-keypair.json`, `.env` cru nem `.pem`
- `.env.lab.example` continua sem material de chave; o teste de conteúdo passou
- Os chunks estáticos de `apps/web/.next/static` não contêm `LAB_POLICY_KEYPAIR`, `proofgate-policy-signer` nem `lab-runtime.json`
- O assinador continua em `apps/proofgate-authorization-service/src/node-gateway.mjs`, módulo de servidor
- Nenhum conteúdo de keypair, seed, cookie ou desafio reutilizável entrou nestes relatórios

## 15. Comparação com C2

| Verificação | C2 anterior | C2.3 atual |
| --- | --- | --- |
| Security check | FAILED | PASSED, código 0, 218 arquivos |
| Typecheck | FAILED | PASSED, código 0 |
| Testes gerais | 13/13 | 13/13 |
| Testes do agente | 105/105 | 105/105 |
| Authorization Service | 18/18 | 18/18 |
| Rust | 6/6 | 6/6 |
| Surfpool | 74/74 | 74/74 |
| Build web | PASSED | PASSED, sem o aviso de `version` |
| API laboratório | PASSED em 43148 | PASSED em 43147 no pid 25392, runtime da carteira `CTgn…BKPU` |
| Phantom manual | NOT_EXECUTED | NOT_EXECUTED; ambiente local preparado |

## 16. Falhas restantes

- A assinatura manual com Phantom não ocorreu. Conexão, portfólio, mandato, autorização e swap dependem da extensão.
- O build ainda emite avisos de ESLint e de binding `bigint`, fora do escopo desta correção.

## 17. Prontidão para Devnet

Não há prontidão para Devnet pública. Esta execução ficou em Surfpool offline. Nenhum deploy público foi feito.

## 18. Conclusão

`APPROVED_WITH_RESERVATIONS`

Os portões automatizados pedidos passaram nesta execução. Os critérios 9 a 15, da conexão Phantom até a reconciliação feita por essa carteira, continuam sem evidência. A classificação máxima permitida nesse caso é `APPROVED_WITH_RESERVATIONS`.
