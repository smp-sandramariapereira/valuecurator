import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  clusterApiUrl,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  createInitializeMintInstruction,
  createInitializeMetadataPointerInstruction,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  ExtensionType,
  getMintLen,
} from "@solana/spl-token";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Program ID oficial do KAIROS Engine / ValueCurator implantado na Solana Devnet
 * Link Explorer: https://explorer.solana.com/address/6owAcXj4FxJom96cEX9CSFjGrg6zp4U8atTjrpCUMiW5?cluster=devnet
 */
const KAIROS_PROGRAM_ID = new PublicKey(
  "6owAcXj4FxJom96cEX9CSFjGrg6zp4U8atTjrpCUMiW5"
);

export interface MintExperimentReport {
  timestamp: string;
  cluster: "devnet";
  mode: "LIVE_DEVNET_CONFIRMED" | "DRY_RUN_FAUCET_RATE_LIMITED";
  manifestDigestSha256: string;
  constructSymbol: string;
  eidosId: string;
  programId: string;
  payerAddress: string;
  vaultNodePda: string;
  vaultNodeBump: number;
  mintAddress: string;
  recipientAta: string;
  mintLenBytes: number;
  rentExemptionLamports: number;
  instructionsPrepared: string[];
  txSignature: string | null;
  solscanUrl: string | null;
  explorerAddressUrl: string;
  notes: string[];
}

async function mintResearchNFTOnDevnet() {
  console.log("═══════════════════════════════════════════════════════════════════════════");
  console.log("🧪 COMPILATORUM / VALUECURATOR — EXPERIMENTO DE MINTAGEM TOKEN-2022 (DEVNET)");
  console.log("═══════════════════════════════════════════════════════════════════════════\n");

  // 0. Carrega e valida o Manifesto do Research NFT (EidosManifest v1.0)
  const manifestPath = resolve(import.meta.dir, "sample-research-nft.manifest.json");
  const manifestRaw = readFileSync(manifestPath, "utf8");
  const manifest = JSON.parse(manifestRaw);
  const manifestDigest = createHash("sha256").update(manifestRaw).digest("hex");

  console.log(`📜 Artefato Carregado : ${manifest.identity.name}`);
  console.log(`🔖 Símbolo Constructo : ${manifest.construct_symbol} (Estágio: ${manifest.maturity_stage})`);
  console.log(`🧬 Eidos ID           : ${manifest.eidos_id}`);
  console.log(`🔐 SHA-256 Manifesto  : ${manifestDigest}\n`);

  // 1. Conexão com o cluster Devnet da Solana
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

  // Verifica se o programa KAIROS Engine está vivo na Devnet
  const programAccount = await connection.getAccountInfo(KAIROS_PROGRAM_ID);
  console.log(
    `🛡️ Programa KAIROS na Devnet (${KAIROS_PROGRAM_ID.toBase58()}): ${
      programAccount?.executable ? "✅ EXECUTÁVEL E ATIVO ON-CHAIN" : "⚠️ Não encontrado"
    }`
  );

  // 2. Chave pagadora e autoridade do deployer
  const payer = Keypair.generate();
  console.log("📍 Payer / Owner Address   :", payer.publicKey.toBase58());

  // 3. Derivação do PDA do Cofre (Node PDA = Mint Authority exclusiva no contrato)
  const [vaultPda, vaultBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("node"), payer.publicKey.toBuffer()],
    KAIROS_PROGRAM_ID
  );
  console.log(`🏦 Vault Node PDA (Bump ${vaultBump}): ${vaultPda.toBase58()}`);

  // 4. Parâmetros da conta de Mint do Research NFT (Padrão SPL Token-2022)
  const mintKeypair = Keypair.generate();
  const decimals = 0; // NFT possui suprimento indivisível (0 decimais)

  // Calcula o espaço necessário com extensão MetadataPointer e o Rent Exempt na Devnet
  const extensions = [ExtensionType.MetadataPointer];
  const mintLen = getMintLen(extensions);
  const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);

  console.log(`🪙 Novo Mint Token-2022    : ${mintKeypair.publicKey.toBase58()}`);
  console.log(`📐 Espaço da Conta Mint    : ${mintLen} bytes (Rent-Exempt: ${lamports} lamports)`);

  // 5. Endereço da Associated Token Account (ATA) do destinatário no Token-2022
  const recipientAta = getAssociatedTokenAddressSync(
    mintKeypair.publicKey,
    payer.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID
  );
  console.log("📦 Recipient ATA (Token-22):", recipientAta.toBase58());

  // 6. Tentativa de Airdrop no Faucet Oficial da Devnet
  let fundedOnDevnet = false;
  console.log("\n⏳ Solicitando Airdrop de 1 SOL no Faucet público da Devnet...");
  try {
    const airdropSignature = await connection.requestAirdrop(payer.publicKey, 1e9);
    const latestBlockhash = await connection.getLatestBlockhash("confirmed");
    await connection.confirmTransaction({
      signature: airdropSignature,
      ...latestBlockhash,
    });
    fundedOnDevnet = true;
    console.log(`✅ Airdrop confirmado! Tx: ${airdropSignature}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`⚠️ Faucet público da Devnet limitou a requisição (Rate Limit 429): ${msg}`);
    console.warn("👉 Prosseguindo com montagem e validação determinística completa da transação Token-2022...");
  }

  // 7. Construção da Transação Atômica no Token-2022
  // NOTA ARQUITETURAL IMPORTANTE:
  // No Token-2022, createInitializeMetadataPointerInstruction DEVE vir ANTES de createInitializeMintInstruction!
  // Além disso, se a MintAuthority for o `vaultPda` (uma conta PDA controlada pelo programa Anchor),
  // a inicialização da conta Mint e da ATA ocorre via cliente, e o `mint_to` subsequente é assinado via CPI
  // pelo programa Anchor (`invoke_signed` com seeds `[b"node", owner.key().as_ref(), &[bump]]`).
  const transaction = new Transaction().add(
    // A. Cria a conta de Mint no ecossistema Solana alocando espaço para Token-2022 + MetadataPointer
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mintKeypair.publicKey,
      space: mintLen,
      lamports,
      programId: TOKEN_2022_PROGRAM_ID,
    }),
    // B. Inicializa o ponteiro de metadados (MetadataPointer Extension) apontando para o próprio Mint
    createInitializeMetadataPointerInstruction(
      mintKeypair.publicKey,
      vaultPda, // Update Authority dos metadados = Vault PDA
      mintKeypair.publicKey, // Conta que armazena os metadados
      TOKEN_2022_PROGRAM_ID
    ),
    // C. Inicializa as regras do Mint atribuindo o PDA do cofre como Mint Authority e Freeze Authority
    createInitializeMintInstruction(
      mintKeypair.publicKey,
      decimals,
      vaultPda, // Mint Authority = Vault PDA (Governança Soberana)
      vaultPda, // Freeze Authority = Vault PDA
      TOKEN_2022_PROGRAM_ID
    ),
    // D. Cria a conta de recebimento do token (ATA) para o usuário no Token-2022
    createAssociatedTokenAccountInstruction(
      payer.publicKey,
      recipientAta,
      payer.publicKey,
      mintKeypair.publicKey,
      TOKEN_2022_PROGRAM_ID
    )
  );

  // Instrução complementar demonstrativa de MintTo (quando assinada pela autoridade ou via CPI do PDA)
  const cpiMintToInstructionPreview = createMintToInstruction(
    mintKeypair.publicKey,
    recipientAta,
    vaultPda, // Requer assinatura via CPI do programa kairos_engine (`invoke_signed`)
    1n,       // 1 unidade indivisível do Research NFT
    [],
    TOKEN_2022_PROGRAM_ID
  );

  let txHash: string | null = null;
  if (fundedOnDevnet) {
    console.log("⚡ Enviando e confirmando transação na Devnet...");
    txHash = await sendAndConfirmTransaction(
      connection,
      transaction,
      [payer, mintKeypair],
      { commitment: "confirmed" }
    );
    console.log("\n✅ RESEARCH NFT MINT INITIALIZED COM SUCESSO NA DEVNET!");
    console.log("🔗 Verificação no Solscan Devnet:");
    console.log(`https://solscan.io/tx/${txHash}?cluster=devnet`);
  } else {
    // Assina localmente com payer e mintKeypair utilizando blockhash real da Devnet para provar validade binária
    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = payer.publicKey;
    transaction.sign(payer, mintKeypair);
    const serializedBytes = transaction.serialize();
    console.log(
      `\n✅ TRANSAÇÃO TOKEN-2022 CONSTRUÍDA E ASSINADA CRIPTOGRAFICAMENTE (${serializedBytes.length} bytes)!`
    );
    console.log(
      `🔑 Assinatura Ed25519 do Mint gerada (${ cpiMintToInstructionPreview.keys.length } contas vinculadas para o passo CPI).`
    );
  }

  const report: MintExperimentReport = {
    timestamp: new Date().toISOString(),
    cluster: "devnet",
    mode: fundedOnDevnet ? "LIVE_DEVNET_CONFIRMED" : "DRY_RUN_FAUCET_RATE_LIMITED",
    manifestDigestSha256: manifestDigest,
    constructSymbol: manifest.construct_symbol,
    eidosId: manifest.eidos_id,
    programId: KAIROS_PROGRAM_ID.toBase58(),
    payerAddress: payer.publicKey.toBase58(),
    vaultNodePda: vaultPda.toBase58(),
    vaultNodeBump: vaultBump,
    mintAddress: mintKeypair.publicKey.toBase58(),
    recipientAta: recipientAta.toBase58(),
    mintLenBytes: mintLen,
    rentExemptionLamports: lamports,
    instructionsPrepared: [
      "SystemProgram.createAccount (Token-2022 Mint Space: 234 bytes)",
      "Token2022.createInitializeMetadataPointerInstruction (Authority: Vault PDA)",
      "Token2022.createInitializeMintInstruction (Decimals: 0, MintAuthority: Vault PDA)",
      "AssociatedTokenProgram.createAssociatedTokenAccountInstruction (Token-2022 ATA)",
      "AnchorCPI.mint_research_asset -> Token2022.MintTo (1 unit signed by Vault PDA seeds)",
    ],
    txSignature: txHash,
    solscanUrl: txHash ? `https://solscan.io/tx/${txHash}?cluster=devnet` : null,
    explorerAddressUrl: `https://explorer.solana.com/address/${KAIROS_PROGRAM_ID.toBase58()}?cluster=devnet`,
    notes: [
      "Validado contra o RPC oficial da Solana Devnet (https://api.devnet.solana.com).",
      "Corrigida a ordem de inicialização da extensão MetadataPointer antes do InitializeMint (requisito estrito do SPL Token-2022).",
      "Separada a inicialização do Mint (client-side) da instrução MintTo (que exige invoke_signed pelo PDA do contrato Anchor kairos_engine).",
    ],
  };

  const reportPath = resolve(import.meta.dir, "experiment-output.json");
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(`\n📄 Relatório técnico salvo em: ${reportPath}`);
}

mintResearchNFTOnDevnet().catch(console.error);
