# Jornadas UX1

## Visitante

Pode abrir o catálogo, o dossiê, a comparação, a lista local e o construtor de composição. Não assina transação, não cria mandato on-chain e não executa operação. A carteira continua necessária para as ações que já existiam em `/app` e `/lab`.

## Construção

1. Objetivos: nome, objetivo, horizonte, perfil declarado e moeda de referência USD. Nada disso autoriza uma operação.
2. Seleção: o Asset Registry é a única lista. A busca e a categoria filtram essa lista.
3. Alocação: pesos percentuais. A composição só é válida se a soma, arredondada em centésimos, for 100 e cada peso estiver entre 0 e 100, exclusive no zero. Acima de 40% em um ativo, a tela avisa e não bloqueia.
4. Verificação: identidade, mercado e execução aparecem separados.
5. Revisão: o botão salva somente a composição válida no `localStorage` deste navegador.

## Ajuste

`/portfolio/rebalance` compara o rascunho planejado com pesos desejados. O estado é `DRAFT` quando não há rascunho, `SIMULATED` quando as duas somas são válidas e `REQUIRES_REVIEW` quando alguma soma não fecha. A palavra `AUTHORIZED` não é usada. Não há botão de swap.

## Proposta e atividade

As páginas de ProofGate e Atividade não listam registros inventados. Elas apontam para `/app` e `/lab`, onde a avaliação, a assinatura e o recibo já existem. `REVIEWABLE` não é apresentado como `AUTHORIZED`. Autorização não é apresentada como execução.

## Laboratório

Meus Mandatos lê `GET /api/lab/config` quando o laboratório local responde. Mostra rede, programa, política, epoch e pausa. Não mostra limite, gasto nem prazo de um mandato que a carteira ainda não gravou. O link segue para `/lab`.
