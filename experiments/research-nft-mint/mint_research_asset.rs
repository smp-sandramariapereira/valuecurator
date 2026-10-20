// ============================================================================
// 🦀 KAIROS ENGINE — MÓDULO DE EMISSÃO SOBERANA DE ARTEFATOS (TOKEN-2022)
// Caminho de Integração: apps/web/programs/kairos-engine/src/instructions/mint_research_asset.rs
// ============================================================================

use anchor_lang::prelude::*;
use anchor_spl::token_2022::{self, MintTo, ID as TOKEN_2022_PROGRAM_ID};
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::constants::NODE_SEED;
use crate::error::KairosError;
use crate::state::NodeAccount;

/// Evento emitido on-chain quando um Research NFT ou Artefato Token-2022
/// é cunhado sob autorização do Node PDA (ProofGate).
#[event]
pub struct ResearchAssetMintedEvent {
    pub node: Pubkey,
    pub owner: Pubkey,
    pub operator: Pubkey,
    pub artifact_mint: Pubkey,
    pub recipient_ata: Pubkey,
    pub eidos_id: String,
    pub manifest_sha256: [u8; 32],
    pub amount: u64,
    pub royalty_bps: u16,
    pub timestamp: i64,
}

#[derive(Accounts)]
pub struct MintResearchAsset<'info> {
    /// Operador (Agente autorizado) ou Owner que dispara a instrução
    pub operator: Signer<'info>,

    /// CHECK: validado via `has_one = owner` e semente do PDA `node`.
    pub owner: UncheckedAccount<'info>,

    /// O Node PDA soberano atua como a `Mint Authority` exclusiva do Token-2022!
    #[account(
        seeds = [NODE_SEED, owner.key().as_ref()],
        bump = node.bump,
        has_one = owner @ KairosError::Unauthorized,
        has_one = operator @ KairosError::UnauthorizedOperator
    )]
    pub node: Account<'info, NodeAccount>,

    /// Conta de Mint do Research NFT / Artefato no padrão SPL Token-2022,
    /// cuja `mint_authority` foi configurada para `node.key()`.
    #[account(
        mut,
        mint::authority = node,
        mint::token_program = token_program
    )]
    pub artifact_mint: InterfaceAccount<'info, Mint>,

    /// Associated Token Account (ATA) de destino (do Owner, da Tesouraria ou do Vault).
    #[account(
        mut,
        token::mint = artifact_mint,
        token::token_program = token_program
    )]
    pub recipient_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(
        constraint = token_program.key() == TOKEN_2022_PROGRAM_ID @ KairosError::InvalidTokenProgram
    )]
    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handle_mint_research_asset(
    ctx: Context<MintResearchAsset>,
    eidos_id: String,
    manifest_sha256: [u8; 32],
    amount: u64,
    royalty_bps: u16,
) -> Result<()> {
    // 1. Invariantes Fiduciários do Portão (ProofGate)
    require!(amount > 0, KairosError::ZeroAmount);
    require!(!eidos_id.is_empty() && eidos_id.len() <= 64, KairosError::Unauthorized);
    require!(royalty_bps <= 10_000, KairosError::InvalidFee);

    // 2. Verifica se o operador que propôs o mint é o operador autorizado pelo Owner
    ctx.accounts
        .node
        .assert_operator(&ctx.accounts.operator.key())?;

    // 3. Constrói as sementes criptográficas do Node PDA para assinar via CPI (`invoke_signed`)
    let owner_key = ctx.accounts.owner.key();
    let bump = [ctx.accounts.node.bump];
    let signer_seeds: &[&[&[u8]]] = &[&[NODE_SEED, owner_key.as_ref(), &bump]];

    // 4. Executa a chamada CPI para o programa SPL Token-2022 cunhando o ativo!
    token_2022::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.artifact_mint.to_account_info(),
                to: ctx.accounts.recipient_ata.to_account_info(),
                authority: ctx.accounts.node.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
    )?;

    // 5. Emite o evento auditável on-chain vinculando o Mint ao hash SHA-256 do EidosManifest
    emit!(ResearchAssetMintedEvent {
        node: ctx.accounts.node.key(),
        owner: owner_key,
        operator: ctx.accounts.operator.key(),
        artifact_mint: ctx.accounts.artifact_mint.key(),
        recipient_ata: ctx.accounts.recipient_ata.key(),
        eidos_id,
        manifest_sha256,
        amount,
        royalty_bps,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}
