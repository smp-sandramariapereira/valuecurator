# ValueCurator — Relatório de Validação do Marco C2

## 1. Identificação

- Data e hora UTC: início `2026-11-02T12:17:09Z`, encerramento `2026-11-02T12:33:28Z`
- Repositório executado: `/home/aquila/darvin/valuecurator-feature-proofgate-multiasset-devnet-e2e`
- Repositório citado no pedido: `/home/aquila/valuecurator` (outro checkout, branch `main`, commit `79e4336`; não foi usado)
- Branch: `feature/proofgate-multiasset-devnet-e2e`
- Commit: `0cd5ebb7bddb23594a5a9c141bfde2d627963ce0` (`0cd5ebb Add the local ProofGate boundary between review and settlement.`)
- Ambiente: Linux local, Surfpool offline em `127.0.0.1`, sem deploy em Devnet pública e sem Mainnet
- Árvore de trabalho no início, preservada: alterações locais em `apps/web/README.md`, `apps/web/app/layout.tsx`, `apps/web/components/dashboard.tsx`, `apps/web/components/home-button.tsx`, mais arquivos não rastreados de logo e `package-lock.json`. Nenhuma delas foi descartada. O motor KAIROS não entrou nesse conjunto.

## 2. Resumo executivo

- Estado geral: a fronteira local de autorização e liquidação do Marco C2 foi exercitada com sucesso no Surfpool offline. O fluxo completo de usuário com Phantom não foi executado.
- Testes aprovados, por suíte, sem somar tipos diferentes:
  - `pnpm test` no host: 13 aprovados, 0 reprovados
  - `pnpm test:agent`: 105 aprovados, 0 reprovados
  - Authorization Service: 18 aprovados, 0 reprovados
  - `cargo test -p proofgate-settlement-lab`: 6 aprovados, 0 reprovados
  - Surfpool `settlement-lab-tests/run.mjs`: 74 aprovados, 0 reprovados
- Testes reprovados dentro dessas suítes: 0
- Comandos de verificação reprovados: `pnpm security:check` (código 1) e `pnpm typecheck` (código 2)
- Testes não executados: assinatura manual com Phantom; criação de portfólio e mandato assinados pela carteira do usuário; liquidação disparada pelo botão da interface
- Bloqueadores: a extensão Phantom não está injetada neste navegador; a porta documentada `43147` já estava ocupada por um Next.js sem as variáveis do laboratório

O Marco C2 não está integralmente aprovado. A ressalva decisiva é a ausência da assinatura manual com Phantom.

## 3. Ferramentas

| Ferramenta | Versão | Estado |
| --- | --- | --- |
| Node.js | v20.20.2 | presente |
| pnpm | 9.15.9 | presente |
| rustc | 1.97.1 (8bab26f4f 2026-07-14) | presente |
| cargo | 1.97.1 (c980f4866 2026-06-30) | presente |
| solana-cli | 3.1.10 (src:7bc9c805; feat:1620780344, client:Agave) | presente |
| surfpool | 1.5.0 | presente |
| cargo-build-sbf | solana-cargo-build-sbf 3.1.10, platform-tools v1.52, rustc 1.89.0 | presente |
| SVM reportada pela suíte | solanaCore 4.1.2 | observada em `programs/target/surfpool-results.json` |

## 4. Dependências

| Verificação | Resultado | Evidência |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` no sandbox | fetch ao registry falhou (`ERR_PNPM_META_FETCH_FAIL`) após 60,61 s | primeira tentativa, 2026-11-02T12:17:59Z |
| Mesmo comando com rede, `CI=true` | sucesso, código 0, 4,20 s, 816 pacotes, lockfile atual | 2026-11-02T12:19:19Z a 2026-11-02T12:19:23Z |
| `@valuecurator/proofgate-authorization-service` no workspace | integrado em `apps/*` | `pnpm list -r --depth -1` |
| `@solana/web3.js` no app web | declarado como `^1.99.0` e resolvido para 1.99.0 dentro de `node_modules/.pnpm` deste checkout | `require.resolve` a partir de `apps/web/package.json` |
| `@solana/web3.js` no Authorization Service | declarado como `1.99.0` e resolvido no mesmo store deste checkout | `pnpm why` do filtro |
| Suíte Surfpool | pacote fora do workspace pnpm; `@solana/web3.js` 1.99.0 resolve em `programs/settlement-lab-tests/node_modules`, ainda dentro deste repositório | `createRequire` em `programs/settlement-lab-tests/package.json` |

Não houve dependência resolvida a partir de outro checkout.

## 5. Monorepo

| Comando | Resultado | Testes | Evidência |
| --- | --- | --- | --- |
| `pnpm security:check` | falhou, código 1, 1,05 s | não é suíte de testes | `.env.lab.example` classificado como caminho proibido. O arquivo não contém chave privada; só aponta um caminho gitignored |
| `pnpm test` no sandbox | processo caiu, código 1, 4,19 s | 10 testes de entrevista passaram; o worker do Vitest estourou a pilha ao encerrar | `docs/validation/raw/monorepo-and-auth.log` |
| `pnpm test` no host | aprovado, código 0, 7,23 s | 13 aprovados, 0 reprovados, 2 arquivos | `docs/validation/raw/pnpm-test-unsandboxed.log` |
| `pnpm test:agent` | aprovado, código 0, 10,86 s | 105 aprovados, 0 reprovados, 0 ignorados, 39 suítes | `docs/validation/raw/monorepo-and-auth.log` |
| `pnpm typecheck` | falhou, código 2, 21,16 s | não se aplica | três erros TS em `@kairos/metabolic-agent`; `tsc --noEmit` de `@valuecurator/web`, executado à parte, código 0 |
| `pnpm build:web` no sandbox | código 0 em 6,29 s, sem `apps/web/.next/BUILD_ID` | não se aplica | resultado descartado como artefato ausente |
| `pnpm build:web` no host | aprovado, código 0, 100,57 s | não se aplica | `BUILD_ID 4wHBnzK9n7i3Qm-gsA9R1`; rota `/lab` e as oito rotas `/api/lab/*` presentes; aviso de import nomeado `version` |

Erros de typecheck:

- `apps/web/agent/src/multiasset-proofgate.test.ts(57,40)`: `assetId` opcional onde o tipo exige o campo
- `apps/web/agent/src/multiasset-proofgate.ts(181,32)` e `(182,7)`: objeto possivelmente indefinido

Esses arquivos pertencem ao agente KAIROS. A lógica não foi alterada para fazer o typecheck passar.

## 6. Authorization Service

| Teste | Resultado | Evidência |
| --- | --- | --- |
| `pnpm --filter @valuecurator/proofgate-authorization-service test` | 18 aprovados, 0 reprovados, 0 ignorados, código 0, 1,21 s | `node --test test/*.test.mjs` |
| Vetor canônico C27 igual ao digest Rust `79f797722d8826bb42c40785417d33c6d3e58867e3ca6caddded9d3b8d0b31f3` | aprovado | testes C27 |
| Ativo, evidência, política, nonce, mandato de outro dono, epoch, pausa e versão | aprovados na matriz C01–C24 e C26–C28 | `authorization.test.mjs` |
| Proposta bloqueada não assina | aprovado | `signerInvocations` permanece 0 nos casos bloqueados |
| Autenticação de carteira, replay e expiração do desafio | aprovado | `wallet challenge expires and cannot be replayed` |
| Ed25519 na primeira instrução e transação abaixo de 1232 bytes | aprovado | teste de `settlement-tx` |
| Cluster errado, ativo desconhecido, RPC morto e ativo trocado depois da autorização | aprovado | `lab-gateway.test.mjs` |
| Cobertura | não medida | o script é `node --test`, sem c8, nyc ou istanbul |

## 7. Settlement Lab

| Teste | Resultado | Evidência |
| --- | --- | --- |
| `cargo test -p proofgate-settlement-lab` a partir da raiz | falhou, código 101 | `Cargo.toml` não está na raiz; tentativa inválida de diretório |
| Mesmo comando em `programs/` | 6 aprovados, 0 reprovados, 0 ignorados, código 0, 62,69 s | compilação de teste em 1 min 01 s; doc-tests 0 |
| `cargo-build-sbf` em `programs/` | código 0, 1,81 s | perfil release já atualizado em 0,58 s; nenhum aviso e nenhum estouro de stack apareceram porque o compilador não recompilou |
| Artefato `programs/target/deploy/proofgate_settlement_lab.so` | presente, 399432 bytes | SHA-256 `1e0817e7c2c78eac900b484920be5923b8f79035a6b0f8960c65dfdd72c89ef0` |

Testes Rust observados: arredondamento da taxa, denominador zero e overflow, digest de execução, mensagem de autorização contra o vetor JavaScript, e versão de política monotônica.

## 8. Surfpool

- RPC da suíte: `http://127.0.0.1:18999`, modo offline. A porta estava livre antes da suíte e ficou livre ao término.
- Program ID: `CJ2NA3E8ZWZFMjrLtzAKxGZNomLBP4Tvnh8hQiFD3ecA`
- Surfpool: 1.5.0
- SVM / solanaCore: 4.1.2
- Total da suíte: 74 aprovados, 0 reprovados, código 0, 74,67 s
- Comando: `node settlement-lab-tests/run.mjs` dentro de `programs/`
- O script sobe o próprio Surfpool offline e faz deploy local do `.so`. Não houve deploy público.

Transações públicas observadas:

| Cenário | Assinatura local | Digest | Recibo | Saldos |
| --- | --- | --- | --- | --- |
| swap sintético válido dUSDC para dAAPL | `2YTYM96xLzaaYUMWAXxVJWkQnP1qbbTLgwLfmWkxiutMyZ6ejMP2fyskzffnucVQ8yxRvMGCQ1uL6doWBqzMCF3A` | `ed014f33707591186ec6f43740ac2e685ec2b72aa886aefa92aa1f170bc7027c` | `F2ajVemwwuwMEhFoF3SM5fg7Zm9MiXs6wXhbxmCktHg2` | dono dUSDC 10000000 para 9000000; dAAPL 0 para 1000000; gasto do mandato e do portfólio 0 para 1000000 |
| serviço autoriza e o contrato liquida | `V4SYfFgkHDV6CcR5chto9Tnqkw5pEaWDVCfCqkTL1fnN82xANKMuGt3HQXQ4xZ6o6DDztHpxsaTU9xGnzz2a2nN` | `9ae423ed23a6d66fbe066b87284a7ba2c8547de7ebf3f6c6dc7597e0808166d2` | `Gbr1Z3Haf32wr5fmFEZfSJ41LWVoLGC5waXCjazSJN3r` | entrada do dono 10000 para 9000; saída 0 para 1000 |
| fluxo do serviço assina, liquida e reconcilia | `3ZwjGD1831iU8awiy2H3gcCZ3hhv15vVQzoWWAMiTEmiG8YTifQQprGxVwCiVGGb1kEbghJLucrSvMeHr9hNtiRG` | `b5c1a09cc6ea103f6a8994ac56754178ab8215d6f6fc0adad3c77016b0d89666` | `GrA6X4ZRRtBxWVmNPSHeHxTS282QPPAvQ1r5zSxxj3qw` | decisão observada `EXECUTED`; campo `phantom` gravado como `false`; signatário `experimental-local-keypair` |

Mints da suíte: entrada `H99z25ff96M2Gmr8hp1JC1sJ7Qw467p2DXVixUjnKiuz` (dUSDC), saída `7QEwsa6b16LpuZbpUh3x2Xf5tmcLwxv4stD7RZq5hbWx` (dAAPL), 6 decimais. Quantidade do swap principal: 1000000 unidades base.

Provisionamento posterior, com Surfpool já no ar: `node settlement-lab-tests/provision-lab.mjs`, código 0, 20,56 s. `programs/target/lab-runtime.json` criado com 865 bytes, sem array de chave secreta. Program ID `CJ2NA3E8ZWZFMjrLtzAKxGZNomLBP4Tvnh8hQiFD3ecA`. Mint de saída deste runtime: `EnrFWUKU2UV5YgEsioNvS16mzCznAaTvT6s4MzzJpgm1`. Signatário público da política: `9xDpf4oQgJPa6d5mq2G13CokaYoMRn1mitBu7ZmVV4qW`.

## 9. Integração C2

| Componente | Implementação | Teste | Resultado |
| --- | --- | --- | --- |
| Rota `/lab` | IMPLEMENTADO em `apps/web/app/lab/page.tsx` | TESTADO | HTTP 200 e título `ProofGate Lab · ValueCurator` em `43147` e `43148` |
| API de configuração | IMPLEMENTADO em `apps/web/app/api/lab/config/route.ts` | TESTADO | `43148` retornou `surfpool-local`, RPC `127.0.0.1:18999`, program ID e epoch 1; `43147` retornou 503 porque o processo antigo não tinha `LAB_*` |
| API de ativos | IMPLEMENTADO em `apps/web/app/api/lab/assets/route.ts` | TESTADO | quatro ativos `RESEARCH_ONLY` e `lab:dAAPL` em `LAB_VERIFIED` |
| Autenticação por carteira | IMPLEMENTADO em challenge, sessão e `signMessage` | TESTADO no serviço e na rejeição HTTP; NÃO TESTADO com Phantom | desafio vazio rejeitado com HTTP 400; desafio válido limitado a 20 por minuto |
| Autorização determinística | IMPLEMENTADO em `policy.mjs` e `service.mjs` | TESTADO | matriz do serviço e suíte Surfpool |
| Assinador no servidor | IMPLEMENTADO em `node-gateway.mjs`, módulo de servidor | TESTADO por inspeção de bundle e por execução | `openLabGateway` e o caminho da chave não aparecem nos chunks estáticos do cliente |
| Frontend sem chave privada | IMPLEMENTADO | TESTADO | as respostas e os logs desta validação não contêm array de 64 bytes; `window` da página não recebe a chave |
| Transação com Ed25519 | IMPLEMENTADO em `canonical.mjs` e `settlement-tx.mjs` | TESTADO | teste de ordem da instrução e cenários Surfpool sem Ed25519 rejeitados |
| Assinatura do proprietário solicitada | IMPLEMENTADO em `proofgate-lab.tsx` via `signTransaction` | NÃO TESTADO na interface | a suíte local usa keypair experimental e marca `phantom: false` |
| Recibo após confirmação | IMPLEMENTADO | TESTADO na suíte e na rota vazia | recibos públicos acima; `GET /api/lab/receipt` sem endereço retorna 503 com motivo `receipt address is invalid` |
| Reconciliação no backend | IMPLEMENTADO em `apps/web/app/api/lab/reconcile/route.ts` | TESTADO | cenário E01 chegou a `EXECUTED`; POST vazio retornou HTTP 409 |
| Fluxo KAIROS | sem alteração nesta validação | NÃO TESTADO como fluxo de produto | `git status` não lista o programa KAIROS; o typecheck do agente falhou e foi apenas registrado |

Observação de interface, em `http://127.0.0.1:43148/lab`: depois da carga, a página mostrou rede `surfpool-local`, RPC local, program ID, política 1 / epoch 1, catálogo de pesquisa separado do mint sintético, botão `Request ProofGate decision` desabilitado e carteira desconectada. O modal oferece Phantom e Solflare. `window.phantom` e `window.solana` estavam `undefined`.

## 10. Phantom

- Situação: modal de carteira abre e lista Phantom. A extensão não está injetada no navegador usado.
- Assinatura manual: não houve.
- Bloqueadores: `window.phantom` e `window.solana` indefinidos; nenhum popup de extensão; nenhuma transação foi enviada pela interface.

```text
Teste manual com Phantom:
NÃO EXECUTADO

Motivo:
Ambiente sem interação confirmada com a extensão.

Próxima ação:
Realizar teste assistido no navegador.
```

As assinaturas locais da suíte Surfpool foram feitas por keypairs de laboratório. Elas não comprovam assinatura manual com Phantom.

## 11. Segurança

| Invariante | Evidência | Resultado |
| --- | --- | --- |
| Chamada direta sem autorização ProofGate | cenário `C-BYPASS`, erro `MissingProofGateAuthorization` 6015, assinatura `4tvr6W1CAyceGgpG2Z8DHvxWuB6LSBEUpfnn38BAWWQw27yiiwo468p6CugtuSfTZ5yLKYzGX9TApyYFKs3MnCeK` | TESTADO, rejeitado |
| Chamada sem assinatura do proprietário | cenário `swap sem a assinatura do proprietário` e `ProofGate válido sem assinatura do owner` | TESTADO, rejeitado |
| Digest adulterado | cenários de digest, evidence digest e proposal digest na suíte; C09 no serviço | TESTADO, rejeitado |
| Nonce reutilizado | C16 e C22 no serviço; `o mesmo nonce não executa de novo` e `nonce da autorização reutilizado` no Surfpool | TESTADO, rejeitado |
| Mandato inválido ou de outro dono | C13, C14 e cenários de outro mandato, pool e carteira | TESTADO, rejeitado |
| Limite agregado ultrapassado | `chamada direta não ultrapassa o teto agregado do portfólio` e `autorização válida acima do limite agregado` | TESTADO, rejeitado |
| Política pausada | C12 e `configuração ProofGate pausada` | TESTADO, rejeitado |
| Autorização expirada | cenário `autorização expirada` | TESTADO, rejeitado |
| Policy version antiga | `autorização de outra versão de política` e `versão de política igual ou inferior é rejeitada` | TESTADO, rejeitado |
| Authorization epoch antigo | `autorização revogada pelo epoch` e C11 | TESTADO, rejeitado |
| Mint não verificado | E02, `ativo não verificado não é assinado`; observação `asset is not the verified lab mint` | TESTADO, bloqueado sem assinatura nova |
| RPC incompatível | `assertLabEnvironment` recusa RPC de mainnet e modo devnet com execução; carteira `mainnet-beta` bloqueada no fluxo E14 | TESTADO no serviço e na suíte; nenhuma transação foi enviada a cluster público |
| Transação em ambiente incorreto | o frontend só envia se o RPC for loopback na porta 18999 | IMPLEMENTADO; NÃO TESTADO pelo clique do usuário |
| Serviço de autorização indisponível | `43147` sem runtime responde 503 `Lab runtime is not configured` e `confirmed: false` | TESTADO, falha fechada |
| Requisição malformada | POST `{` em `/api/lab/authorize` | TESTADO; corpo pede objeto, porém o HTTP ficou 200 com `status: 400` interno |
| Acesso ao assinador | chave lida só em `node-gateway.mjs`; bundle do cliente sem o caminho da chave | TESTADO por busca estática no `.next/static` |
| Segredos no frontend | respostas de API e logs de validação sem array de keypair | TESTADO |
| Rate limit local | 20 desafios HTTP 200 e os 5 seguintes HTTP 429 `rate limit` para uma chave pública descartável | TESTADO nesta execução; não havia teste unitário dedicado |
| Proposta bloqueada sem assinatura | C26 e `proposta inválida não recebe assinatura`, observação `BLOCKED: asset is not in the lab registry` | TESTADO |
| Origem cruzada | `Origin: https://evil.example` recebeu HTTP 403 | TESTADO |

## 12. Falhas

- Identificador: F-01
- Descrição: `pnpm security:check` reprova `apps/web/.env.lab.example`
- Causa provável: a regex trata qualquer `.env` seguido de ponto como caminho de segredo, e a allowlist só contém `.env.example` e `agent/.env.example`
- Evidência: saída `Tracked secret check failed: .env.lab.example: forbidden secret-bearing path`
- Impacto: o portão de segredo do monorepo falha mesmo sem chave no arquivo. O exemplo só contém caminhos e o program ID público.

- Identificador: F-02
- Descrição: `pnpm typecheck` para em `@kairos/metabolic-agent`
- Causa provável: o teste do registro multiasset produz um objeto com `assetId` opcional, e o filtro do registro usa `matching[0]` sem estreitamento
- Evidência: erros TS2322 e TS2532 citados na seção 5
- Impacto: o comando pedido do monorepo falha. Os 105 testes do agente ainda passaram em JavaScript, então a falha é de tipo, não de asserção desta execução.

- Identificador: F-03
- Descrição: a URL documentada `http://127.0.0.1:43147/lab` está servida por um Next.js anterior, pid 8984, sem variáveis `LAB_*`
- Causa provável: processo já existente da sessão de interface; esta validação não o encerrou
- Evidência: `/api/lab/config` e `/api/lab/assets` em `43147` responderam 503
- Impacto: o endereço citado no pedido não estava configurado para o laboratório. As mesmas rotas responderam configuradas em `127.0.0.1:43148`.

## 13. Riscos residuais

- A experiência de carteira continua sem evidência manual. O botão de decisão permanece desabilitado até existir `signMessage` e `signTransaction`.
- O nonce e o rate limit vivem na memória do processo. Um reinício do servidor zera os dois.
- A compilação SVM desta execução foi incremental. Ela confirma o artefato atual e não reexibiu diagnósticos de stack.
- `programs/settlement-lab-tests` não entra no `pnpm-workspace.yaml`. Um clone limpo precisa instalar esse pacote à parte antes da suíte.
- `*.log` está no `.gitignore`. O log oficial fica no disco local e não aparece no `git status`.
- O servidor de `43147` que já existia foi deixado em execução.

## 14. Pendências prioritárias

Detalhadas em `docs/validation/PENDENCIAS_C2.md`. As prioritárias são a assinatura assistida com Phantom, o falso positivo do `security:check` e os erros de tipo do agente.

## 15. Critérios de aceitação

| Critério | Estado nesta execução |
| --- | --- |
| Testes do Authorization Service | aceito, 18/18 |
| Testes Rust do contrato | aceito, 6/6 |
| Artefato SVM local | aceito, `.so` de 399432 bytes, sem deploy público |
| Suíte Surfpool dos marcos presentes no script | aceito, 74/74 |
| Integração HTTP configurada | aceita em `43148` |
| Interface `/lab` renderiza o laboratório | aceita em `43148` após a carga da API |
| Assinatura manual Phantom | não aceito |
| `pnpm security:check` | não aceito |
| `pnpm typecheck` | não aceito |
| KAIROS inalterado por esta validação | aceito |
| Segredos fora dos relatórios | aceito na varredura dos arquivos de validação |

## 16. Conclusão técnica

- APROVADO COM RESSALVAS

A liquidação sintética local, a política determinística e a reconciliação pelo serviço foram exercitadas nesta execução. A conclusão não é aprovação integral do Marco C2: falta a assinatura manual com Phantom, e dois comandos do monorepo falharam.
