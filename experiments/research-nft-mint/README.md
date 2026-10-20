# 🧪 Experimento de Mintagem Token-2022 (`Research NFT` / `EidosManifest v1.0`) na Solana Devnet

Este pacote implementa o experimento de tokenização soberana de artefatos próprios (**Research NFTs / Executable Semantic Assets**) no padrão **SPL Token-2022 (`MetadataPointer` + `MintAuthority = Node PDA`)**, integrado à arquitetura do **ValueCurator (`kairos_engine`)**.

## 📂 Arquivos do Experimento

* 📜 **[`ResearchNFTManifest.schema.json`](./ResearchNFTManifest.schema.json)**: JSON Schema Draft 2020-12 para validação de manifestos de Research NFTs (`CompilatorumResearchNFTManifest` v1.0).
* 📄 **[`sample-research-nft.manifest.json`](./sample-research-nft.manifest.json)**: Exemplo de manifesto real (`R-NFT-ONS-001` — *Oráculo Neuro-Simbólico & ProofGate Control-Plane*).
* 💻 **[`mint-research-nft.ts`](./mint-research-nft.ts)**: Script TypeScript executável que conecta na Solana Devnet, verifica o programa `kairos_engine` (`6owAcXj4FxJom96cEX9CSFjGrg6zp4U8atTjrpCUMiW5`), deriva o `Node PDA` como `MintAuthority` exclusiva, calcula o rent-exemption de 234 bytes (`MetadataPointer`) e constrói/assina a transação atômica do Token-2022.
* 🦀 **[`mint_research_asset.rs`](./mint_research_asset.rs)**: Instrução Rust/Anchor para o programa `kairos_engine` assinar via CPI (`invoke_signed`) a cunhagem (`token_2022::mint_to`) da unidade do Research NFT após verificação pelo ProofGate.
* 📊 **[`experiment-output.json`](./experiment-output.json)**: Telemetria real gerada pela execução contra a Solana Devnet.

## 🚀 Como Executar

```bash
bun install
bun run mint-research-nft.ts
```

Para ler a análise comparativa completa com **ELI5** e **Diagramas Mermaid Coloridos**, consulte:
👉 [`../../documentos/EXPERIMENTO_MINTAGEM_RESEARCH_NFT_TOKEN2022_E_COMPARATIVO_DEVNET.md`](../../documentos/EXPERIMENTO_MINTAGEM_RESEARCH_NFT_TOKEN2022_E_COMPARATIVO_DEVNET.md)
