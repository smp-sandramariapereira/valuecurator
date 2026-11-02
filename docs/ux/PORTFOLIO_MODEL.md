# Modelo de portfólio

Não existe, neste checkout, um banco de posições nem um portfólio on-chain que a interface possa ler sem criar outra fonte. O modelo novo é um rascunho local.

## Persistência

Chave `valuecurator.experimental-portfolio-draft.v1` no `localStorage`. O objeto exige `kind: "experimental-local-draft"` e `currency: "USD"`. Um objeto de outro tipo é ignorado. A carteira, a seed e o saldo não entram nesse objeto.

A lista de observação usa `valuecurator.experimental-local-watchlist.v1` e guarda somente identificadores do registro.

Esses dados não estão sincronizados com a blockchain. A interface diz isso no momento de salvar.

## Estados

| Estado | Significado nesta tela |
| --- | --- |
| PLANEJADO | Rascunho local, quando existe |
| OBSERVADO | Sem fonte. A tela não converte o catálogo em posição |
| EXECUTADO | Sem registro nesta interface |

O simulador usa a base `PLANEJADO`. A diferença é o peso desejado menos o peso planejado. Diferença negativa significa que o planejado está acima da meta desejada.

## O que o rascunho não faz

Não compra, não chama `execute_swap`, não assina Ed25519, não altera mandato e não muda saldo. Um perfil de risco declarado não vira permissão.
