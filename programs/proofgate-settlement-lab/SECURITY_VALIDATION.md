# Settlement Lab — custódia e autorização ProofGate (Marcos A e B)

Validação local e offline. Nenhuma transação saiu de `127.0.0.1`. As chaves do programa e do inicializador da configuração permanecem em `programs/.local-keys/` e não são reproduzidas aqui. O signatário de política da suíte nasce na memória do processo e não é gravado.

## Ambiente

| Item | Valor observado |
| --- | --- |
| Rust (host) | `rustc 1.97.1 (8bab26f4f 2026-07-14)` |
| Anchor (crate resolvido) | `anchor-lang 1.2.2` (`Cargo.toml` pede `1.2.0`) |
| Anchor CLI | `anchor-cli 1.0.3` (não usado para compilar; não há `Anchor.toml` em `programs/`) |
| Surfpool | `1.5.0`, modo `--offline`, RPC `http://127.0.0.1:18999` |
| SVM / núcleo Solana do Surfpool | `4.1.2` (`solanaCore` no resultado da suíte) |
| Token program exercitado | SPL Token clássico (`TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`) |
| Identidade pública local | `CJ2NA3E8ZWZFMjrLtzAKxGZNomLBP4Tvnh8hQiFD3ecA` |
| Inicializador da configuração | `BMa9qun9QuCceSgozPtPNwQarro5CvQ63Twv3jDWcY8a` |
| Par sintético desta execução | dUSDC `EtwHogJJ5YuJEuNoxTCCjeR4C65oH3VoxLTNFs6QdFWy`, dAAPL `5DYz3dDLJ2WLMNcd393c335e6JUGikMbUhBEcr4M7R4m` |

Os endereços de mint são desta execução local. O Surfpool é efêmero; eles não são um deploy público.

Comandos executados neste marco, a partir de `programs/`:

- `cargo test -p proofgate-settlement-lab` — 5 aprovados, 0 falhas. O quinto teste trava o vetor canônico no mesmo digest do JavaScript.
- `CARGO_TARGET_DIR="$PWD/target" NO_DNA=1 cargo-build-sbf --manifest-path proofgate-settlement-lab/Cargo.toml` — concluído, sem estouro de stack.
- `node settlement-lab-tests/run.mjs` — 63 aprovados, 0 falhas. São os 35 cenários anteriores, agora com autorização ProofGate no caminho válido, mais B01–B28.

A primeira passagem da suíte ampliada registrou 33 aprovações e 2 falhas de asserção. As duas transações foram rejeitadas e não alteraram saldos. O contrato não foi alterado para “fazer o teste passar”: as asserções é que não cobriam o código de erro que o Anchor realmente emite (`ConstraintTokenOwner` na substituição de vault; a conta inválida tinha sido enviada duas vezes e caía em `ConstraintDuplicateMutableAccount` antes da checagem de mint). A repetição, com contas distintas e a lista de erros alinhada ao código, é a execução que conta: 35/0.

## Matriz de instruções

Confirmada em `src/lib.rs`, não apenas na documentação. Seeds: pool `["pool", admin, input_mint, output_mint]`; portfólio `["portfolio", owner, input_mint]`; mandato `["mandate", owner, pool]`; recibo `["receipt", mandate, nonce_le]`. A autoridade de cada vault é o PDA do pool. O programa de token aceito nas contas `Program<Token>` é o SPL Token clássico.

| Instrução | Autoridade exigida | Contas modificadas | Invariantes verificadas | Risco residual |
| --- | --- | --- | --- | --- |
| `initialize_pool` | Admin assinante e pagador | Pool PDA; duas ATAs do pool | Taxa positiva; mints diferentes; programa de token clássico; seeds ligam o pool ao admin e aos dois mints | Qualquer par SPL clássico pode ser inicializado. O contrato não prova que o mint é sintético. |
| `initialize_portfolio` | Owner assinante | Portfolio PDA | `max_daily_input > 0`; seeds `owner + input_mint` | O teto é o valor que o próprio owner grava na criação. Não há vínculo com ProofGate. |
| `initialize_mandate` | Owner assinante | Mandate PDA | Pool despausado; `expires_at > now`; `max_daily >= max_per_trade`; portfólio do mesmo owner e do mint de entrada do pool | Os limites nascem na inicialização, sem autorização externa. |
| `fund_reserve` | Admin assinante, `has_one` e seeds do pool | ATA de saída do admin e vault de saída do pool | Valor positivo; destino é a ATA de saída daquele pool; origem pertence ao admin | A pausa não bloqueia o aporte. O admin abastece o estoque que depois pode recuperar. |
| `execute_swap` | Owner assinante e Ed25519 do `policy_signer` da config `["proofgate-config"]` | Mandato, portfólio, vaults, ATAs do owner, recibo | Tudo o que o Marco A já exigia, mais a autorização reconstruída a partir da operação, a janela `issued_at`/`expires_at`, a versão e o epoch lidos da config, e a pausa da config | O digest de execução continua não sendo uma aprovação. A assinatura prova que o policy signer assinou o digest da autorização; não prova o processo externo que decidiu assiná-la. A taxa é a do pool, não um mercado. |
| `initialize_proofgate_config` | Inicializador fixo no programa | Config PDA | Seeds únicas; signer igual à constante; policy signer diferente do inicializador; deployment id não nulo | Quem tem essa chave cria a raiz. Ninguém mais consegue outra config nesse endereço. |
| `set_proofgate_paused` / `set_policy_version` / `advance_authorization_epoch` / `rotate_policy_signer` | Admin gravado na config | Config | `has_one` do admin. Versão nova estritamente maior que a atual (`PolicyRegression` caso contrário) e o epoch avança nessa atualização. Rotação troca o signer e avança o epoch. Pausa e retomada não mudam versão nem epoch | Não há rollback de política. O admin ainda pode pausar, avançar o epoch e rotacionar o signer. |
| `set_pool_paused` | Admin, seeds e `has_one` | Flag `paused` do pool | Só o admin daquelas seeds | A pausa habilita o saque administrativo. Não reverte um swap já confirmado. |
| `set_mandate_paused` / `set_portfolio_paused` | Owner das seeds | Flag `paused` | `has_one` do owner | O owner pode travar o próprio mandato ou portfólio. Não recupera tokens já trocados. |
| `withdraw_output_reserve` / `withdraw_input_reserve` | Admin assinante, seeds e `has_one` | Vault do pool e ATA de destino do admin | Pool pausado (`MustPauseFirst`); vault é a ATA daquele pool e daquele mint; destino tem o mesmo mint e autoridade do admin; programa de token clássico; o PDA do pool assina o `transfer_checked` | Com o pool pausado, o admin pode retirar a reserva de saída e a reserva de entrada já recebida. Esse é o modelo de contraparte, não um resgate do owner. |

Não existe instrução de resgate pelo owner. Incluir uma permitiria reclamar de novo um token que o swap já entregou à reserva.

## Custódia

Modelo adotado e encontrado no código: pool experimental administrado, sem depósito persistente do usuário.

- Quem controla cada reserva é o PDA do pool. As seeds incluem o admin e os dois mints, então o vault de um pool não é autoridade de outro.
- Quem pode recuperar tokens é somente o admin daquele pool, e somente enquanto o pool está pausado, para a ATA cujo dono é esse admin.
- O owner conserva os dois saldos até o swap. No swap, a entrada vai para a reserva e a saída sai da reserva na mesma instrução.
- Depois da liquidação, a entrada pertence à reserva da contraparte. O owner não tem direito automático de resgate.
- A pausa impede novas trocas e novos saques só são possíveis depois dela. Swaps já confirmados permanecem confirmados.
- Um administrador não saca vault, mint ou pool alheio: a conta substituta falha em autoridade da ATA (`ConstraintTokenOwner`) ou em seeds (`ConstraintSeeds`).
- Uma carteira que não é o admin não recupera a reserva, porque as seeds do pool embutem a chave do admin.

## Testes

Saldos em unidades brutas (6 casas). “Nenhuma alteração” significa saldo e contador idênticos antes e depois, e, onde a suíte consulta o recibo, ausência de conta de recibo.

### Suíte de base

| Id | Objetivo | Esperado | Observado | Assinatura | Saldos e contadores |
| --- | --- | --- | --- | --- | --- |
| Base-1 | Reserva vazia | `InsufficientReserve` | `InsufficientReserve` em `lib.rs:131` | `38tCzfe8nybhXGzYk8z6oBH1XHTAG9AwSgyg9bVbkKXKCQnuEUCWNaCSMWLa5cQpAzYMrLa4r591DxhXR2o45J95` | Nenhuma alteração |
| Base-2 | Reserva 500000 contra entrada 1000000 | `InsufficientReserve` | `InsufficientReserve` | `3DivG1kmrwv5evUeseK1Co8NrkYeBeRunUw8qBKoatDsvs3Q1WY5a9389WfX1bVGGERPTL1rWBWo6MBQvadrngha` | Nenhuma alteração |
| Base-3 | Chamada direta acima do teto por operação, digest correto | `LimitExceeded` | `LimitExceeded` em `lib.rs:123` | `4SXMnaZri6kUqqmJm19A6K6AiMYsG5WtNymdKUMt3Cy2q73jzkhRSnHXYbGB9CTiiomn8Q5TRbBWvojvbPWHPWDe` | Nenhuma alteração |
| Base-4 | Digest diferente dos parâmetros | `DigestMismatch` | `DigestMismatch` em `lib.rs:148` | `283kdFXiBAh1pVtoBXFqFrHC4SdYHoYD4uzZnQWdW8mtxtpbjZMf4X1J7gqpV5w6Yi9qruugTeDf2rAGFGqeUMuZ` | Nenhuma alteração |
| Base-5 | `minimum_out` acima da taxa | `MinimumOutputNotMet` | `MinimumOutputNotMet` em `lib.rs:130` | `5k8qnoRMriFAD7g5JykDUVj5mDzYpm2A5hJ4x3KhcshbUZuLJkkjeK3YgcSkvusKAPMH52HvXcGYqynNk2P6TvSD` | Nenhuma alteração |
| Base-6 | Taxa cotada diferente da taxa do pool | `QuoteChanged` | `QuoteChanged` em `lib.rs:124` | `7khFhK31EnMhs9qwkPxm4svdKdJvLEoEy97tjXPzjVcn5ZjphNuc7wJu43MnESNqr3kCVoxVS2upzkuKQwoiysK` | Nenhuma alteração |
| Base-7 | Swap sem assinatura do owner | Rejeição antes da execução | Verificação de assinatura falhou; sem assinatura de transação | — | Nenhuma alteração |
| Base-8 | Outra carteira usa o mandato | `ConstraintSeeds` | `ConstraintSeeds` na conta `mandate` | `5ma72fTQ911GfexfdcAdCLiezksPsuYXpZJ3YmCfceLXWQhu4G7QVprqorpSPYjASZe71qF5rhfkdAchr5f6kgnM` | Nenhuma alteração |
| Base-9 | Pool pausado | `Paused` | `Paused` em `lib.rs:118` | `2BE2MZ7rmtV1M5ZcuMqPfzE2Qzh8GnqJSqGFHBVNk5TNYy1DNAwnn7XBNSxwg3ZqotEekLjBTymXjV8ewN9bthvL` | Nenhuma alteração |
| Base-10 | Mandato pausado | `Paused` | `Paused` | `5gkF7E24XNka2mrryRBLdHsczgv2sCgVLdZdEDkRCyznap4Pxpsjku6HvNbHSqoNqQJwfrqqVdWZuJ6pWLN6Eugh` | Nenhuma alteração |
| Base-11 | Portfólio pausado | `Paused` | `Paused` | `rrKDiAacGS3qnKMp6zJ4ai3Sxgt91ErdWqp7VQJfifcWwp7D6WKbDtLe1RkCE21r6Hv5WkWssLdgAYqguAXcu6U` | Nenhuma alteração |
| Base-12 | Swap sintético válido | Aceite e recibo | Executado. Recibo `9UWkEpc2RbKf2cRHbb4HHUomEeFgpU6X6LMyeSw7sB1M`. Digest `0c12ffb918f3db638f9ed6ea2cdeb204c4e57be1bdacdf68dcdfd55f84c2e02b` | `ZTmAdm3euXBy5JYUSBkvyyygY1BoFFFVdHkqg2GT8Fk6N1puAX7keo4nMpmqafirLUgkFYXcjJLXGaLWqkpjWTk` | Owner dUSDC 10000000→9000000; dAAPL 0→1000000; pool dUSDC 0→1000000; pool dAAPL 5500000→4500000; gastos do mandato e do portfólio 0→1000000 |
| Base-13 | Replay do mesmo nonce | Conta de recibo já em uso | System Program `custom program error: 0x0` | `21gerh3GYfs438kME4dnCzNvfGxyD76V6LN5KBBCptPbWpTPCcQbU7xSnH96NBioFV3fQBuaY7cmdktyFEzkdY7b` | Nenhuma alteração |
| Base-14 | Uma unidade acima do teto agregado | `LimitExceeded` | `LimitExceeded` em `lib.rs:165` | `5Dqgkqh36aDdq1gSBbeEwopoS5CzXBtmcxzbRLzZexr3x2mSdcNHcjHMD9uNKxb2eeJ2cbmz3CedBQyrrsFWkVDT` | Nenhuma alteração |
| Base-15 | Mandato vencido, relógio do Surfpool | `Expired` | `Expired` em `lib.rs:120` | `Ad6MX4fXZe3TQy3pMgSUvPkbCVfdkLSZDUivF1EB4gYdQpXmwpGbXvBzN4sWv9n72qFAiRm7WWrXRhaeRUtZGBY` | Nenhuma alteração |

### A. Autoridade administrativa

O admin pausou o pool e retirou 100000 da reserva de saída e 50000 da reserva de entrada.

| Id | Objetivo | Esperado | Observado | Assinatura | Saldos e contadores |
| --- | --- | --- | --- | --- | --- |
| A1 | Saque autorizado com pool pausado | Só a reserva correta diminui; só a ATA do admin aumenta; mandato alheio intacto | Executado. Pool saída 4500000→4400000; pool entrada 1000000→950000; admin saída 4500000→4600000; admin entrada 0→50000. Pool B permaneceu 5000000/0. Mandato do owner de base permaneceu com gasto 1000000. Mandatos A e B permaneceram em 0 | Saída `42HPHoBvvnLBJrwpETeB5Xx29x52etYuUdW2R1fUWnPcHYghrzcdvySf93FcaF51xaLLyAx6jXm1VGsPHxpnDRDR`; entrada `5cHd5VSmapMc6Cpsbhexj2QHCGE5QGMKQ5RzHzEaf6aY9WBwQ6kog8rJoi96bN3gLpFT2WKPZCh9x1KqMNCpuQxi` | Ver coluna observada |
| A2 | Carteira estranha recupera a reserva | Rejeição e saldos intactos | `ConstraintSeeds` na conta `pool` | `3TCWY3txAd67xY9HMpox68TV2R4k31m8gLvuP27jFJDZrtYEiZWvBdvpEDhC7nvrNaG4vuX35m6QEfVNHQFptUyi` | Nenhuma alteração |
| A4-vault | Vault substituído pela ATA do owner | Rejeição por autoridade ou identidade | `ConstraintTokenOwner` em `pool_output_vault` | `3EFHWeXYnX2HMomdF2AGGkbpLBXMRWxK975BtdQVSBuMN5NkZtC9hjcfFMKHmzfwP6UxjhbiCesFw92UTDEn12qQ` | Nenhuma alteração |
| A4-pool | Vault do outro pool | Rejeição por autoridade, seeds ou mint | `ConstraintTokenOwner` em `pool_output_vault` | `2zRgd746qggPuPBR1mgmYpAxCgaXmWWcRARxpSJuEA4URW46M8pALVqCfjPHhQUUgWTiCUfX8g39SnF3gugE1B5G` | Nenhuma alteração. Pool B permaneceu 5000000/0 |
| A3 | Saque com o pool ativo | `MustPauseFirst` | `MustPauseFirst` em `lib.rs:241` | `4B9DJJGNB33Je6SLqi6xFckEenxZCiRJhUhTC13GVM5Ro26RgPwGki2iW7QCXuA7jiJj1xkbhD1s6Y9hAXXridSQ` | Nenhuma alteração |

### B. Isolamento entre proprietários

Os dois owners usam o mesmo pool. Tetos desta seção: portfólio A 1500, portfólio B 1000, por operação 1000.

| Id | Objetivo | Esperado | Observado | Assinatura | Saldos e contadores |
| --- | --- | --- | --- | --- | --- |
| B1-A | Troca válida de A, 1000, nonce 1000 | Só o mandato e o portfólio de A avançam | Executado | `4d1w5YXvK89V6mRfaWMZzYwEta5CaMtYRnPaZ2kGtaDQd8dLnPznAtntsFr4jL71EAFrLr6mvRhk43eu5BjJWWRj` | Mandato A 0→1000; portfólio A 0→1000; B permanece 0. Pool saída 4400000→4399000; pool entrada 950000→951000. A: entrada 10000000→9999000, saída 0→1000 |
| B1-B | Troca válida de B, 400, nonce 50 | Contadores de A intactos | Executado | `5REQBQpLmoX6Fqj1CLgc2poAiAQcsFU8M8zGitri9P4i2cXGHP7kQgGzU5GGBFsZie86x6hsisNaQGHKonSyW6R3` | Mandato B 0→400; portfólio B 0→400. A permanece 1000/1000. Pool saída 4399000→4398600; entrada 951000→951400 |
| B2 | B assina usando o mandato de A | `ConstraintSeeds` e sem recibo | `ConstraintSeeds`; `receiptExists: false` | `5PganCfwsZEhX3sqikgYDqYdkHTEy5QegTzZtWaJZ35mUBNupwxrR272BZ13g4CEYAevrmeq47eEi8AZQFYfLCpT` | Nenhuma alteração |
| B3 | Nonce 1000 no mandato de B, o mesmo número usado por A | Aceite e recibo distinto | Executado. Recibo de A `2uyYoZsZ283hjgbdWA4tYF5xob4ZKCvppr3MvcGMgtFu`. Recibo de B `GuMPzvLsmPKUkEmFtRuwCdtuMdSLpyZdv5ghfnUuWt6X` | `5HkfjeVHUVN3mC5VWmhKFRKZhmcAJDRXUGg5Q6xvd8qRbdHkQBffZ4Zj5b6SYDjWxzjxbnZTn8VuDsR67vpdaGbt` | Mandato e portfólio de B 400→500. A permanece 1000. Pool saída 4398600→4398500; entrada 951400→951500 |

A identidade do recibo inclui o mandato. O mesmo nonce numérico em mandatos diferentes não colide.

### C. Isolamento entre pools e teto agregado

O segundo pool usa o mesmo mint de entrada e outro mint de saída. O portfólio de A é `["portfolio", owner A, input_mint]`, compartilhado pelos dois pools. A já havia gasto 1000 de um teto de 1500. A tentativa de gastar mais 600 no pool 2 soma 1600.

| Id | Objetivo | Esperado | Observado | Assinatura | Saldos e contadores |
| --- | --- | --- | --- | --- | --- |
| C1 | Ultrapassar o agregado pelo segundo pool | `LimitExceeded`, pool 2 intacto, contador de A parado | `LimitExceeded` em `lib.rs:165`; recibo ausente | `TvikNB4Cwr6MRqvpYZbNY7oP6nFR17yU5MGSzrV5JXxH977EzuBhVm9SFB2xgUHRjrGNqY5Qr8ws3CGT36F8SJR` | Nenhuma alteração. Pool B permaneceu 5000000/0. Portfólio A permaneceu 1000 de 1500 |

### D. Transição de dia UTC

O relógio do Surfpool foi movido com `surfnet_timeTravel` e `absoluteTimestamp` em milissegundos, para 30 s antes da meia-noite UTC seguinte e depois para 60 s após essa fronteira. O teste não usa o relógio de parede.

| Id | Objetivo | Esperado | Observado | Assinatura | Saldos e contadores |
| --- | --- | --- | --- | --- | --- |
| D-before | Consumir o teto diário de 1000 antes da meia-noite | Aceite | Executado | `2TJz5LywHGidQFMW9WRVeEquCv3wDV9Ldj7G2EPknzNT8NrwbUC9SPfwyhUTw8ASFEyvQX8wMiuttXCNf15svBD8` | Pool saída 4398500→4397500; entrada 951500→952500. Gasto do portfólio de D = 1000 |
| D-full | Mais 1 unidade no mesmo dia | `LimitExceeded` e sem recibo | `LimitExceeded` em `lib.rs:165` | `55M2eznfctcmTgQYL3Kdmnghpfo15WRQ2D9Q32nEY4tVM4qEXz4uoQdVShRikeYPfSuu4EpN6XTJVM4AAdtEr7Fp` | Nenhuma alteração |
| D-after | Dia seguinte reinicia o contador e preserva o teto | Nova troca de 1000 aceita; gasto volta a 1000, não acumula 2000; `max_daily` do mandato permanece 1000 | Executado. Leitura posterior: gasto 1000→1000 e teto 1000→1000 | `5L1UjGqNPWLFG6DXSZv1Wmy7X9NBXaAsvwRdNxsk9Tox8FrFtz62rZqzw9atFtuHGhumMBk7Z3ZMHfbEqWJN3wXX` | Pool saída 4397500→4396500; entrada 952500→953500 |

### E, F e G. Atomicidade, programa de token e digest

Os casos de reserva, mínimo, limite, pausa, prazo e digest adulterado já estão na suíte de base. Todos terminaram sem delta. O caso novo de conta inválida usa a ATA de saída no lugar da conta de entrada e a ATA de entrada no lugar da conta de saída, contas distintas, para a checagem de mint ocorrer.

| Id | Objetivo | Esperado | Observado | Assinatura | Saldos e contadores |
| --- | --- | --- | --- | --- | --- |
| E-account | Conta de token de outro mint | Rejeição e recibo ausente | `ConstraintTokenMint` em `owner_input`; recibo ausente | `4sVhGUbZMjLj4g5vkbtgVWWZGA6w5zgyCecw9qyuUCziczEhM7HhV2wQ3bwbzL2dRNLd5Afk24FXQEdkF5zBTbbx` | Nenhuma alteração |
| F | Token-2022 no lugar do programa clássico | Rejeição do programa | `InvalidProgramId` na conta `token_program` | `ugehU7tR3mgaBx7MPhmQx5yNaqexbq3Hz1c5WN3zNxPvqqqJECwNYMt3kwPrxeSLmdoDGW782DEJMrkA8h8vKC6` | Nenhuma alteração |
| G | Digest calculado com outro program id, demais campos iguais aos da instrução | `DigestMismatch` e sem recibo | `DigestMismatch` em `lib.rs:148`; recibo ausente | `3GZzFT6YtYcgApSZUKBdf5vwxbsprM9Y5PhfPUxVnYimCQ1zTmyHXwLtybEc9HWgSRHwx7C67CA1CSNrKG8RpLLT` | Nenhuma alteração |

O digest on-chain é SHA-256 de `proofgate-settlement-lab/execution-v1`, program id, owner, pool, mandato, mint de entrada, mint de saída, `amount_in`, `amount_out`, `minimum_out`, nonce, deadline e taxa, todos os inteiros em little-endian. O teste de host `execution_digest_binds_every_executed_field` altera cada um desses campos e exige outro hash. O cliente da suíte serializa a mesma sequência. Um digest externo arbitrário não é gravado no recibo: a instrução recalcula e compara antes de mover contadores e tokens.

## Limitações

- A execução continua exclusivamente experimental, no Surfpool local.
- O contrato não valida o Research Lab.
- O contrato não autentica oráculos.
- O contrato não lê nem verifica uma decisão `REVIEWABLE`.
- O digest de execução compromete os parâmetros da instrução. A assinatura Ed25519 compromete o digest da autorização. Nenhum dos dois lê o Research Lab nem uma decisão `REVIEWABLE`.
- O serviço em `apps/proofgate-authorization-service` decide localmente quando o policy signer assina. Não é um KMS, não tem endpoint público e não autentica clientes. A suíte adversarial antiga continua com um fixture em memória.
- A SVM não expõe o genesis hash ao programa. A identidade de implantação é o `deployment_id` gravado na config.
- A autorização canônica tem 530 bytes. A precompile assina o SHA-256 desses bytes para caber no limite de 1232 bytes da transação.
- A interface não está integrada.
- Não há negociação de ativos reais. Os mints são SPL clássicos criados nesta execução local.
- Não há suporte a Token-2022, e a suíte confirma a rejeição.
- O admin, com o pool pausado, pode retirar as duas reservas. Isso é a contraparte administradora, não custódia soberana do usuário.
- Os tetos são os gravados na inicialização do mandato e do portfólio. Nada impede um owner de criar um mandato com teto alto. O que o contrato impede é ultrapassar o teto que ficou gravado, inclusive somando pools que compartilham o mint de entrada.

## Marco B — autorização verificada nesta execução

O caminho válido da suíte anterior passou de novo, agora com as duas autorizações. Swap dUSDC→dAAPL, assinatura `3JbePDh1H2yK9tzR3bTwA2UcH6yLk9syLbDv8rU5Jn2aGJY4mE9zNabPYikbd5NrhpvZWixcRvGWEm3G4tpqEMRU`, recibo `DFWsxyApJERPoqKC9SS1fp1nWE9AYC7kGATxHsCN85s3`, digest de execução `93f1e5bc9d31b7d01e647dcf083368d4dece72034feaa6113f6008921c831689`. Owner dUSDC 10000000→9000000, dAAPL 0→1000000; reserva de entrada 0→1000000; reserva de saída 5500000→4500000; gastos 0→1000000.

B01, em outro owner e com quantidade 1000, assinatura `E1SoT9EmqFMuZ93poi1gtxXyV3DQ4sysHXiAzEJh53fFXv1xsFvGp7QooEdHoCpngA5zMAo6p6posAECHUj9Uur`. Entrada do owner 5000000→4999000, saída 0→1000, gasto do mandato e do portfólio 0→1000.

| Caso | Observado | Assinatura | Estado |
| --- | --- | --- | --- |
| B02 sem ProofGate | `MissingProofGateAuthorization` | `4b66Kyuj7UzXYu2fJNwRAduBmY4QoxspFihxwdhzPNKNhmy1rbkMc4CYFS9QEXCX5deShNaX793JSuERgdvF6rkb` | Sem delta e sem recibo |
| B03 sem assinatura do owner | Verificação de assinatura da transação falhou | — | Sem delta e sem recibo |
| B04 assinatura inválida | Precompile, instrução 0, `Custom(2)` | `55vLDhoW8dtDcyiFZK3QRemfrUsBm53eK2rGpct57mCgKcatTuq7GMdzZQov6cJYBhqNjQr51tVV1CMePw8K19Du` | Sem delta e sem recibo |
| B05 signer desconhecido | `UnknownPolicySigner` | `yj4AgkAvMVn4aLB4BDpPqZRCSGHv97AhqXkbcS7frkRowGogPAmVhWU3V1Ndm6z9ZghDR6h9iAkVGiCaNf2iUFS` | Sem delta e sem recibo |
| B06–B13, B19–B23 | `AuthorizationMismatch` | Ver `programs/target/surfpool-results.json` | Sem delta e sem recibo |
| B14 nonce reutilizado | System Program `0x0`; o recibo de B01 permanece | `3kdJACoyCwhgb2kVoBC3W6bcwL4R5WKQhGzGBvk6sjtLDJRkKeYzcXepJ3NXsbXUmgheTiAPQRVBTmijYo1foX6e` | Sem delta |
| B15 expirada | `AuthorizationExpired` | Registrada no resultado local | Sem delta e sem recibo |
| B16 outra versão | `AuthorizationMismatch` depois de `set_policy_version(2)` | `3NrLVJPTo81GU5Mrz4yfBRTAm9B8PAYeRGf9nvspfqRigGvcR2NLGUdjGZ8DN4DouuRHZqm47j5WjgggiF7sD5D1` | Sem delta e sem recibo |
| B17 epoch revogado | `AuthorizationMismatch` | `5XuDjyA6imkrRY1ENy1EaNRmGBtksFr1wpXypbPeEcctD3WrqxZ3dBSCUh4JBCJ6WFB29QubFZCvKqbbmpt5anar` | Sem delta e sem recibo |
| B18 config pausada | `GovernanceHalted` | `ELtcKXNnY1Lg6A76yY9B4Y4TmJb1YxbdnzSQ5SjHNUSVsBZxHMYMoZ87Z5nvNeyYMpyDuXS3XBcbLwhkNyhnFN2` | Sem delta e sem recibo |
| B24 índices Ed25519 não canônicos | `MalformedEd25519` | `5aFonzvnfXJposTcERVx7aNrf8waK3cynrVcjx4K7Nk7pDFfnkrqV8o1YyFfPGFub72QFPhXXRqfWcyKUK2Zz4gw` | Sem delta e sem recibo |
| B25 acima do mandato | `LimitExceeded` com autorização válida | `2qoW4hZcoUqA5zfDQ67rVD4vkiniQA9aSWpopVcMQZdpdJeUdmmED811vWbLc2MzgHKgmB1c4URZFYJbCfAeVXa7` | Sem delta e sem recibo |
| B26 acima do agregado, outro pool | `LimitExceeded` | `2SbbJjDfCdqRtCTotwDQDQr4iywuhpmLyR5XKwjD4KMNiCc1x7GMbfS7bX7TdTvTS6b9jpZyX2VwB8ALJwEW22u3` | Sem delta e sem recibo |
| B27 pool pausado | `Paused` | Registrada no resultado local | Sem delta e sem recibo |
| B28 reserva insuficiente | `InsufficientReserve` | `3cxwXPnmDXWjvNQ8DRPckf5WV2kKwQW6DqTgzLS5BfyuJ38QFrRHDTQ2LeeFy5jUSGBoVPMipmtLY4C26QP65JD3` | Sem delta e sem recibo |

As tabelas de assinatura mais abaixo descrevem a forma dos cenários de custódia. Os endereços e as assinaturas da execução que conta são os desta seção e o arquivo de resultado local, que o Git ignora.

## Critérios de aceitação

1. Compilação host e SVM: atendido, sem estouro de stack.
2. Testes unitários: 5 aprovados, 0 falhas, incluindo o vetor Rust/JavaScript.
3. Os 35 cenários anteriores e B01–B28 rodaram na mesma suíte: 63 aprovados, 0 falhas.
4. Transações rejeitadas preservam saldos e contadores. O recibo novo não aparece. No replay, o recibo antigo permanece e o contador não anda.
5. Swap com owner e ProofGate move os tokens esperados.
6. Chamada direta sem a instrução Ed25519 anterior retorna `MissingProofGateAuthorization`.
7. Autorização acima do mandato ou do agregado, com pool pausado ou sem reserva, continua rejeitada.
8. Versão, epoch, pausa da config, outro signer, outra mensagem e índices Ed25519 não canônicos são rejeitados.
9. Vaults, saque administrativo e teto agregado do Marco A continuam valendo.
10. Nenhuma chave privada entrou no relatório. `**/*-keypair.json` permanece no `.gitignore`. Nenhum commit foi feito.
11. `apps/web/programs/kairos-engine` não foi modificado.
12. Nenhuma transação foi enviada à Devnet pública ou à Mainnet.

Marco B concluiu na execução anterior com 63/0. O contrato exige as duas autorizações. O Marco C1 reexecutou essa suíte junto com a governança monotônica e o serviço; o resultado corrente está na seção seguinte.

## Marco C1 — serviço de autorização e versão monotônica

Comandos, a partir de `programs/` salvo o teste do serviço:

- `cargo test -p proofgate-settlement-lab` — 6 aprovados, 0 falhas. O sexto cobre `monotonic_policy_update`: versão maior avança o epoch; versão igual, versão menor e overflow de epoch falham.
- `CARGO_TARGET_DIR="$PWD/target" NO_DNA=1 cargo-build-sbf --manifest-path proofgate-settlement-lab/Cargo.toml` — concluído, sem `Stack offset`.
- `node --test test/authorization.test.mjs` em `apps/proofgate-authorization-service` — 13 aprovados, 0 falhas. C01–C24 e C26–C28. Nos casos bloqueados o assinador instrumentado permaneceu em zero.
- `node settlement-lab-tests/run.mjs` — 67 aprovados, 0 falhas, Surfpool offline em `http://127.0.0.1:18999`, núcleo `4.1.2`. Os 63 cenários anteriores permanecem nessa conta. Entraram C25 e os três casos do serviço.

Mints desta execução, não reutilizáveis: dUSDC `gQkbLyUPcusA8L2SSRo1YvvofrsXqjtRzrEM9mMCMxf`, dAAPL `FdFskjKH5WWfYsYDHjgABtwYgQicgS1nLe9UczAKa4d`. Programa `CJ2NA3E8ZWZFMjrLtzAKxGZNomLBP4Tvnh8hQiFD3ecA`.

| Caso | Observado | Assinatura | Estado |
| --- | --- | --- | --- |
| C25 versão igual e versão 1 | `PolicyRegression` (6022) nas duas; versão permanece 2 e epoch permanece 2 | `8uAWsocd5rYYZvhaTkhh3HH9o2Skibpmyf1u7h3srZMU7eRJEXqQ7Gy9EdVH5EgebGACfKmKjWfHHooV9dLzDyH` | Config inalterada |
| C-E2E swap pelo serviço | `AUTHORIZED`; recibo `7QFSqvPz6V68xPm6Wpwt3xshH5ZR4RkvFSxPn8USjEzi`; digest `a1405895784614b257ed21cb94169824fdbb58a7765827f21bcb5540afd0a1ec` | `2Y2eNX8kVziBffRb8PkmKJaj5DBZqQnTs46xkweDzkCaURKApKeDATbnn2GpoxbZVr52KQhE7K1R5SaYk3DSByM1` | Owner 10000→9000 e 0→1000; pool 954500→955500 e 4395500→4394500 |
| C-BLOCK ativo fora do registro | `BLOCKED`; assinaturas permanecem 1 | — | Sem transação |
| C-BYPASS `execute_swap` sem Ed25519 | `MissingProofGateAuthorization` | `D1p77Y6gcKDRDbKQYQs5rrAXdmDZmotkvKp8o6sM1gdcSRCxnmRBpNCyykFCn7EJyDFoWD3Yiu741S9ASL6DgMq` | Sem recibo |

O catálogo de pesquisa não foi usado como allowlist. `REVIEWABLE` e uma saída de pesquisa não autorizam. Não há adaptador de oráculo. A deduplicação de nonce do serviço está na memória do processo. O programa continua sendo a trava de replay. Nenhuma chave privada foi gravada. O KAIROS não foi modificado. Não houve deploy público. O dashboard não foi integrado.
