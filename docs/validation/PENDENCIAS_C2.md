# Pendências da validação C2

Registro de 2026-11-02T12:33:28Z. Nenhuma pendência abaixo foi corrigida nesta atividade.

## P1-01 — Assinatura manual com Phantom não executada

- Prioridade: P1
- Descrição: o navegador desta sessão abre o modal Phantom/Solflare, mas `window.phantom` e `window.solana` estão indefinidos. Nenhuma mensagem nem transação foi assinada pela extensão.
- Evidência: página `http://127.0.0.1:43148/lab`; cenário Surfpool E01 com `signer: experimental-local-keypair` e `phantom: false`.
- Impacto: o fluxo de usuário até o recibo permanece sem evidência manual. Os 74 cenários locais continuam válidos como automação.
- Recomendação: repetir em um navegador com Phantom de teste, RPC `http://127.0.0.1:18999`, e registrar só a assinatura pública e o recibo.
- Arquivos relacionados: `apps/web/components/proofgate-lab.tsx`
- Estado: aberta

## P2-01 — `security:check` reprova o exemplo do laboratório

- Prioridade: P2
- Descrição: `apps/web/.env.lab.example` casa com a regex de caminho `.env` e não está na allowlist.
- Evidência: `pnpm security:check`, código 1, mensagem `forbidden secret-bearing path`. O conteúdo lido contém variáveis e um caminho de keypair, sem a chave.
- Impacto: o comando pedido do monorepo falha e reduz a confiança do portão de segredo.
- Recomendação: incluir o exemplo na allowlist ou estreitar a regex para arquivos de segredo reais. Não colocar chave nesse arquivo.
- Arquivos relacionados: `apps/web/scripts/check-no-tracked-secrets.mjs`, `apps/web/.env.lab.example`
- Estado: aberta

## P2-02 — Typecheck do agente multiasset falha

- Prioridade: P2
- Descrição: `pnpm typecheck` termina com código 2 em `@kairos/metabolic-agent`.
- Evidência: TS2322 em `apps/web/agent/src/multiasset-proofgate.test.ts:57` e TS2532 em `apps/web/agent/src/multiasset-proofgate.ts:181-182`.
- Impacto: o portão de tipos do monorepo falha. `pnpm test:agent` passou 105 testes porque o runner não executa `tsc`.
- Recomendação: corrigir os tipos sem alterar a política financeira. O motor KAIROS não foi modificado nesta validação.
- Arquivos relacionados: `apps/web/agent/src/multiasset-proofgate.ts`, `apps/web/agent/src/multiasset-proofgate.test.ts`
- Estado: aberta

## P2-03 — A porta documentada 43147 não serviu o laboratório configurado

- Prioridade: P2
- Descrição: um Next.js anterior, pid 8984, já escutava `127.0.0.1:43147` sem `LAB_MODE`, `LAB_RPC_URL`, `LAB_PROGRAM_ID`, `LAB_POLICY_KEYPAIR_PATH` nem `LAB_RUNTIME_PATH`.
- Evidência: `GET /api/lab/config` e `GET /api/lab/assets` responderam 503 `Lab runtime is not configured`. O mesmo código, com as variáveis do exemplo, respondeu 200 em `127.0.0.1:43148`.
- Impacto: quem abrir a URL documentada neste momento não vê o runtime provisionado.
- Recomendação: encerrar o servidor antigo com consentimento e subir `pnpm --filter @valuecurator/web dev` com as variáveis de `apps/web/.env.lab.example`, depois de o Surfpool offline estar em 18999.
- Arquivos relacionados: `apps/web/package.json`, `apps/web/.env.lab.example`, `apps/proofgate-authorization-service/src/node-gateway.mjs`
- Estado: aberta. O processo 8984 foi preservado.

## P2-04 — Suíte Surfpool fora do workspace pnpm

- Prioridade: P2
- Descrição: `programs/settlement-lab-tests` tem `package.json` próprio e não é membro de `pnpm-workspace.yaml`.
- Evidência: a resolução de `@solana/web3.js` cai em `programs/settlement-lab-tests/node_modules`, dentro deste checkout. `node_modules/` é gitignored.
- Impacto: um clone limpo não executa `node settlement-lab-tests/run.mjs` só com `pnpm install` da raiz.
- Recomendação: incluir o pacote no workspace ou documentar o install local no procedimento de validação.
- Arquivos relacionados: `pnpm-workspace.yaml`, `programs/settlement-lab-tests/package.json`
- Estado: aberta

## P2-05 — Logs de evidência ignorados pelo Git

- Prioridade: P2
- Descrição: `.gitignore` ignora `*.log`. `docs/validation/EXECUCAO_C2.log` e `docs/validation/raw/*.log` permanecem no disco e ficam de fora do `git status`.
- Evidência: `git check-ignore -v` aponta `.gitignore:9:*.log`.
- Impacto: um commit comum não leva o log de execução. O relatório Markdown e o JSON continuam rastreáveis.
- Recomendação: versionar o log com uma exceção de gitignore, ou copiar o trecho necessário para o Markdown antes de publicar a evidência.
- Arquivos relacionados: `.gitignore`, `docs/validation/EXECUCAO_C2.log`
- Estado: aberta

## P3-01 — Autorização malformada responde HTTP 200

- Prioridade: P3
- Descrição: `POST /api/lab/authorize` com corpo `{` devolve HTTP 200 e o objeto `{ ok: false, status: 400, error: "request body must be an object" }`.
- Evidência: `docs/validation/raw/api-probes.log`
- Impacto: o cliente que olha só o status HTTP pode tratar um corpo inválido como sucesso de transporte. `proof` não foi emitido.
- Recomendação: propagar o `status` 400 do gateway na rota, como já ocorre com 413 e 429.
- Arquivos relacionados: `apps/web/app/api/lab/authorize/route.ts`, `apps/proofgate-authorization-service/src/gateway.mjs`
- Estado: aberta

## P3-02 — Build web emite aviso de import nomeado

- Prioridade: P3
- Descrição: `next build` compilou com aviso de import nomeado `version` em `dashboard.tsx` e `site-header.tsx`.
- Evidência: `docs/validation/raw/build-web.log`, código 0, `BUILD_ID 4wHBnzK9n7i3Qm-gsA9R1`
- Impacto: não impediu o build. Pode quebrar quando o bundler deixar de expor o named export.
- Recomendação: importar o default e ler `version` dele.
- Arquivos relacionados: `apps/web/components/dashboard.tsx`, `apps/web/components/institutional/site-header.tsx`
- Estado: aberta

## P3-03 — Compilação SVM incremental sem diagnóstico novo

- Prioridade: P3
- Descrição: `cargo-build-sbf` terminou em 0,58 s com `Finished release` e não imprimiu aviso nem estouro de stack.
- Evidência: artefato de 399432 bytes e SHA-256 `1e0817e7c2c78eac900b484920be5923b8f79035a6b0f8960c65dfdd72c89ef0`
- Impacto: esta execução confirma o binário atual. Ela não revalida warnings de uma compilação limpa.
- Recomendação: numa auditoria de stack, repetir com target limpo só do pacote `proofgate-settlement-lab`.
- Arquivos relacionados: `programs/proofgate-settlement-lab/Cargo.toml`, `programs/target/deploy/proofgate_settlement_lab.so`
- Estado: aberta
