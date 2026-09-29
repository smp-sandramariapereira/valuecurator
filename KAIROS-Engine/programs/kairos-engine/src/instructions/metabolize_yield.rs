use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_2022::ID as TOKEN_2022_PROGRAM_ID;
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};

use crate::constants::NODE_SEED;
use crate::error::KairosError;
use crate::events::MetabolicEvent;
use crate::math::split_yield;
use crate::state::NodeAccount;

#[derive(Accounts)]
pub struct MetabolizeYield<'info> {
    pub operator: Signer<'info>,
    /// CHECK: constrained by node.has_one and used as the PDA seed.
    pub owner: UncheckedAccount<'info>,
    #[account(
        mut,
        seeds = [NODE_SEED, owner.key().as_ref()],
        bump = node.bump,
        has_one = owner @ KairosError::Unauthorized,
        has_one = operator @ KairosError::UnauthorizedOperator,
        has_one = treasury_pubkey @ KairosError::InvalidTreasuryAccount
    )]
    pub node: Account<'info, NodeAccount>,
    /// CHECK: compared against node.treasury_pubkey.
    pub treasury_pubkey: UncheckedAccount<'info>,
    #[account(mint::token_program = token_program)]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = operator,
        associated_token::token_program = token_program
    )]
    pub source_token: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = node,
        associated_token::token_program = token_program
    )]
    pub vault_token: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = treasury_pubkey,
        associated_token::token_program = token_program
    )]
    pub treasury_token: InterfaceAccount<'info, TokenAccount>,
    #[account(
        constraint = token_program.key() == TOKEN_2022_PROGRAM_ID @ KairosError::InvalidTokenProgram
    )]
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn handle_metabolize_yield<'a>(
    ctx: Context<'a, MetabolizeYield<'a>>,
    amount: u64,
) -> Result<()> {
    ctx.accounts
        .node
        .assert_operator(&ctx.accounts.operator.key())?;
    let (infrastructure, vaulted) = split_yield(amount, ctx.accounts.node.infrastructure_fee_bps)?;

    let decimals = ctx.accounts.mint.decimals;
    let token_program = ctx.accounts.token_program.key();
    let remaining = ctx.remaining_accounts.to_vec();
    let from = ctx.accounts.source_token.to_account_info();
    let mint = ctx.accounts.mint.to_account_info();
    let authority = ctx.accounts.operator.to_account_info();

    if infrastructure > 0 {
        transfer_checked(
            CpiContext::new(
                token_program,
                TransferChecked {
                    from: from.clone(),
                    mint: mint.clone(),
                    to: ctx.accounts.treasury_token.to_account_info(),
                    authority: authority.clone(),
                },
            )
            .with_remaining_accounts(remaining.clone()),
            infrastructure,
            decimals,
        )?;
    }

    if vaulted > 0 {
        transfer_checked(
            CpiContext::new(
                token_program,
                TransferChecked {
                    from,
                    mint,
                    to: ctx.accounts.vault_token.to_account_info(),
                    authority,
                },
            )
            .with_remaining_accounts(remaining),
            vaulted,
            decimals,
        )?;
    }

    let node = &mut ctx.accounts.node;
    node.total_metabolized = node
        .total_metabolized
        .checked_add(amount)
        .ok_or(KairosError::MathOverflow)?;

    emit!(MetabolicEvent {
        node: node.key(),
        operator: ctx.accounts.operator.key(),
        vaulted,
        infrastructure_funded: infrastructure,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}
