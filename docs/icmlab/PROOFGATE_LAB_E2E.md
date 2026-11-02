# ProofGate Lab — Marco C2

Experiência local em `/lab`. O dashboard do KAIROS permanece na rota `/app`. Não houve deploy público.

## Arquitetura

```text
navegador /lab
    │  fetch same-origin
    ▼
Next.js /api/lab/*
    │
    ▼
@valuecurator/proofgate-authorization-service
    │  política pura, depois assinatura
    ▼
transação com Ed25519 + execute_swap
    │  a carteira assina como owner
    ▼
Surfpool 127.0.0.1:18999
    │
    ▼
recibo e reconciliação
```

O navegador escolhe o ativo, a quantidade e assina. Ele não escolhe `policy_version`, `authorization_epoch`, `deployment_id` nem a chave ProofGate. A evidência de taxa é montada no servidor a partir do pool on-chain. `REVIEWABLE` não é lido como permissão.

A precompile Ed25519 assina o SHA-256 de 32 bytes da autorização de 530 bytes. A transação medida nos testes fica abaixo de 1232 bytes.

## Ambiente

Surfpool offline, sem tráfego público:

```bash
surfpool start --offline --ci --no-deploy --no-studio --yes \
  --host 127.0.0.1 --port 18999 --ws-port 19000 --airdrop-amount 0
```

Variáveis em `apps/web/.env.lab.example`. Copie para `apps/web/.env.local`. O RPC executável tem de ser `http://127.0.0.1:18999` ou `localhost` nessa porta, com `LAB_MODE=surfpool-local` e `LAB_PROGRAM_ID` igual a `CJ2NA3E8ZWZFMjrLtzAKxGZNomLBP4Tvnh8hQiFD3ecA`. Um `LAB_EXECUTION_ENABLED=true` sozinho não libera execução.

O Surfpool não entrega genesis hash. Loopback não é identidade criptográfica da rede. O servidor ainda exige o programa executável nesse RPC e a config `["proofgate-config"]` coerente com o arquivo de runtime.

Contas que somem quando o Surfpool reinicia: mints, pool, reservas, config, mandatos e recibos. A interface lê o runtime atual e marca o ativo como `BLOCKED` se o mint não existe. Não reutilize o mint de uma execução anterior como se fosse da Devnet.

## Chaves

| Chave | Onde vive | Quem usa |
| --- | --- | --- |
| Policy signer | arquivo `*-keypair.json` gitignored, só no servidor | Authorization Service |
| Owner | Phantom ou, nos testes, keypair efêmero | Assina a transação |
| Admin do pool e inicializador | `programs/.local-keys` e `programs/target`, gitignored | Provisionamento, não a página |

O JSON de resposta não contém segredo. O log não imprime a chave.

Autorização assinada exige desafio `valuecurator-proofgate-lab/wallet-v1`, com domínio, owner, nonce e prazo de 120 segundos. O nonce do desafio é de uso único. O owner autenticado tem de ser o owner da proposta. Há limite de 20 pedidos por minuto por owner, na memória do processo.

## Execução no navegador

1. Suba o Surfpool e provisione o laboratório.
2. `pnpm --filter @valuecurator/web dev` em `127.0.0.1:43147`.
3. Abra `/lab`.
4. Na Phantom, configure o RPC `http://127.0.0.1:18999`.
5. Conecte a carteira, inicialize portfólio e mandato, peça a decisão e só então assine o swap.
6. A página só mostra recibo depois que `/api/lab/reconcile` confirma a transação e o digest.

Nesta sessão de implementação a Phantom não foi aberta. O teste E01 usa um keypair local explicitamente marcado como `experimental-local-keypair`. Isso não comprova o clique na extensão.

## Testes

Nesta execução local:

| Comando | Resultado |
| --- | --- |
| `pnpm --filter @valuecurator/proofgate-authorization-service test` | 18 aprovados, 0 falhas |
| `cargo test -p proofgate-settlement-lab` | 6 aprovados, 0 falhas |
| `cargo-build-sbf` do Settlement Lab | concluído, sem estouro de stack |
| `node settlement-lab-tests/run.mjs` | 74 aprovados, 0 falhas |

O E01 liquidou pelo gateway. Transação `2qEVKhL8vbPbAH2uxHDinx1sDbcsFuQdjzWgE3F5vgzjvKP4m9zXa873tzF2gE6HgA8o7Xcdnp1Y8TH1CQnFeoRT`, recibo `A4aH2mRH2ppF5FZFrkbrbwehSVoJcTrHvQ4zBF4eXgMC`, digest `5bac274827a80b11c529945bc42e145b54f924ccd3e02bfc07ef3d1797b85b77`. O assinante foi um keypair de teste, com `phantom: false`.

E07 alterou o digest depois da autorização e o programa devolveu `AuthorizationMismatch`. E09, sem a instrução Ed25519, devolveu `MissingProofGateAuthorization`. E02 bloqueou `lab:dNVDA` sem nova assinatura. Mints desta execução: entrada `HeSADY5kiLXwm1MszeNCNzTZ1BRrLXbaQQTRunS8seWd`, saída `Cw79oQpmz5ji1NVty6LQtRfZHJ31pFQwXdoCjN72aww5`.

Pausa, expiração, nonce concorrente e RPC indisponível continuam cobertos pela suíte anterior e pelos testes do serviço (B15, B18, C12, C22 e o teste de RPC do gateway). Não são linhas separadas no Surfpool.

## Limitações

- Sem KMS, sem monitoramento e sem rate limit distribuído.
- O desafio e o nonce do serviço morrem com o processo.
- Não há oráculo. A taxa é a do pool sintético.
- dNVDA, dTSLA e dMSFT não estão no runtime.
- A Phantom pode recusar o blockhash do Surfpool. Nesse caso o marco permanece parcial no critério da assinatura manual.
- O owner ainda pode chamar o programa diretamente com um mandato de teto alto. O contrato aplica o teto gravado. A API do laboratório só monta mandatos até o teto do runtime.

## Checklist antes de qualquer Devnet

Não usar a chave de deploy do Surfpool. Não usar token real. Não iniciar o deploy sem consentimento explícito.

- Programa com identidade nova, diferente da chave local do Surfpool.
- Autoridade de upgrade em custódia separada, com procedimento de revogação.
- Policy signer em KMS ou módulo equivalente, fora do repositório e fora do navegador.
- `deployment_id` novo, gravado uma vez.
- Mints sintéticos dUSDC e dAAPL criados na Devnet, com reserva financiada por uma conta de laboratório.
- RPC de Devnet explícito. Mainnet continua bloqueada no perfil executável.
- SOL de Devnet para o operador e para os testers.
- Phantom na rede Devnet, não em RPC local.
- Os mesmos testes de regressão, mais uma transação confirmada em explorador.
- Limite de taxa, logs sem segredo, pausa e rotação de signer ensaiadas.
- Plano de incidente: pausar a config, avançar o epoch, parar o processo que assina.
- Revisão de segurança independente antes de abrir o endpoint fora de localhost.
