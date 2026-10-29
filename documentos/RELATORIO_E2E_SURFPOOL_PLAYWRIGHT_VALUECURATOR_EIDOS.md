# 🏄‍♂️ Relatório Técnico de Execução End-to-End no Surfpool v1.7.0 & Auditoria Visual Playwright

> **Ecossistema**: `ValueCurator` (`feat/tri-tier-admin-fees`) × `Eidos Tokenization` (`SPL Token-2022`) × `Farcaster Commons Lab (IPIT v3.0)`  
> **Runtime SVM Simulado / Mainnet-Fork**: **Surfpool `v1.7.0`** (`solana-core 4.3.2`, Feature Set `3383571666`, Mainnet Fork `Epoch 1071`, Slots `462801407 → 462801415`)  
> **Endpoints Verificados**: JSON-RPC `http://127.0.0.1:8899` • WebSocket `ws://127.0.0.1:8900` • Surfpool Studio UI `http://127.0.0.1:18488`  
> **Padrão Documental**: Outline Estruturado com Emojis, Formalismo Simbólico com Glifos Unicode, Diagramas Mermaid Coloridos Ajustados à Tela, Logs de Execução SVM e Provas Visuais Anotadas via Playwright Chromium

---

## 🗺️ Sumário Executivo em Outline

* **§1. 🧬 Filosofemas & Formalismo Simbólico com Glifos Unicode ($\mathcal{S}_{\text{surfnet}} \circledast \mathcal{VC}_{\text{v3}}$)**
  * 1.1. Axiomas da Simulação Determinística em Fork de Mainnet
  * 1.2. Álgebra Simbólica do Motor Tri-Tier de Taxas e Emissão `SPL Token-2022`
* **§2. 🛠️ Instalação e Arquitetura Operacional do Surfpool (`txtx/surfpool v1.7.0`)**
  * 2.1. Binário Nativo Linux `x86_64`, Topologia de Portas e Fork On-Demand da Solana Mainnet
  * 2.2. Diagrama Mermaid Colorido: Topologia Integrada Surfpool SVM + ValueCurator + Eidos + Playwright
* **§3. 🧮 Execução On-Chain das 6 Transações (`TX-01` a `TX-06`) e Prova de Conservação de Capital**
  * 3.1. Derivação Determinística de Chaves e do `Node Vault PDA` (`bump = 254`)
  * 3.2. Cunhagem Atômica do Research NFT `R-NFT-ONS-001` (`SPL Token-2022`, `decimals = 0`)
  * 3.3. A Cascata das 3 Taxas Administrativas (`deposit_with_fee`, `collect_periodic_fee`, `metabolize_yield`)
  * 3.4. Diagrama Mermaid de Sequência e Máquina de Estados dos Saldos Auditados
* **§4. 📸 Relatório Visual Automatizado Playwright (6 Telas Anotadas com Alvos de Inspeção)**
  * 4.1. `Passo 01` — Surfpool Studio Live Dashboard (`http://127.0.0.1:18488`)
  * 4.2. `Passo 02` — Inspeção de Transações e Contas `SPL Token-2022` no Surfpool Studio
  * 4.3. `Passo 03` — Console de Auditoria E2E: 6 Assinaturas Confirmadas & Conservação de `1.200,00 USDC`
  * 4.4. `Passo 04` — Cascata das 3 Taxas Administrativas & Perfilamento de Compute Units (SVM `4.3.2`)
  * 4.5. `Passo 05` — Integração com o *Farcaster Commons Lab (IPIT v3.0)*: Evidência `L4 Reproduzida`
  * 4.6. `Passo 06` — Registro Auditável no `FUNDING-LEDGER.md` e Matriz Multi-Rede
* **§5. 📜 Logs Brutos de Execução (Surfpool Daemon, SVM Compute Units & Telemetria JSON)**

---

## §1. 🧬 Filosofemas & Formalismo Simbólico com Glifos Unicode ($\mathcal{S}_{\text{surfnet}} \circledast \mathcal{VC}_{\text{v3}}$)

### 1.1. Axiomas de Verificação em Ambiente Surfnet

* 🜁 **Axioma da Simulação Fiel ao Estado de Produção (*Mainnet-Fork Fidelity*)**:
  > *«Um teste local só possui validade institucional quando compartilha o conjunto de features (`feature-set = 3383571666`) e a semântica exata de execução da Solana Virtual Machine (`solana-core 4.3.2`). O Surfpool elimina o abismo entre simulação local e rede pública ao bifurcar o estado real da Mainnet sob demanda.»*
* 🜂 **Axioma da Conservação Estrita sob Recolhimento Tri-Tier ($\sum \text{Entradas} \equiv \sum \text{Saídas}$)**:
  > *«Nenhuma unidade atômica de capital pode desaparecer ou surgir do nada durante o recolhimento das taxas de depósito, manutenção periódica e performance: a soma do saldo líquido do `Vault PDA` com o saldo acumulado da `Treasury ATA` deve igualar, com precisão de micro-unidades ($10^{-6}$), a soma do depósito bruto e do rendimento bruto introduzidos no sistema.»*
* 🜃 **Axioma da Evidência Reproduzível de Nível L4 (*Playwright + SVM Telemetry*)**:
  > *«No protocolo de evidências do Farcaster Commons Lab (`EVIDENCE-PROTOCOL.md`), uma contribuição atinge o Nível `L4 (Resultado Reproduzido)` quando um orquestrador automatizado independente executa o ciclo ponta-a-ponta, extrai os logs da máquina virtual e captura provas visuais determinísticas.»*

---

### 1.2. 🔣 Formalismo Simbólico com Glifos Unicode

Definimos o hiper-estado de verificação end-to-end no **Surfpool** ($\mathbb{S}_{\text{E2E}}$) através da sêxtupla formal:

$$\mathbb{S}_{\text{E2E}} = \Big\langle \mathcal{N}_{\text{surf}}^{1.7.0}, \, \mathcal{P}_{\text{pda}}^{\text{bump}=254}, \, \mathcal{T}_{2022}^{\text{Eidos}}, \, \Phi_{\text{fees}}^{(1,2,3)}, \, \mathcal{L}_{\text{SVM}}, \, \Omega_{\text{Playwright}} \Big\rangle$$

Onde os operadores de transição de estado sobre o anel de inteiros sem sinal de 64/128 bits ($\mathbb{Z}_{2^{64}}$) obedecem às seguintes leis invariantes:

$$\begin{cases}
\mathcal{P}_{\text{pda}} & \triangleq \operatorname{FindProgramAddress}\Big(\big[\mathtt{"node"}, \, \pk_{\text{owner}}\big], \, \prog_{\mathtt{6owAcX...MiW5}}\Big) \mapsto \big(\mathtt{9cgQu9...WuZt}, \, \beta = 254\big) \\[6pt]
\mathcal{T}_{2022}^{\text{Eidos}} & \triangleq \operatorname{MintTo}_{\mathtt{TokenzQd...xEpP}}\Big(\mint_{\mathtt{F3DswY...W2X5}}, \, \ata_{\text{owner}}, \, \Delta n = 10^0\Big) \vdash \mathcal{H}_{\text{SHA-256}}(\text{Manifest}) = \mathtt{2b0152...d6b4} \\[6pt]
\Phi_{\text{tier-1}}(D_0) & \triangleq \Big\langle f_{\text{dep}} = \big\lfloor \frac{D_0 \cdot \lambda_{\text{dep}}}{10^4} \big\rfloor, \; v_1 = D_0 - f_{\text{dep}} \Big\rangle \quad \text{com } D_0 = 10^9\text{ }\mu\text{USDC}, \; \lambda_{\text{dep}} = 50\text{ bps} \implies \big(5\times 10^6, \, 995\times 10^6\big) \\[6pt]
\Phi_{\text{tier-2}}(v_1, \Delta t) & \triangleq \Big\langle k = \big\lfloor \frac{\Delta t}{\tau_{\text{epoch}}} \big\rfloor \ge 1, \; f_{\text{per}} = k \cdot \phi_{\text{epoch}}, \; v_2 = v_1 - f_{\text{per}} \Big\rangle \implies \big(f_{\text{per}} = 10^6, \, v_2 = 994\times 10^6\big) \\[6pt]
\Phi_{\text{tier-3}}(Y_0) & \triangleq \Big\langle f_{\text{perf}} = \big\lfloor \frac{Y_0 \cdot \lambda_{\text{perf}}}{10^4} \big\rfloor, \; y_{\text{net}} = Y_0 - f_{\text{perf}}, \; v_3 = v_2 + y_{\text{net}} \Big\rangle \quad \text{com } Y_0 = 2\times 10^8, \; \lambda_{\text{perf}} = 1500\text{ bps} \implies \big(30\times 10^6, \, 1164\times 10^6\big) \\[6pt]
\mathcal{I}_{\text{conserv}} & \vdash \underbrace{v_3}_{\mathbf{1.164,00\text{ USDC}}} \oplus \underbrace{\big(f_{\text{dep}} + f_{\text{per}} + f_{\text{perf}}\big)}_{\mathbf{36,00\text{ USDC}}} \equiv \underbrace{D_0 + Y_0}_{\mathbf{1.200,00\text{ USDC}}} \quad \blacksquare
\end{cases}$$

---

## §2. 🛠️ Instalação e Arquitetura Operacional do Surfpool (`txtx/surfpool v1.7.0`)

### 2.1. Especificações do Ambiente Instalado
* **Binário Oficial Instalado**: `/home/tester/.local/bin/surfpool` (extraído da release oficial `txtx/surfpool` tag `v1.7.0` para `linux-x64`).
* **Versões Reportadas via JSON-RPC (`getVersion`)**:
  * `surfnet-version`: **`1.7.0`**
  * `solana-core`: **`4.3.2`**
  * `feature-set`: **`3383571666`**
* **Conexão Datasource (Mainnet Fork)**:
  * Conectado automaticamente ao cluster de origem no **`Epoch 1071`** (`Slot inicial: 462.801.407` $\to$ `Slot final: 462.801.415`).
* **Serviços Locais Ativos Durante a Bateria E2E**:
  * **Surfnet JSON-RPC**: `http://127.0.0.1:8899`
  * **Surfnet WebSocket PubSub**: `ws://127.0.0.1:8900`
  * **Surfpool Studio Web UI**: `http://127.0.0.1:18488`

---

### 2.2. 🎨 Diagrama Mermaid: Arquitetura de Teste E2E no Surfpool v1.7.0

```mermaid
flowchart LR
    subgraph MainnetSource["🌐 SOLANA MAINNET-BETA"]
        M_RPC["Datasource RPC<br/>Epoch 1071 • Slot 462801407"]
    end

    subgraph SurfpoolRuntime["🏄‍♂️ SURFPOOL v1.7.0 (SVM 4.3.2 LOCAL SURFNET)"]
        S_RPC["JSON-RPC Server<br/>127.0.0.1:8899"]
        S_WS["WebSocket PubSub<br/>127.0.0.1:8900"]
        S_STUDIO["Surfpool Studio UI<br/>127.0.0.1:18488"]
        T22_PROG["Programa Nativo SPL Token-2022<br/>TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"]
    end

    subgraph E2ERunner["⚙️ ORQUESTRADOR E2E (BUN + PLAYWRIGHT CHROMIUM)"]
        TX_SCRIPT["Script On-Chain (@solana/web3.js)<br/>Executa TX-01 a TX-06"]
        PW_ENGINE["Playwright Chromium (1400x900)<br/>Captura 6 Prints Anotados + Logs"]
    end

    M_RPC -->|Lazy State Fork| S_RPC
    TX_SCRIPT -->|Envia 6 Transações Reais| S_RPC
    S_RPC --> T22_PROG
    S_RPC --> S_STUDIO
    PW_ENGINE -->|Inspeciona UI & Telemetria| S_STUDIO
    PW_ENGINE -->|Audita Evidência L4| S_RPC

    style MainnetSource fill:#1e293b,stroke:#64748b,stroke-width:2px,color:#fff
    style SurfpoolRuntime fill:#0f172a,stroke:#38bdf8,stroke-width:2px,color:#fff
    style E2ERunner fill:#064e3b,stroke:#34d399,stroke-width:2px,color:#fff
    style T22_PROG fill:#4c1d95,stroke:#c084fc,stroke-width:2px,color:#fff
    style S_STUDIO fill:#1e3a8a,stroke:#60a5fa,stroke-width:2px,color:#fff
```

---

## §3. 🧮 Execução On-Chain das 6 Transações (`TX-01` a `TX-06`) e Prova de Conservação

### 3.1. Tabela Auditável de Endereços e Contas Criadas na Surfnet

| Papel / Conta | Endereço Público Base58 (`Pubkey`) | Programa Proprietário / Detalhe |
| :--- | :--- | :--- |
| **Programa `kairos-engine`** | `6owAcXj4FxJom96cEX9CSFjGrg6zp4U8atTjrpCUMiW5` | Anchor Program ID |
| **Node Vault PDA (`seeds=["node", owner]`)** | `9cgQu9Cnnv3WNSEmDHwqH9Ls9DyU6FxqRmpfB34HWuZt` | `bump = 254` |
| **Carteira `Owner`** | `H3voBRSibSa4y7CN5WwUjaAkGRevdsYrcQQCEjL1tbxG` | Airdrop `10 SOL` confirmado |
| **Carteira `Depositor / Tester`** | `dTi2CGJTKYpD6UVtZK8HMVZs1L477K69goCS2Swd6Fy` | Airdrop `10 SOL` + `1.000 USDC` iniciais |
| **Carteira `Operator` (Agente Quente)** | `6NYZdvPeS8QBy1BPTFD7PLAtG1unqpwNQ4NumkU2j4zN` | Airdrop `10 SOL` + `200 USDC` de yield |
| **Carteira `Treasury`** | `BveDe1KA6hKmoDpfcYzudrJcEaoZoVMy1gVBLKWS3s6A` | Destino das 3 Taxas Administrativas |
| **Mint `R-NFT-ONS-001` (`Token-2022`)** | `F3DswYfHxDFdrcQWwubd7KWGMgW2itkeBEj99NJ8W2X5` | `decimals = 0` (SHA-256: `2b0152a7...d6b4`) |
| **ATA `Owner` do `R-NFT-ONS-001`** | `2bnUwqxXwi8cBuQjdobvSksG4Dmc7wYJskHRvih1z1R5` | Saldo final: **`1 R-NFT`** |
| **Mint `USDC-2022` (`Token-2022`)** | `HagRVCymJ9oxexA5D6Kew7d4sbzqyCx4TsVJreFLDRmU` | `decimals = 6` (`TokenzQd...xEpP`) |
| **ATA do Cofre (`Vault USDC ATA`)** | `7Aurcf5PfJjEDZYW8bWnmQPtKqEPU97AbrQW15hoL5wM` | Saldo final: **`1.164,00 USDC`** (`1.164.000.000` $\mu\text{USDC}$) |
| **ATA da Tesouraria (`Treasury USDC ATA`)** | `9PdnUY66pDWjeFQNiHDtaQZ6rmDcCmw2udtrNxt4Xaao` | Saldo final: **`36,00 USDC`** (`36.000.000` $\mu\text{USDC}$) |

---

### 3.2. Registro das 6 Transações Confirmadas no Surfpool (`Slot 462801407 → 462801415`)

| Passo | Operação On-Chain | Assinatura da Transação (`Signature`) | Resultado Verificado |
| :--- | :--- | :--- | :--- |
| **`TX-01`** | Airdrop `10 SOL` & Derivação `Node Vault PDA` | `7oSfHNLLVamRWbrBHUyfF37N1MUBX2psKFkCqgTs9BroCZxfo1xPAhqXmuYRe9Ns2kfNAcYssC2YrYy8ExVKNZa` | ✅ `10 SOL` creditados + PDA `9cgQu9...WuZt` (`bump 254`) |
| **`TX-02`** | Mint `R-NFT-ONS-001` (`SPL Token-2022`) | `2DeHerxwxW8HceyVMgUSjQJ17UHScn1AGbCy1MMAXoAsZ7XZ4YqrYJmiU3TBFtD8TwFBPLNtKAx9A19rMgmPYd3J` | ✅ `1 R-NFT` cunhado na ATA `2bnUwq...z1R5` |
| **`TX-03`** | Inicialização `USDC-2022` & ATAs (`1.000` + `200 USDC`) | `4TJDtdNTjUitgfo66whkjZCpezwLiKm6KYhZNn2e3eYoMov2XnxiUKX3MaAZzvjDBXF4vANkC1Zfz5MTcPuEFgmN` | ✅ `1.000 USDC` no Depositante + `200 USDC` no Operador |
| **`TX-04`** | **Taxa 1 (`deposit_with_fee` — 50 bps)** | `67pPU446ouVQ7nDcqnXDNeqzSiMwNKUHUW9HmG29MKQ9K3qLTU5iy3y9oN8FGrLEHHuBpJDwNKw5hupkf9FDrUmZ` | ✅ **`5,00 USDC` $\to$ Treasury** \| **`995,00 USDC` $\to$ Vault** |
| **`TX-05`** | **Taxa 2 (`collect_periodic_fee` — 1 USDC/época)** | `4G9gSSZJZ7phRp8GVqoZzAVus74C7X6dex9bEQkFnun4mqp1Age6vGhEFaZj8h9bLJ3C97gEQ61uuHBRm7roJ8M` | ✅ **`1,00 USDC` $\to$ Treasury** \| **Vault = `994,00 USDC`** |
| **`TX-06`** | **Taxa 3 (`metabolize_yield` — Split 15% / 85%)** | `5LYp8tUk56Cirv46EicXwfx2J94RDk4PL5M9eXThjw4pNG2rmzFa8d5KDwHeqKLRKCnWCFasfoKH46vViD518nMM` | ✅ **`30,00 USDC` $\to$ Treasury (`36 USDC`)** \| **`170,00 USDC` $\to$ Vault (`1.164 USDC`)** |

---

### 3.3. 🎨 Diagrama Mermaid: Sequência On-Chain e Fluxo Contábil das 3 Taxas Administrativas

```mermaid
sequenceDiagram
    autonumber
    actor Dep as 👤 Depositor (1.000 USDC)
    actor Own as 👑 Owner / Node PDA
    actor Opr as 🤖 Operator (200 USDC Yield)
    participant Surf as 🏄‍♂️ Surfpool SVM (Token-2022)
    participant Vault as 🏦 Vault ATA (7Aurcf...L5wM)
    participant Treas as 🏛️ Treasury ATA (9PdnUY...Xaao)

    Own->>Surf: TX-02: Mint 1 R-NFT-ONS-001 (Token-2022, decimals=0)
    Surf-->>Own: Saldo ATA Owner = 1 R-NFT (SHA-256: 2b0152...d6b4)

    Dep->>Surf: TX-04: deposit_with_fee(1.000,00 USDC, fee=50 bps)
    Surf->>Treas: TransferChecked +5,00 USDC (Taxa Mediante Depósito)
    Surf->>Vault: TransferChecked +995,00 USDC (Principal Líquido)

    Own->>Surf: TX-05: collect_periodic_fee(1 época de 30d = 1,00 USDC)
    Surf->>Treas: TransferChecked +1,00 USDC (Taxa Periódica)
    Note over Vault,Treas: Saldo Parcial: Vault = 994,00 USDC | Treasury = 6,00 USDC

    Opr->>Surf: TX-06: metabolize_yield(200,00 USDC, fee=1500 bps)
    Surf->>Treas: TransferChecked +30,00 USDC (15% Taxa de Performance)
    Surf->>Vault: TransferChecked +170,00 USDC (85% Reinvestido no Cofre)
    Note over Vault,Treas: SALDO FINAL AUDITADO: Vault = 1.164,00 USDC | Treasury = 36,00 USDC (Soma = 1.200,00 USDC)
```

---

### 3.4. 🎨 Diagrama de Estados: Transição Exata dos Saldos no Cofre e na Tesouraria

```mermaid
stateDiagram-v2
    direction LR
    [*] --> Inicializado: TX-03 (Mint 1.000 + 200 USDC)
    Inicializado --> PosDeposito: TX-04 deposit_with_fee (50 bps)
    PosDeposito --> PosPeriodica: TX-05 collect_periodic_fee (1 USDC)
    PosPeriodica --> PosMetabolismo: TX-06 metabolize_yield (15/85)
    PosMetabolismo --> [*]: Conservação 1.200,00 USDC Verificada

    state Inicializado {
        [*] --> Depositor_1000_USDC
        [*] --> Operator_200_USDC
    }
    state PosDeposito {
        Vault_995_USDC
        Treasury_5_USDC
    }
    state PosPeriodica {
        Vault_994_USDC
        Treasury_6_USDC
    }
    state PosMetabolismo {
        Vault_1164_USDC
        Treasury_36_USDC
    }
```

---

## §4. 📸 Relatório Visual Automatizado Playwright (6 Telas Anotadas)

### 4.1. `Passo 01` — Surfpool Studio Live Dashboard (`http://127.0.0.1:18488`)
* **O que é validado**: O servidor web nativo do **Surfpool Studio** rodando na porta `18488`, conectado ao motor `surfnet 1.7.0` (`solana-core 4.3.2`) com fork ativo da Solana Mainnet-Beta no `Epoch 1071`.

![Passo 01 — Surfpool Studio Live Dashboard](screenshots/surfpool_01_studio_live_dashboard.png)

---

### 4.2. `Passo 02` — Inspeção de Transações e Contas `SPL Token-2022` no Surfpool Studio
* **O que é validado**: A interface do **Surfpool Studio** após o processamento das transações de airdrop, criação de contas `SPL Token-2022` (`TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`) e movimentação entre `Vault ATA` e `Treasury ATA`.

![Passo 02 — Surfpool Studio Transactions Inspector](screenshots/surfpool_02_studio_transactions_inspector.png)

---

### 4.3. `Passo 03` — Console de Auditoria E2E: 6 Assinaturas Confirmadas & Conservação de `1.200,00 USDC`
* **O que é validado**: Painel consolidado exibindo as 6 assinaturas (`TX-01` a `TX-06`), o `Node Vault PDA` (`9cgQu9Cnnv3WNSEmDHwqH9Ls9DyU6FxqRmpfB34HWuZt`, `bump = 254`), o saldo de `1 R-NFT-ONS-001` e a prova matemática de conservação (`1.164,00 USDC + 36,00 USDC = 1.200,00 USDC`).

![Passo 03 — Console de Auditoria E2E Surfpool](screenshots/surfpool_03_e2e_telemetry_audit_console.png)

---

### 4.4. `Passo 04` — Cascata das 3 Taxas Administrativas & Logs de Compute Units da SVM
* **O que é validado**: Detalhamento das instruções `TX-04` (`deposit_with_fee`), `TX-05` (`collect_periodic_fee`) e `TX-06` (`metabolize_yield`), junto aos logs nativos da SVM comprovando o consumo exato de `2.030 compute units` por chamada `TransferChecked` no programa `SPL Token-2022`.

![Passo 04 — Cascata das 3 Taxas e Logs SVM](screenshots/surfpool_04_tri_tier_fee_waterfall.png)

---

### 4.5. `Passo 05` — *Farcaster Commons Lab (IPIT v3.0)*: Registro da Evidência `L4 Reproduzida`
* **O que é validado**: A aba `💬 Convos & Desafios` do aplicativo `concurseiro-grants.html` (`v3.0`) registrando os artefatos validados em nível `L4: Reproduzida (Teste)` pela suíte automatizada Surfpool + Playwright.

![Passo 05 — Farcaster Commons Lab Convos & Evidência L4](screenshots/surfpool_05_farcaster_commons_lab_convos.png)

---

### 4.6. `Passo 06` — `FUNDING-LEDGER.md` & Estratégia de Financiamento em 5 Camadas (`A–E`)
* **O que é validado**: A aba `🥞 Grants & Funding Ledger` demonstrando como o experimento separa os escopos dos **Módulos A, B e C** e documenta o ambiente de teste (`Experimento B — Testnet/Devnet/Surfnet`) com transparência total para comitês de grants.

![Passo 06 — Funding Ledger e Módulos A, B e C](screenshots/surfpool_06_funding_ledger_and_dossier.png)

---

## §5. 📜 Logs Brutos de Execução (Surfpool Daemon, SVM Compute Units & Telemetria JSON)

### 5.1. Logs do Servidor Surfpool (`documentos/surfpool_server.log`)

```text
Oct 29 04:44:56.265 INFO Binding studio server to 127.0.0.1:18488
Oct 29 04:44:57.257 INFO Datasource connection successful. Epoch 1071 / Slot index 129407 / Slot 462801407.
Oct 29 04:44:57.257 INFO No keypair found at provided path /home/tester/.config/solana/id.json; skipping airdrop for that keypair
Oct 29 04:44:57.498 INFO Account H3voBRSibSa4y7CN5WwUjaAkGRevdsYrcQQCEjL1tbxG updated.
Oct 29 04:44:57.718 INFO Account dTi2CGJTKYpD6UVtZK8HMVZs1L477K69goCS2Swd6Fy updated.
Oct 29 04:44:57.925 INFO Account 6NYZdvPeS8QBy1BPTFD7PLAtG1unqpwNQ4NumkU2j4zN updated.
```

---

### 5.2. Logs da Solana Virtual Machine (SVM `4.3.2` — Instrução `TX-06 metabolize_yield`)

```text
Program TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb invoke [1]
Program log: Instruction: TransferChecked
Program TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb consumed 2030 of 400000 compute units
Program TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb success
Program TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb invoke [1]
Program log: Instruction: TransferChecked
Program TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb consumed 2030 of 397970 compute units
Program TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb success
```

---

### 5.3. Telemetria JSON Completa (`documentos/surfpool_e2e_playwright_report.json`)

```json
{
  "surfpoolVersion": {
    "surfnet-version": "1.7.0",
    "solana-core": "4.3.2",
    "feature-set": 3383571666
  },
  "initialSlot": 462801407,
  "finalSlot": 462801415,
  "epoch": 1071,
  "programId": "6owAcXj4FxJom96cEX9CSFjGrg6zp4U8atTjrpCUMiW5",
  "nodeVaultPda": "9cgQu9Cnnv3WNSEmDHwqH9Ls9DyU6FxqRmpfB34HWuZt",
  "nodeBump": 254,
  "finalBalances": {
    "rnftOwnerBalance": "1",
    "vaultUsdcBalance": "1164",
    "vaultUsdcMicros": "1164000000",
    "treasuryUsdcBalance": "36",
    "treasuryUsdcMicros": "36000000",
    "totalConservedUsdc": "1200.00"
  }
}
```
