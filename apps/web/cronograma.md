# 🏛️ Plano completo de participação do KAIROS na Colosseum

Período considerado: **20 de setembro a 12 de outubro de 2026**.

Objetivo: entregar o **KAIROS Guarded Portfolio**, uma demonstração funcional e verificável de execução protegida para ativos tokenizados na Solana.

A Colosseum avalia produto, execução, mercado, tração, comunicação, viabilidade e founder-market fit. A submissão exige repositório, apresentação de 2–3 minutos, demonstração de até 3 minutos, estratégia de distribuição e validação de demanda. [Regras oficiais](https://colosseum.com/hackathon)

## 🎯 1. Definição do produto

### 💡 Proposta principal

> KAIROS transforma as preferências do investidor em regras verificáveis e permite que agentes operem ativos tokenizados na Solana sem receber controle irrestrito sobre o capital.

### ⚠️ Problema

Agentes financeiros autônomos podem:

- operar acima dos limites autorizados;
- usar preços vencidos ou inconsistentes;
- repetir operações após falhas;
- comprometer uma hot wallet;
- agir sem explicação auditável;
- continuar executando após uma anomalia.

### 🛡️ Solução

O KAIROS combina:

- custódia programável;
- separação entre owner e operador;
- mandato do investidor;
- preço financeiro de referência;
- limites determinísticos;
- circuit breaker persistente;
- IA limitada;
- execução e relatório auditáveis.

### 👥 Público inicial

Prioridade:

1. Tesourarias de DAOs.
2. Gestores de portfólios on-chain.
3. Emissores e plataformas de RWA.
4. Desenvolvedores de agentes financeiros.

Evitar apresentar o produto inicialmente como plataforma genérica para todos os investidores.

## 📦 2. Escopo do MVP da competição

### ✅ Obrigatório

- Um ativo tokenizado real.
- Identificação verificável do mint.
- Preço de referência real.
- Preço executável ou cotação on-chain.
- Mandato configurável.
- Bloqueio por preço vencido.
- Bloqueio por baixa confiança.
- Bloqueio por divergência excessiva.
- Limite por operação.
- Limite diário.
- Circuit breaker.
- Execução demonstrável ou simulação assinável claramente identificada.
- Relatório antes/depois.
- Dashboard público.
- Evidências na Devnet ou ambiente correspondente.

### ✨ Desejável

- Comparação entre dois ativos.
- Histórico das decisões.
- Explicação da IA em shadow mode.
- Exportação do relatório.
- Métricas de operação recusada versus aprovada.

### 🚫 Fora do escopo

- DAO completa;
- token próprio;
- marketplace de impacto;
- seis capitais totalmente implementados;
- ontologia ESG;
- IA movimentando recursos livremente;
- suporte a múltiplas redes;
- estratégia de investimento sofisticada;
- produção com dinheiro real.

## 🏁 3. Métrica de conclusão

O MVP será considerado pronto quando a demonstração conseguir mostrar, sem edição enganosa:

```text
mandato
→ ativo real
→ preço real
→ proposta de operação
→ avaliação determinística
→ recusa ou aprovação
→ execução controlada
→ transação verificável
→ relatório final
```

Também deverão existir dois cenários:

### 🟢 Cenário seguro

A operação respeita o mandato e pode prosseguir.

### 🔴 Cenário inseguro

A operação é bloqueada por uma causa claramente visível, como:

- preço vencido;
- divergência excessiva;
- limite diário excedido;
- ativo não autorizado;
- circuit breaker aberto.

O cenário de bloqueio é parte central da demonstração, não apenas um teste interno.

## 📅 4. Cronograma

### 🔭 20–22 de setembro — Preparação e integração Pyth

Objetivos:

- registrar o projeto na plataforma da Colosseum;
- manter a submissão como rascunho;
- obter a chave Pyth;
- localizar o feed de referência adequado;
- testar consulta real somente leitura;
- registrar preço, confiança e horário;
- confirmar o ativo tokenizado candidato.

Critérios de conclusão:

- consulta Pyth autenticada funcionando;
- feed ID registrado;
- teste de preço real reproduzível;
- nenhum segredo versionado;
- ativo candidato documentado com mint e emissor.

Entregável semanal:

> KAIROS now reads authenticated market data and rejects stale, low-confidence or mismatched price evidence before any transaction is constructed.

### 🔎 23–25 de setembro — Descoberta do ativo e liquidez

Objetivos:

- consultar a API oficial do emissor;
- validar mint e programa do token;
- verificar liquidez e venue;
- consultar rota Jupiter ou alternativa;
- verificar horários e disponibilidade;
- identificar o token usado como entrada;
- corrigir a unidade econômica da cotação.

Ponto crítico:

O agente atualmente não deve presumir que qualquer token de entrada representa um dólar. Será necessário:

- fixar USDC como ativo de entrada; ou
- obter preço confiável do token de entrada;
- comparar valores na mesma unidade.

Critérios de conclusão:

- ativo real selecionado;
- mint confirmado;
- preço de referência confirmado;
- token de entrada definido;
- cotação economicamente correta;
- documentação das limitações de liquidez.

Se não houver rota executável:

- demonstrar uma proposta de alocação somente leitura;
- deixar explícito que não ocorreu swap;
- não inventar liquidez ou transação.

### 📜 26–28 de setembro — Mandato e política

Objetivos:

- finalizar o `InvestmentMandate`;
- vincular o mandato ao ativo real;
- mostrar as regras no dashboard;
- produzir decisão reproduzível;
- registrar a versão da política.

Mandato mínimo:

```text
mandateId
owner
allowedAssets
maximumAmountPerTrade
maximumDailyAmount
maximumAllocation
maximumPriceAge
maximumConfidenceRatio
maximumPriceDeviation
maximumSlippage
validFrom
validUntil
strategyVersion
```

Critérios de conclusão:

- mesma entrada produz a mesma decisão;
- ausência de dados causa bloqueio;
- ativo não autorizado causa bloqueio;
- mandato vencido causa bloqueio;
- interface explica cada bloqueio.

### ⚙️ 29 de setembro–1º de outubro — Fluxo de execução

Objetivos:

- ligar mercado, política e executor;
- garantir que nenhuma transação seja criada antes da aprovação;
- registrar tentativa, decisão e resultado;
- provar que apenas confirmação consome a cota;
- testar reinicialização do agente.

Critérios de conclusão:

- tentativa recusada não movimenta tokens;
- tentativa recusada não consome cota;
- confirmação válida atualiza o estado;
- falhas consecutivas abrem o circuito;
- reinício mantém limites e falhas;
- todas as decisões têm identificador correlacionado.

### 📊 2–4 de outubro — Dashboard competitivo

O dashboard deverá mostrar:

- ativo;
- mint;
- saldo atual;
- mandato ativo;
- preço Pyth;
- confiança do feed;
- idade do preço;
- preço executável;
- divergência;
- limite por operação;
- consumo diário;
- estado do circuito;
- recomendação da IA;
- decisão determinística;
- assinatura da transação;
- composição anterior e posterior.

Separar visualmente:

| Informação | Significado |
| --- | --- |
| Saldo atual | Valor existente agora |
| Total processado | Contador histórico |
| Cotação | Estimativa antes da execução |
| Execução | Transação confirmada |
| Projeção | Resultado esperado |
| Resultado | Valor efetivamente observado |

Critérios de conclusão:

- nenhuma unidade bruta apresentada como token sem indicação;
- nenhum saldo inferido;
- erros do RPC aparecem como indisponibilidade;
- links do Explorer funcionam;
- interface utilizável sem chave privada;
- layout legível em notebook e celular.

### 🗣️ 5–6 de outubro — Validação com usuários

Realizar pelo menos cinco entrevistas:

- duas pessoas ligadas a Solana/DeFi;
- uma pessoa ligada a DAO ou tesouraria;
- uma pessoa ligada a RWA;
- uma pessoa que desenvolva agentes ou automação.

Perguntas:

1. Como você autoriza hoje uma automação financeira?
2. Qual é o maior risco de um agente operar sua carteira?
3. Que regras deveriam ser impossíveis de ultrapassar?
4. Como você detecta preço incorreto ou vencido?
5. Quem deveria poder interromper o agente?
6. Que evidência seria necessária para confiar no produto?
7. Você testaria esse sistema?
8. Quem pagaria por ele?
9. Qual alternativa utiliza hoje?
10. Que funcionalidade impediria a adoção?

Não conduzir a entrevista apresentando a solução primeiro. Começar pelo problema.

Registrar:

- função da pessoa;
- contexto;
- problema relatado;
- solução atual;
- intensidade da dor;
- interesse em piloto;
- objeções;
- alterações resultantes no produto.

Meta:

- cinco entrevistas;
- três confirmações do problema;
- duas manifestações de interesse;
- uma possibilidade de piloto.

### 🔐 7–8 de outubro — Segurança e estabilização

Executar:

```bash
pnpm security:check
pnpm lint
pnpm build
pnpm --dir agent typecheck
pnpm --dir agent test
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
pnpm test:e2e
```

Revisar:

- segredos no histórico;
- permissões das carteiras;
- Program ID;
- upgrade authority;
- endereços do ambiente;
- limites em unidades corretas;
- URLs e chaves configuráveis;
- timeouts;
- comportamento fail-closed;
- logs sem dados secretos;
- estado persistente;
- tratamento de RPC indisponível.

Não adicionar funcionalidades grandes depois desse período.

### 🧊 9 de outubro — Congelamento funcional

A partir desse dia:

- somente correções críticas;
- nenhuma reformulação arquitetural;
- nenhum novo protocolo;
- nenhuma alteração estética ampla;
- nenhum novo requisito de demonstração.

Criar uma versão marcada:

```bash
git tag -a colosseum-demo-rc1 -m "KAIROS Colosseum demo candidate"
git push origin colosseum-demo-rc1
```

Fazer isso apenas após todos os testes passarem.

### 🎬 9–10 de outubro — Vídeos

## 🎤 5. Roteiro do vídeo de apresentação

Duração: aproximadamente 2 minutos e 30 segundos.

### 0:00–0:20 — Problema

> Agentes financeiros podem operar 24 horas, mas dar a eles acesso irrestrito a uma carteira cria um risco inaceitável. Uma decisão ruim, um preço vencido ou uma chave comprometida pode afetar todo o capital.

### 0:20–0:40 — Solução

> KAIROS é uma camada de execução protegida para ativos tokenizados na Solana. O investidor define um mandato, e o agente só pode operar dentro de limites verificáveis.

### 0:40–1:05 — Funcionamento

Mostrar:

- mandato;
- preço Pyth;
- cotação;
- limites;
- operador separado;
- owner de recuperação.

### 1:05–1:30 — Diferencial

> A IA aconselha, mas não controla as chaves e não pode ignorar a política. Preços vencidos, divergências, limites excedidos e falhas consecutivas bloqueiam a execução.

### 1:30–1:55 — Prova

Mostrar:

- programa implantado;
- operação recusada;
- operação aprovada;
- transação no Explorer;
- relatório.

### 1:55–2:20 — Mercado

> O produto atende tesourarias, gestores e plataformas que desejam automação sem entregar controle irrestrito a agentes.

### 2:20–2:30 — Encerramento

> KAIROS makes autonomous finance constrained, recoverable and auditable.

## 🖥️ 6. Roteiro do vídeo de demonstração

Duração máxima: 3 minutos.

### 0:00–0:20

Abrir o dashboard e mostrar:

- Devnet;
- owner;
- operador;
- ativo;
- mandato.

### 0:20–0:50

Mostrar preço real:

- feed;
- preço;
- confiança;
- horário;
- cotação executável;
- divergência.

### 0:50–1:20

Executar cenário inseguro:

- alterar parâmetro controlado ou usar fixture;
- mostrar divergência/idade acima do limite;
- solicitar operação;
- exibir recusa;
- confirmar ausência de transação.

### 1:20–2:10

Executar cenário seguro:

- restaurar evidência válida;
- mostrar verificação de limites;
- aprovar proposta;
- executar;
- abrir assinatura no Explorer.

### 2:10–2:40

Mostrar:

- saldo anterior e posterior;
- cota diária;
- relatório;
- decisão da IA em shadow mode;
- versão da política.

### 2:40–3:00

Mostrar recuperação/circuit breaker de forma resumida e encerrar com a proposta de valor.

## 📖 7. README para os avaliadores

O início do README deve responder, sem rolagem excessiva:

1. O que é o KAIROS?
2. Que problema resolve?
3. Por que usa Solana?
4. Como executar a demonstração?
5. Onde está o programa implantado?
6. Onde estão as transações?
7. O que foi construído durante o hackathon?
8. Quais limitações permanecem?

Estrutura recomendada:

```text
Overview
Problem
Solution
Demo
Architecture
Security Model
Market Data
Investment Mandate
AI Boundaries
Deployed Addresses
Transactions
Local Setup
Tests
Hackathon Development Disclosure
Limitations
Roadmap
Team
```

## 🧾 8. Registro de desenvolvimento

Criar `HACKATHON_PROGRESS.md` contendo:

### ⏮️ Antes do hackathon

- conceito ou materiais preexistentes;
- qualquer código anterior;
- estado inicial real.

### 🚀 Durante o hackathon

Organizar por data:

- funcionalidade;
- commit;
- teste;
- decisão;
- aprendizado;
- evidência.

### 🔗 Evidências

- Program ID;
- node PDA;
- transações;
- workflow de CI;
- vídeos semanais;
- entrevistas;
- screenshots;
- versão demonstrada.

Não alterar datas ou reescrever o histórico para aparentar que trabalho anterior aconteceu durante a competição.

## 💼 9. Modelo de negócio

Hipótese inicial:

### 👤 Cliente

- DAO;
- tesouraria;
- gestor on-chain;
- plataforma de RWA;
- fornecedor de agentes financeiros.

### 💎 Valor

- redução do risco operacional;
- política reproduzível;
- trilha de auditoria;
- recuperação;
- menor necessidade de custódia manual.

### 💰 Receita possível

- assinatura por vault;
- taxa por execução;
- licença B2B;
- serviço gerenciado;
- módulo de infraestrutura para emissores.

Para a competição, escolher uma hipótese principal:

> Assinatura B2B mensal por vault protegido, com cobrança adicional por volume executado.

Não afirmar preço definitivo sem entrevistas.

## 🌐 10. Distribuição

Primeiros canais:

- integrações com emissores de ativos tokenizados;
- comunidades de tesourarias Solana;
- gestores e DAOs;
- parceiros de infraestrutura;
- conteúdo técnico sobre segurança de agentes;
- programa piloto com limites baixos.

Estratégia inicial:

1. Oferecer piloto em shadow mode.
2. Comparar decisões propostas e executadas.
3. Demonstrar operações que seriam bloqueadas.
4. Ativar execução somente após validação.
5. Cobrar quando o cliente adotar um vault protegido.

## 📣 11. Atualizações semanais

A Colosseum recomenda vídeos concisos de aproximadamente um minuto.

Cada atualização deve conter:

- o que funcionava anteriormente;
- o que foi entregue;
- evidência visual;
- principal dificuldade;
- próximo marco.

Evitar listas longas de commits. Mostrar evolução de produto.

### 1️⃣ Atualização 1

- deploy;
- owner/operator;
- limites;
- dashboard;
- eventos.

### 2️⃣ Atualização 2

- Pyth;
- ativo real;
- mandato;
- operação recusada.

### 3️⃣ Atualização 3

- fluxo completo;
- entrevistas;
- relatório;
- preparação da demonstração.

## ☑️ 12. Checklist da submissão

### 🧩 Produto

- [ ] Fluxo principal funciona.
- [ ] Cenário recusado funciona.
- [ ] Cenário aprovado funciona.
- [ ] Links do Explorer funcionam.
- [ ] Dashboard está acessível.
- [ ] Nenhum segredo está exposto.
- [ ] Limitações estão documentadas.

### 🗂️ Repositório

- [ ] README revisado.
- [ ] Licença definida.
- [ ] `.env.example` atualizado.
- [ ] Instalação reproduzível.
- [ ] CI verde.
- [ ] Testes documentados.
- [ ] Histórico prévio declarado.
- [ ] Acesso concedido aos avaliadores se continuar privado.

A Colosseum aceita repositório privado, mas exige acesso para `hackathon@colosseum.com`. Um repositório público facilita a avaliação, desde que não exponha segredos. [Requisitos da submissão](https://colosseum.com/hackathon)

### 🎙️ Apresentação

- [ ] Descrição curta.
- [ ] Problema claro.
- [ ] Cliente definido.
- [ ] Diferencial claro.
- [ ] Mercado explicado.
- [ ] Modelo de negócio.
- [ ] Estratégia de distribuição.
- [ ] Validação de demanda.
- [ ] Histórico da equipe.
- [ ] Uso da Solana.

### 🎞️ Mídia

- [ ] Logo.
- [ ] Imagem principal.
- [ ] Vídeo de apresentação.
- [ ] Vídeo de demonstração.
- [ ] Áudio compreensível.
- [ ] Texto legível.
- [ ] Links públicos ou acessíveis.
- [ ] Nenhuma chave ou dado sensível aparece na tela.

## 🚨 13. Gestão de riscos

| Risco | Resposta |
| --- | --- |
| Pyth não disponível | Fixture assinada e claramente identificada apenas para demonstração; manter consulta real separada |
| Ativo sem liquidez | Demonstrar proposta e bloqueio, sem inventar execução |
| Jupiter sem rota | Usar venue compatível ou reduzir promessa do MVP |
| RPC Devnet instável | Gravar prova antecipadamente e manter transações no Explorer |
| Chave exposta | Rotação imediata e documentação |
| Erro próximo ao prazo | Congelamento funcional em 9 de outubro |
| Escopo excessivo | Priorizar um ativo, um mandato e dois cenários |
| Ausência de usuários | Entrevistas e cartas de interesse durante a competição |
| Narrativa confusa | Usar somente “guarded execution for tokenized assets” |
| Demonstração longa | Ensaiar e cronometrar vídeos |

## 🔄 14. Rotina diária

### 🌅 Início do dia

- escolher um único resultado verificável;
- confirmar que ele contribui para a demonstração;
- registrar o critério de conclusão.

### 🛠️ Durante o desenvolvimento

- commits pequenos;
- testes junto com a mudança;
- segredos somente em arquivos ignorados;
- documentação das decisões;
- nenhuma transação real sem validação explícita.

### 🌙 Final do dia

- executar testes relacionados;
- atualizar progresso;
- capturar evidência;
- verificar Git;
- definir o próximo bloqueio.

### 📍 A cada três dias

- executar o fluxo completo;
- avaliar se o pitch continua verdadeiro;
- remover funcionalidades que não ajudam a demonstração.

## 🧭 15. Ordem imediata

A sequência recomendada para retomarmos é:

1. Confirmar cadastro na Colosseum.
2. Criar o rascunho do projeto.
3. Obter e configurar a chave Pyth localmente.
4. Fazer uma consulta real somente leitura.
5. Selecionar o ativo tokenizado.
6. Validar mint, preço e liquidez.
7. Corrigir a unidade econômica da cotação.
8. Integrar mandato e evidência no dashboard.
9. Demonstrar bloqueio.
10. Somente depois habilitar uma execução controlada.

O princípio central do planejamento é: **um fluxo comprovado vale mais do que dez funcionalidades incompletas**. O KAIROS deve chegar à avaliação como um produto de segurança para automação financeira, e não como uma coleção de conceitos relacionados.

## 🎥 16. Prompt para vídeo de 3 minutos no NotebookLM

> **Nota de produção:** a geração automática pode variar alguns segundos. Depois de gerar, conferir a duração e ajustar pausas ou cortes para fechar em **03:00 exatos**. O roteiro deve ter aproximadamente 390 palavras narradas, em ritmo claro de cerca de 130 palavras por minuto.

### Fontes que devem ser adicionadas ao notebook

Antes de usar o prompt, carregar no NotebookLM:

- README e documentação do KAIROS;
- `cronograma.md`;
- arquitetura e user flow;
- endereço do programa implantado;
- transações verificáveis na Devnet;
- resultados dos testes;
- capturas do dashboard;
- documentação das integrações efetivamente demonstradas.

### Prompt para copiar

```text
Crie um vídeo de apresentação do KAIROS Engine com duração FINAL EXATA de 3 minutos (180 segundos), em português do Brasil, para avaliação em um hackathon da Colosseum.

Use exclusivamente as fontes deste notebook. Não invente usuários, receita, parceiros, volume financeiro, auditorias, integrações concluídas, transações ou resultados. Quando algo ainda for protótipo, simulação, Devnet, shadow mode ou trabalho futuro, identifique isso claramente.

Público: jurados técnicos, investidores e fundadores de produtos cripto.
Tom: confiante, objetivo, profissional e acessível.
Ritmo de narração: aproximadamente 130 palavras por minuto.
Estética: terminal financeiro escuro, inspirado na Solana, com verde, ciano e roxo; textos grandes; transições discretas; sem moedas decorativas ou promessas de rentabilidade.
Mensagem central: agentes podem propor operações, mas regras determinísticas protegem o capital.

Estruture o vídeo nestes blocos, respeitando rigorosamente as durações:

00:00–00:20 — PROBLEMA (20 segundos)
Apresente o risco de entregar controle irrestrito do capital a agentes financeiros: preços vencidos, operações acima dos limites, repetição de falhas e comprometimento de chaves. Texto na tela: “AUTOMAÇÃO SEM LIMITES É RISCO”.

00:20–00:45 — SOLUÇÃO (25 segundos)
Apresente o KAIROS como uma camada de execução protegida para ativos tokenizados na Solana. Explique que o investidor define um mandato e que o agente opera apenas dentro de regras verificáveis. Texto na tela: “GUARDED EXECUTION FOR TOKENIZED ASSETS”.

00:45–01:15 — ARQUITETURA (30 segundos)
Mostre visualmente owner, operador, vault/PDA, Token-2022 e Solana. Explique a separação entre governança e chave operacional, a recuperação emergencial e o registro on-chain. Destaque: “O operador executa. O owner mantém o controle”.

01:15–01:55 — EVIDÊNCIAS E CONTROLES (40 segundos)
Mostre o KAIROS Market Evidence Verifier recebendo preço Pyth, cotação on-chain, confiança, idade do dado, liquidez e slippage. Em seguida, mostre a aplicação do mandato, limite por operação, limite diário, divergência máxima e circuit breaker persistente. Explique que qualquer evidência inadequada bloqueia a operação antes da construção ou confirmação da transação.

01:55–02:25 — DEMONSTRAÇÃO (30 segundos)
Apresente dois caminhos lado a lado:
1. Cenário inseguro: preço vencido ou divergência excessiva → “OPERAÇÃO BLOQUEADA” → nenhuma movimentação e nenhuma cota consumida.
2. Cenário seguro: evidências válidas e mandato respeitado → “APROVADO” → execução controlada → assinatura no Explorer → relatório antes/depois.
Use apenas transações e telas existentes nas fontes. Se ainda não houver uma execução real de ativo tokenizado, classifique a etapa correspondente como demonstração em Devnet ou fluxo planejado.

02:25–02:43 — IA LIMITADA (18 segundos)
Explique que a IA funciona em shadow mode: analisa contexto e aconselha, mas não possui chaves, não assina transações, não altera o mandato e não ignora os controles determinísticos. Texto na tela: “IA ACONSELHA. REGRAS AUTORIZAM”.

02:43–02:55 — MERCADO E USUÁRIOS (12 segundos)
Apresente os públicos iniciais: tesourarias de DAOs, gestores on-chain, plataformas de RWA e desenvolvedores de agentes. Não afirme validação ou interesse comercial sem evidência nas fontes.

02:55–03:00 — ENCERRAMENTO (5 segundos)
Exiba o nome KAIROS e finalize com a frase exata:
“KAIROS: regras verificáveis, custódia recuperável e execução auditável.”

Requisitos obrigatórios:
- duração total de 180 segundos;
- narração contínua, sem ultrapassar 3 minutos;
- legendas em português;
- indicar “DEVNET” sempre que forem mostrados dados ou transações da Devnet;
- diferenciar saldo atual, total processado, cotação, projeção e execução confirmada;
- não mostrar chaves privadas, seed phrases, API keys ou arquivos de keypair;
- não apresentar retorno financeiro esperado;
- não chamar uma simulação de transação real;
- terminar exatamente em 03:00;
- fornecer, junto ao vídeo, o roteiro final com timestamps, narração e indicação visual de cada cena.
```

### Checklist de revisão do vídeo

- [ ] Duração final marcada como `03:00`.
- [ ] O problema é compreendido nos primeiros 20 segundos.
- [ ] O diferencial aparece antes de 1 minuto.
- [ ] Há um cenário bloqueado e um cenário aprovado.
- [ ] Devnet e simulações estão identificadas corretamente.
- [ ] Nenhum segredo aparece nas capturas.
- [ ] As alegações possuem suporte nas fontes do notebook.
- [ ] Texto e números são legíveis em tela pequena.
- [ ] O áudio está limpo e sem música competindo com a narração.
- [ ] O encerramento contém a proposta de valor do KAIROS.

## 🖼️ 17. Prompt para apresentação de 8 slides no NotebookLM

### Prompt para copiar

```text
Crie uma apresentação com EXATAMENTE 8 slides sobre o KAIROS Engine para avaliação em um hackathon da Colosseum.

Use exclusivamente as fontes deste notebook. Não invente usuários, receita, parceiros, auditorias, volume financeiro, integrações concluídas, transações ou resultados. Identifique claramente tudo que for protótipo, Devnet, simulação, shadow mode ou trabalho futuro.

Idioma: português do Brasil.
Público: jurados técnicos, investidores e fundadores de produtos cripto.
Objetivo: explicar problema, solução, funcionamento, diferenciação, prova técnica, mercado e próximos passos de forma clara e convincente.
Formato: 16:9.
Estética: terminal financeiro sofisticado, fundo preto ou azul-marinho, grade técnica discreta, verde-limão, ciano e roxo inspirados na Solana; vermelho apenas para bloqueios e riscos.
Tipografia: moderna, de alto contraste e legível.
Densidade: no máximo 35 palavras visíveis por slide, excluindo títulos, endereços e legendas curtas.
Não usar moedas decorativas, imagens genéricas de robôs, promessas de retorno financeiro ou parágrafos longos.

Produza exatamente estes 8 slides:

SLIDE 1 — KAIROS ENGINE
Título: “KAIROS Engine”
Subtítulo: “Guarded execution for tokenized assets”
Mensagem: agentes podem propor operações; regras verificáveis protegem o capital.
Visual: identidade KAIROS, Solana e um fluxo simples entre investidor, regras e execução.
Rodapé: “Regras verificáveis · Custódia recuperável · Execução auditável”.

SLIDE 2 — O PROBLEMA
Título: “Automação sem limites é risco”
Mostrar quatro riscos:
- preços vencidos ou inconsistentes;
- operações acima do mandato;
- repetição de falhas;
- comprometimento da chave operacional.
Mensagem principal: um agente não deve receber controle irrestrito do capital.
Visual: fluxo inseguro terminando em operação bloqueada.

SLIDE 3 — A SOLUÇÃO
Título: “Um mandato entre o agente e o capital”
Mostrar:
- ativos permitidos;
- limite por operação;
- limite diário;
- slippage máximo;
- prazo de validade;
- circuit breaker.
Mensagem principal: o KAIROS transforma preferências em regras determinísticas e auditáveis.
Visual: mandato entrando no KAIROS Risk Engine.

SLIDE 4 — MARKET EVIDENCE VERIFIER
Título: “Toda operação precisa de evidências”
Mostrar o fluxo:
Preço Pyth + confiança + idade do dado + cotação on-chain + liquidez → KAIROS Verifier.
Mostrar duas saídas:
- “APROVADO” em verde;
- “BLOQUEADO” em vermelho.
Explicar em uma frase que divergência, preço vencido ou liquidez insuficiente impedem a execução.
Não afirmar que uma integração está operacional se as fontes não comprovarem isso.

SLIDE 5 — ARQUITETURA DE SEGURANÇA
Título: “Separação de poderes on-chain”
Mostrar:
- Owner: governança e recuperação;
- Operator: execução limitada;
- PDA/Vault: custódia programável;
- Token-2022;
- Solana: registro verificável.
Adicionar: “IA aconselha, não assina”.
Visual: diagrama de arquitetura com setas claras e sem cruzamentos.

SLIDE 6 — DEMONSTRAÇÃO E PROVA TÉCNICA
Título: “Funcionando na Devnet”
Usar somente evidências presentes nas fontes:
- Program ID implantado;
- node PDA;
- divisão 15/85 demonstrada;
- recuperação emergencial;
- eventos e dashboard;
- testes automatizados.
Mostrar assinatura ou link do Explorer apenas se constar nas fontes.
Identificar claramente “DEVNET”.
Não apresentar mint simulado como ação tokenizada real.

SLIDE 7 — MERCADO E MODELO DE NEGÓCIO
Título: “Infraestrutura para agentes financeiros seguros”
Públicos iniciais:
- tesourarias de DAOs;
- gestores on-chain;
- plataformas de RWA;
- desenvolvedores de agentes.
Hipótese de receita:
“Assinatura B2B por vault protegido, com componente por volume executado.”
Marcar como hipótese ainda sujeita à validação.
Não inventar TAM, receita ou clientes.

SLIDE 8 — VISÃO E PRÓXIMO MARCO
Título: “Do protótipo ao fluxo completo”
Mostrar próximos passos:
1. preço Pyth autenticado;
2. ativo tokenizado real;
3. mandato visível no dashboard;
4. operação insegura bloqueada;
5. execução controlada e relatório final.
Encerramento em destaque:
“KAIROS torna a automação financeira limitada, recuperável e auditável.”
Incluir chamada final discreta: “Pilot partners · DAO treasuries · RWA platforms”.

Para cada slide, entregue:
- título;
- texto exato exibido;
- sugestão visual;
- notas do apresentador de 20 a 30 segundos;
- indicação das fontes utilizadas.

Requisitos obrigatórios:
- exatamente 8 slides, sem capa adicional e sem slide extra de referências;
- usar apenas alegações sustentadas pelas fontes;
- marcar Devnet, simulação, hipótese e trabalho futuro;
- não expor chaves privadas, seed phrases, API keys ou arquivos de keypair;
- não apresentar projeções como resultados;
- distinguir preço de referência, cotação on-chain e execução confirmada;
- manter consistência visual com o dashboard KAIROS;
- usar diagramas simples e números grandes;
- evitar texto pequeno;
- terminar no slide 8, sem adicionar agradecimentos ou apêndices.
```

### Checklist de revisão dos slides

- [ ] A apresentação contém exatamente 8 slides.
- [ ] O problema aparece no slide 2 e a solução no slide 3.
- [ ] O Market Evidence Verifier está explicado.
- [ ] A IA é apresentada como conselheira, não como signatária.
- [ ] Devnet, simulações e hipóteses estão identificadas.
- [ ] Não existem números, clientes ou resultados inventados.
- [ ] O slide de prova técnica contém somente evidências verificáveis.
- [ ] Cada slide possui uma única mensagem principal.
- [ ] Os textos são legíveis em tela e gravação.
- [ ] Nenhum segredo aparece em capturas ou endereços locais.

