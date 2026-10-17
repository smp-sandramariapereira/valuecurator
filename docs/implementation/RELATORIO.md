# Relatório local — linha 0.1.0

O guia pedia aceite humano entre etapas e proibia avançar sozinho. A instrução desta sessão pediu a implementação completa, local, sem nova confirmação. As etapas 00 a 08 foram feitas nesta árvore. Não houve push, merge nem deploy.

Ajustes em relação ao guia:

- O provedor padrão do agente é o id explícito `pyth-pro` quando `KAIROS_ORACLE_PROVIDER` falta. O regex antigo em `config.ts` e `market-data.ts` não identificava um feed numérico e não é mais a regra.
- Com `KAIROS_ORACLE_PROVIDER=pyth-hermes`, `KAIROS_PYTH_API_KEY` deixa de ser obrigatória. O adaptador Hermes não exige credencial. Pyth Pro continua fechado sem chave.
- O digest v2 cobre o preço já parseado. As funções `fetchPythPrice` e `fetchPythProPrice` não devolvem o corpo HTTP cru, e o guia pedia para não duplicar esse parser.
- Os testes de rota e do seletor rodam com `node:test` no pacote do agente. O app web não tem um runner de componentes React. A rota Next permanece um invólucro fino.
- Chainlink fica desligado. Não há feed, termo de uso nem prova de procedência confirmados neste repositório.
- A agregação multifonte fica desligada por padrão.
- `apps/web/programs/kairos-engine` não entra neste diff.

Os logs de teste reais ficam em `docs/implementation/etapa-08/evidencias/testes.log`.

Execução local: 3 testes do pacote de contratos e 94 testes do agente passaram. `tsc` do agente e do web passaram. `git diff` em `apps/web/programs` está vazio.

Na tela Gate, em `http://127.0.0.1:43147/?view=gate`, o catálogo mostra `pyth-pro`, `pyth-hermes` e `chainlink` desligado. Clicar em Pyth Pro devolveu `server authorization is required` e `POST /api/subscriptions/entitlements` respondeu 401. A página `/subscribe` continua a ilustração de 1 USDC na Devnet. A versão exibida é `0.1.0`. Nada foi publicado em valuecurator.xyz.
