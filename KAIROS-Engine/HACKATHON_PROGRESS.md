# Registro de desenvolvimento

Registro local montado em 24 de setembro de 2026 a partir do Git em `main`, commit `e548a43`. A janela usada pelo `cronograma.md` é 20 de setembro a 12 de outubro de 2026. Commits anteriores a 20 de setembro ficam na seção de trabalho prévio.

Este arquivo não reexecuta testes, não consulta o GitHub e não altera a Devnet. Onde não há arquivo no repositório, a ausência fica explícita.

## Antes do hackathon

Até 17 de setembro de 2026 o repositório já tinha 167 commits, a partir de `474cc98` em 14 de setembro de 2026.

Nesse intervalo já existiam:

- o programa Anchor, o agente de custódia e o dashboard Next.js;
- a separação entre owner e operador, `emergency_withdraw` e `update_operator`;
- a instrução de swap com Jupiter fixado no programa;
- mandato, política determinística, cliente Pyth, descoberta xStocks, cotação Jupiter, circuit breaker em arquivo local e modos de IA `off`, `shadow` e `enforce`;
- o workflow de CI em `.github/workflows/ci.yml`, adicionado em `57bd6a0` no dia 15 de setembro;
- a rotação da identidade do programa em `89ac498`, no dia 17 de setembro, que introduz o Program ID atual;
- a leitura pública do node sem carteira.

A chave de deploy chegou a ser versionada e foi removida da árvore em `1f1e561`, no dia 14 de setembro. `SECURITY.md` registra que ela permanece no histórico Git. Isso é anterior à janela do cronograma.

## Durante o hackathon

Há 50 commits desde 20 de setembro. Não há commits em 20 nem em 21 de setembro. Não há tag de demonstração.

### 22 de setembro

O dia liga a evidência de mercado ao recibo de aprovação.

| Commit | O que entrou |
| --- | --- |
| `511f5f3` | Cronograma da Colosseum |
| `798e5bb`, `7c6b06b` | Roteiros de vídeo e de slides. São prompts, não gravações |
| `a673cd8` | Consulta Pyth somente leitura |
| `835b5fb` | Verificação da evidência xStock |
| `b130a12` | Fluxo de aprovação auditável e `docs/EXECUTION_LIFECYCLE.md` |
| `0b6113c` | Cenários de demonstração aprovado e bloqueado |
| `d36b503` | Histórico de decisões no navegador |
| `2fcdb1e` | Exportação do relatório final |

Decisão registrada nesse fluxo: a evidência AAPLx é lida na Mainnet e o programa está na Devnet, então a demonstração para no recibo `APPROVAL_ONLY`. Nenhuma transação AAPLx é enviada.

### 23 de setembro

O dia torna a demonstração legível para avaliação.

| Commit | O que entrou |
| --- | --- |
| `b901217` | Marca PROOFGATE |
| `63e1537`, `5f23649` | Visões guiadas e navegação flutuante |
| `b9392a0` | Inglês como idioma principal do dashboard |
| `56a4410` | README com Program ID, PDA, mint de demonstração e as três transações de custódia |
| `6b6a705` | URL pública do dashboard escrita no README |

O README desse commit declara o vídeo como pendente. O repositório não contém arquivo de vídeo.

### 24 de setembro

| Commit | O que entrou |
| --- | --- |
| `41dcbd1` | Construtor visual do mandato |
| `e548a43` | Navegação do dashboard mais estável e acessível |

Ainda fora do Git, na árvore de trabalho deste computador: o README e o dashboard passaram a separar, no texto, a custódia da Devnet e o portão AAPLx. Essa alteração não está em um commit.

## Evidências

| Item | Registro | Limite |
| --- | --- | --- |
| Program ID | `6owAcXj4FxJom96cEX9CSFjGrg6zp4U8atTjrpCUMiW5` | Identidade rotacionada em 17 de setembro; publicada no README em 23 de setembro |
| Node PDA | `LwuCrFTwdkkH24Ni3Kc4UuL56pzvvnyag1gNQzjCALS` | Endereço documentado no README. Este arquivo não afirma a data da inicialização on-chain |
| Mint de demonstração | `3c9wq8dP5fXU34Fc6tEx53YQnbYMnqwd1S8DkCp6YpBm` | Token-2022 de custódia na Devnet. Não é o mint AAPLx da Mainnet |
| Inicialização | `5KfFCT55w2sen5mgHm99V2V9aRJ6EM7UX9HsZQ7CTKq6ycyDNmvmPhqn8PzcAnADSEDT36fhJ4FXgyJDthtrMhX5` | Transação de custódia documentada no README |
| Divisão 15/85 | `5iYZdNguAxH5u1niikvtBW7oPLj9qodor5coKmDyZWoJaXKsqfwroaJdyy7r23zRTFQYinXH7wACMUdgYXQ9chJq` | `metabolize_yield`. Não é um swap de AAPLx |
| Recuperação | `FVUB863oWXv2i9ymxsro6yEjbmP2XVirBBLZEAYm8xU2qRuuSoJkpfBjUWUu5q18D4GhEKmAtTSCWbNJQ4FjrtE` | `emergency_withdraw` do owner |
| CI | `.github/workflows/ci.yml` desde `57bd6a0` | A existência do workflow não é um resultado verde desta data |
| Vídeos | Ausentes | O README marca o vídeo como pendente |
| Entrevistas | Ausentes | Não há notas no repositório |
| Screenshots | Ausentes | Não há imagens de demonstração no repositório |
| Versão demonstrada | `e548a43` em `main`, sem tag | A árvore de trabalho tem texto local ainda não commitado |

## O que este registro não afirma

- Não houve compra de AAPLx.
- `execute_strategy_swap` existe no programa e não é a transação demonstrada no README.
- `public/market-evidence.json` e os fixtures `agent/fixtures/aapl-valid.json`, `aapl-stale.json` e `aapl-divergent.json`, na árvore de trabalho, usam o mint AAPLx já documentado no código, `XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp`. Esses arquivos continuam sendo simulação: os preços não são uma cotação ao vivo. A proposta antiga em `public/execution-proposal.json` não acompanha a evidência publicada, e o dashboard deixa de exibi-la.
- Não há auditoria independente, entrevistas, carta de interesse nem validação de preço comercial.
