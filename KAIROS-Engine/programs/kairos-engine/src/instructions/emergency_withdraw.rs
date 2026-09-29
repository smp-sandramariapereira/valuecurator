use anchor_lang::prelude::*;
use anchor_spl::token_2022::ID as TOKEN_2022_PROGRAM_ID;
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};

use crate::constants::NODE_SEED;
use crate::error::KairosError;
use crate::events::EmergencyWithdrawalEvent;
use crate::state::NodeAccount;

#[derive(Accounts)]
pub struct EmergencyWithdraw<'info> {
    pub owner: Signer<'info>,
    #[account(
        seeds = [NODE_SEED, owner.key().as_ref()],
        bump = node.bump,
        has_one = owner @ KairosError::Unauthorized
    )]
    pub node: Account<'info, NodeAccount>,
    #[account(mint::token_program = token_program)]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = node,
        associated_token::token_program = token_program
    )]
    pub vault_token: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = mint,
        token::authority = owner,
        token::token_program = token_program
    )]
    pub destination_token: InterfaceAccount<'info, TokenAccount>,
    #[account(
        constraint = token_program.key() == TOKEN_2022_PROGRAM_ID @ KairosError::InvalidTokenProgram
    )]
    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handle_emergency_withdraw<'a>(
    ctx: Context<'a, EmergencyWithdraw<'a>>,
    amount: u64,
) -> Result<()> {
    require!(amount > 0, KairosError::ZeroAmount);
    ctx.accounts.node.assert_owner(&ctx.accounts.owner.key())?;

    let owner_key = ctx.accounts.owner.key();
    let bump = [ctx.accounts.node.bump];
    let signer_seeds: &[&[u8]] = &[NODE_SEED, owner_key.as_ref(), &bump];

    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.vault_token.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.destination_token.to_account_info(),
                authority: ctx.accounts.node.to_account_info(),
            },
            &[signer_seeds],
        )
        .with_remaining_accounts(ctx.remaining_accounts.to_vec()),
        amount,
        ctx.accounts.mint.decimals,
    )?;

    emit!(EmergencyWithdrawalEvent {
        node: ctx.accounts.node.key(),
        owner: ctx.accounts.owner.key(),
        amount,
        timestamp: Clock::get()?.unix_timestamp,
    });
    Ok(())
}
