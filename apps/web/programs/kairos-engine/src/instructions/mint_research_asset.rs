use anchor_lang::prelude::*;
use anchor_spl::token_2022::{self, MintTo, ID as TOKEN_2022_PROGRAM_ID};
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::constants::{BPS_DENOMINATOR, NODE_SEED};
use crate::error::KairosError;
use crate::events::ResearchAssetMintedEvent;
use crate::state::NodeAccount;

#[derive(Accounts)]
pub struct MintResearchAsset<'info> {
    pub operator: Signer<'info>,
    /// CHECK: constrained by `node.has_one = owner` and PDA seeds.
    pub owner: UncheckedAccount<'info>,
    #[account(
        seeds = [NODE_SEED, owner.key().as_ref()],
        bump = node.bump,
        has_one = owner @ KairosError::Unauthorized,
        has_one = operator @ KairosError::UnauthorizedOperator
    )]
    pub node: Account<'info, NodeAccount>,
    #[account(
        mut,
        mint::authority = node,
        mint::token_program = token_program
    )]
    pub artifact_mint: InterfaceAccount<'info, Mint>,
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
    require!(amount > 0, KairosError::ZeroAmount);
    require!(
        !eidos_id.is_empty() && eidos_id.len() <= 64,
        KairosError::InvalidEidosId
    );
    require!(
        (royalty_bps as u64) <= BPS_DENOMINATOR,
        KairosError::InvalidFee
    );
    ctx.accounts
        .node
        .assert_operator(&ctx.accounts.operator.key())?;

    let owner_key = ctx.accounts.owner.key();
    let bump = [ctx.accounts.node.bump];
    let signer_seeds: &[&[&[u8]]] = &[&[NODE_SEED, owner_key.as_ref(), &bump]];

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
