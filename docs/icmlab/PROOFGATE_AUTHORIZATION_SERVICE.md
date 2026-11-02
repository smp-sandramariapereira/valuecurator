# ProofGate Authorization Service — Marco C1

Serviço local e determinístico que emite uma autorização ProofGate somente depois de reconstruir a decisão. A assinatura é compatível com `ProofGateAuthorizationV1` do Settlement Lab. Não é um endpoint público, não é um KMS e não integra o dashboard, o Research Lab nem um oráculo.

## 1. Arquitetura

O código está em `apps/proofgate-authorization-service`. A única operação exportada para quem chama o serviço é `createAuthorizationService().authorize`.

```text
request validation
        │
        ▼
asset verification          src/assets.mjs
        │
        ▼
evidence verification       src/evidence.mjs
        │
        ▼
policy evaluation           src/policy.mjs      função pura, sem chave
        │
        ▼
re-read trusted config
        │
        ▼
authorization construction  programs/settlement-lab-tests/authorization.mjs
        │
        ▼
signing boundary            src/service.mjs     chave fica no closure
        │
        ▼
signed authorization
```

`AUTHORIZED` significa que a política permitiu emitir a assinatura. Não significa que o swap liquidou. `BLOCKED` devolve `proof: null`. O assinador de teste conta invocações; nos casos bloqueados a contagem não anda.

Não existe `signArbitraryDigest`. O módulo de política não recebe chave privada.

## 2. Modelo de confiança

O cliente não é fonte de `policy_version`, `authorization_epoch`, `policy_signer` ou `deployment_id`. Se enviar um desses valores e ele divergir da configuração confiável, a proposta é bloqueada. `approved: true` e `status: REVIEWABLE` não são lidos como permissão.

A configuração confiável, no teste E2E, é a conta `["proofgate-config"]` lida de novo imediatamente antes da assinatura. O registro de laboratório é um `Map` montado pelo operador com o mint criado naquela execução. O mandato, a taxa e as pausas vêm das contas do pool, do mandato e do portfólio, não dos limites declarados no pedido.

Uma assinatura válida prova que a chave configurada assinou aquele digest. Essa propriedade depende da integridade da autoridade ProofGate e da custódia da chave privada. Se a chave vazar, o contrato aceita o que ela assinar dentro dos limites on-chain.

## 3. Fontes de configuração

| Valor | Fonte |
| --- | --- |
| Program ID | `CJ2NA3E8ZWZFMjrLtzAKxGZNomLBP4Tvnh8hQiFD3ecA`, passado pelo operador e conferido na mensagem |
| `deployment_id` | 32 bytes gravados uma vez na config. Nesta suíte, 32 bytes `0x07` |
| `policy_signer`, `policy_version`, `authorization_epoch`, `paused` | Conta da config, relida antes de assinar |
| Mint, rede, token program, `verification_status` | Registro de laboratório da execução. O catálogo em `apps/web/data/asset-catalog.json` não autoriza liquidação |
| Limites e taxa | Contas do mandato, do portfólio e do pool |

`MAINNET_READ_ONLY` nunca autoriza. `DEVNET_LAB` só autoriza um token sintético explícito, com `verificationStatus: VERIFIED`, rede `devnet-lab` e programa `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`. Um mint de execução anterior do Surfpool não entra sozinho nesse registro.

## 4. Esquema de autorização

Uma implementação, em `programs/settlement-lab-tests/authorization.mjs`. 530 bytes. Domínio `proofgate-settlement-lab/authorization-v1`, schema `1`, depois program, deployment, config, policy signer, `policy_version` u64, `authorization_epoch` u64, owner, mandate, pool, input mint, output mint, token program, `amount_in`, `minimum_out`, taxa numerador e denominador, três digests de 32 bytes (evidência, proposta, execução), nonce u64, `issued_at` i64, `expires_at` i64. Inteiros em little-endian.

O digest travado do vetor é `79f797722d8826bb42c40785417d33c6d3e58867e3ca6caddded9d3b8d0b31f3`. A precompile Ed25519 assina esse SHA-256 de 32 bytes, não os 530, porque a transação legada cabe em 1232 bytes. O programa reconstrói os 530 bytes e exige que a mensagem verificada seja o hash.

## 5. Política determinística

`evaluateAuthorizationRequest` devolve `AUTHORIZED` ou `BLOCKED`. Confere perfil, ativo, evidência, pausa, versão, epoch, deployment, signer, identidade do mandato, teto por operação, teto diário conhecido, saldo agregado conhecido, taxa fixa, nonce, prazo máximo de 300 segundos e consistência do `minimum_out` com a taxa inteira. Quantidade fracionária, negativa ou acima de `u64` é rejeitada. A política off-chain não substitui os tetos do contrato.

Governança on-chain, sem rollback nesta fase:

| Ação | Versão | Epoch |
| --- | --- | --- |
| `set_policy_version` com valor maior | passa a ser o valor novo | incrementa |
| versão igual ou menor | rejeita `PolicyRegression` | permanece |
| rotação do signer | permanece | incrementa |
| `advance_authorization_epoch` | permanece | incrementa |
| pausa e retomada | permanece | permanece |

Pausa emergencial continua disponível. Overflow de epoch retorna `ArithmeticOverflow`.

## 6. Evidências

Esquema aceito: `lab-fixed-rate-v1` com perfil `DEVNET_LAB`. O serviço recalcula o digest sobre o ativo, os dois mints, a taxa e a janela. Evidência ausente, expirada, de outro ativo, com taxa diferente ou com digest que não bate com o corpo bloqueia a proposta. A janela máxima é 300 segundos. Fail closed.

Não há fonte de preço autenticada. O laboratório só cobre swap sintético de taxa fixa, e a taxa tem de ser a do pool lido on-chain. O cliente não declara que um preço é confiável. Saída do Research Lab e classificação de relevância não são evidência. Não há adaptador de oráculo.

## 7. Custódia da chave

A chave de política da suíte é `Keypair.generate()` na memória do processo. Não é a chave do owner, não é a chave de deploy e não é gravada. O closure de `createAuthorizationService` é o único lugar que a usa. A resposta devolve a instrução Ed25519 e os campos para montar `execute_swap`. Não devolve a chave. A interface cabe, mais tarde, num KMS que implemente o mesmo closure. Isso ainda não existe.

## 8. Rotação e revogação

Se a config relida tiver outro signer, outra versão, outro epoch, outra pausa ou outro deployment, o serviço não assina. Uma autorização já emitida deixa de coincidir com a mensagem que o programa reconstrói, então o contrato devolve `AuthorizationMismatch`. C23 cobre a rotação no serviço. C24 cobre a troca de versão no payload. B16 e B17 cobrem a rejeição on-chain. C25 cobre a regressão.

## 9. Concorrência

`authorize` entra numa fila do processo. Duas chamadas com o mesmo nonce de mandato produzem uma assinatura. O conjunto de nonces vive na memória e se perde no reinício. Isso não é garantia de uso único. O recibo `["receipt", mandate, nonce]` continua sendo a autoridade contra replay.

## 10. Fluxo E2E no Surfpool

Surfpool `--offline` em `127.0.0.1:18999`. Sem transação pública.

Proposta: `lab:dAAPL`, 1000 unidades base, taxa 1/1, nonce 42, evidência `lab-fixed-rate-v1` da mesma execução. Decisão `AUTHORIZED`. Transação `2Y2eNX8kVziBffRb8PkmKJaj5DBZqQnTs46xkweDzkCaURKApKeDATbnn2GpoxbZVr52KQhE7K1R5SaYk3DSByM1`. Recibo `7QFSqvPz6V68xPm6Wpwt3xshH5ZR4RkvFSxPn8USjEzi`. Digest de autorização `a1405895784614b257ed21cb94169824fdbb58a7765827f21bcb5540afd0a1ec`, igual ao campo do recibo. Saldos do owner 10000→9000 e 0→1000. Pool 954500→955500 e 4395500→4394500.

Proposta com ativo fora do registro: `BLOCKED`, sem assinatura nova. `execute_swap` direto, sem a precompile: `MissingProofGateAuthorization`, sem recibo, assinatura `D1p77Y6gcKDRDbKQYQs5rrAXdmDZmotkvKp8o6sM1gdcSRCxnmRBpNCyykFCn7EJyDFoWD3Yiu741S9ASL6DgMq`.

## 11. Ameaças e limitações

| Ameaça | O que o Marco C1 faz | O que permanece |
| --- | --- | --- |
| Cliente pede assinatura de proposta bloqueada | A política bloqueia e o assinador não roda | Quem possui a chave fora do serviço ainda pode assinar |
| `REVIEWABLE` ou texto de pesquisa | Não são permissão | O avaliador multiativo continua só de revisão e não foi ligado a este assinador |
| Mint do catálogo ou da Mainnet | Não liquida | O contrato não sabe se um mint SPL é sintético |
| Replay | Nonce em memória e recibo on-chain | A memória não sobrevive a reinício nem a duas instâncias |
| Config muda no meio do pedido | A segunda leitura cancela a assinatura | Duas instâncias podem assinar antes de uma pausa propagar |
| Regressão de política | Rejeitada on-chain | O admin ainda pausa, avança epoch e troca a chave |
| Endpoint aberto | Não há servidor HTTP | Também não há autenticação nem limite de taxa, porque não há API |

Não declarar este serviço adequado para produção. Não há KMS, não há oráculo, não há ativos reais e não há deploy público.

## 12. Testes

| Comando | Resultado |
| --- | --- |
| `cargo test -p proofgate-settlement-lab` | 6 aprovados, 0 falhas |
| `cargo-build-sbf` do Settlement Lab | concluído, sem estouro de stack |
| `node --test test/authorization.test.mjs` | 13 aprovados, 0 falhas |
| `node settlement-lab-tests/run.mjs` | 67 aprovados, 0 falhas |

C25: versão 2 repetida e versão 1 foram rejeitadas com `PolicyRegression`. A config permaneceu na versão 2 e no epoch 2. Assinatura `8uAWsocd5rYYZvhaTkhh3HH9o2Skibpmyf1u7h3srZMU7eRJEXqQ7Gy9EdVH5EgebGACfKmKjWfHHooV9dLzDyH`.

## Matriz de compatibilidade

| Campo on-chain | Origem confiável | Validação off-chain | Serialização | Risco residual |
| --- | --- | --- | --- | --- |
| program id | operador e `declare_id!` | tem de ser o programa do lab | 32 bytes após o schema | outro programa produz outro digest |
| deployment id | config, imutável | cliente divergente bloqueia | 32 bytes | a SVM não entrega genesis hash |
| config | PDA `["proofgate-config"]` | relida antes de assinar | 32 bytes | uma segunda instância pode estar atrasada |
| policy signer | config | a chave isolada tem de ser essa | 32 bytes | a chave é a raiz de confiança |
| policy version | config | cliente divergente bloqueia; on-chain só aumenta | u64 LE | pausa não avança a versão |
| authorization epoch | config | cliente divergente bloqueia | u64 LE | admin pode avançar ou rotacionar |
| owner, mandate, pool, mints, token program | contas e registro do lab | todos têm de coincidir | 32 bytes cada | o catálogo de ações não entra aqui |
| amount in, minimum out, taxa | mandato e pool | inteiro base, dentro dos tetos, taxa do pool | quatro u64 LE | taxa fixa, não preço de mercado |
| evidence digest | corpo `lab-fixed-rate-v1` | recalculado; o programa não o reconstrói | 32 bytes | o programa confia no compromisso assinado |
| proposal digest | campos verificados da proposta | recalculado | 32 bytes | igual ao anterior |
| execution digest | parâmetros que a instrução vai executar | domínio `execution-v1` | 32 bytes | o recibo ainda guarda este hash no campo histórico `evidence_digest` |
| nonce | pedido, conjunto em memória, recibo | formato u64 e não repetido neste processo | u64 LE | unicidade real é o recibo |
| issued at, expires at | relógio da cadeia no E2E | TTL máximo 300 s | dois i64 LE | o relógio do processo, se usado no lugar do clock, fica obsoleto depois de `surfnet_timeTravel` |
