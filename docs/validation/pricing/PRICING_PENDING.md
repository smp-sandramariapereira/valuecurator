# Preços — pendências

## P1 — Refresh ao vivo sem provedor configurado

- Estado: aberta.
- Evidência: HTTP 503, `Missing configuration: KAIROS_ORACLE_PROVIDER`.
- Impacto: o cartão não mostra um preço ao vivo. A simulação continua disponível e identificada.
- Para operar: definir no servidor `KAIROS_ORACLE_PROVIDER` e `KAIROS_ORACLE_FEED_ID` de um provedor habilitado. `pyth-pro` também exige `KAIROS_PYTH_API_KEY`. `pyth-hermes` não exige credencial, mas o feed hexadecimal do ativo precisa ser escolhido explicitamente. Nenhum dos dois foi selecionado nesta correção.

## P2 — Provedores desabilitados

Chainlink, Switchboard e Redstone continuam desabilitados. O registro recusa o uso. Não há feed AAPLx comprovado para eles.

## P3 — Proposta de aprovação

A evidência de mercado pode nomear outro provedor. A proposta schema 1 que segue para aprovação continua aceitando somente evidência `pyth-pro` não simulada. Hermes admissível no contrato v2 não foi ligado a uma autorização financeira nova.

## P4 — Integração real

Não houve chamada a Pyth, Hermes, xStocks ou Jupiter nesta correção. Os testes de refresh usam fixtures. A sonda HTTP local só comprovou a configuração ausente e o cenário SAFE.
