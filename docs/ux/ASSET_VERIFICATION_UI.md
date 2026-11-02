# Verificação de ativos na interface

A apresentação está em `apps/web/lib/asset-verification-view.ts`. Ela lê `CatalogAsset` e não consulta oráculo.

## Três estados

| Verificação | Origem | Texto |
| --- | --- | --- |
| Identidade | `status` do registro | Candidato: identidade não confirmada. Referência documentada: verificação disponível. Verificado no registro: identidade verificada no registro |
| Dados de mercado | nenhum pedido nesta página | Fonte não consultada nesta sessão |
| Execução | esta tela não recebe o conjunto de mints autorizados | Não habilitada |

AAPL no registro atual é `REFERENCE_DOCUMENTED`, com o mint documentado `XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp`. Isso não o torna executável. NVDA, TSLA e MSFT são candidatos, sem mint. O programa de token e o preço aparecem como “Não disponível” porque o registro não traz esses campos.

Não há um selo único `VERIFIED`. Pesquisa não é permissão de compra.

## Dossiê e comparação

`/assets/[assetId]` repete somente os campos do registro e marca o restante como não disponível. A comparação aceita de dois a quatro ativos e não recomenda compra. A lista de observação não tem alerta: não existe serviço de monitoramento ligado a ela.
