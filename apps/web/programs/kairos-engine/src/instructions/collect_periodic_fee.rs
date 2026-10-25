use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_2022::ID as TOKEN_2022_PROGRAM_ID;
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};

use crate::constants::{NODE_SEED, PERIODIC_FEE_EPOCH_SECONDS};
use crate::error::KairosError;
use crate::events::PeriodicFeeCollectedEvent;
use crate::math::calculate_periodic_fee_due;
use crate::state::NodeAccount;

/// Tier 2 Administrative Fee: Collect elapsed 30-day periodic node maintenance fees
/// from the Node PDA Vault to the Protocol Treasury.
#[derive(Accounts)]
pub struct CollectPeriodicFee<'info> {
    pub collector: Signer<'info>,
    /// CHECK: constrained by node.has_one and used as the PDA seed.
    pub owner: UncheckedAccount<'info>,
    #[account(
        mut,
        seeds = [NODE_SEED, owner.key().as_ref()],
        bump = node.bump,
        has_one = owner @ KairosError::Unauthorized,
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

pub fn handle_collect_periodic_fee<'a>(ctx: Context<'a, CollectPeriodicFee<'a>>) -> Result<()> {
    let collector_key = ctx.accounts.collector.key();
    let is_authorized =
        collector_key == ctx.accounts.node.owner || collector_key == ctx.accounts.node.operator;
    require!(is_authorized, KairosError::Unauthorized);

    let now_ts = Clock::get()?.unix_timestamp;
    let (epochs_settled, total_fee_due, new_last_ts) = calculate_periodic_fee_due(
        ctx.accounts.node.last_periodic_fee_ts,
        now_ts,
        PERIODIC_FEE_EPOCH_SECONDS,
        ctx.accounts.node.periodic_fee_amount,
    )?;

    require!(
        ctx.accounts.vault_token.amount >= total_fee_due,
        KairosError::InsufficientVaultBalance
    );

    if total_fee_due > 0 {
        let owner_key = ctx.accounts.owner.key();
        let bump = [ctx.accounts.node.bump];
        let signer_seeds: &[&[&[u8]]] = &[&[NODE_SEED, owner_key.as_ref(), &bump]];

        transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                TransferChecked {
                    from: ctx.accounts.vault_token.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.treasury_token.to_account_info(),
                    authority: ctx.accounts.node.to_account_info(),
                },
                signer_seeds,
            )
            .with_remaining_accounts(ctx.remaining_accounts.to_vec()),
            total_fee_due,
            ctx.accounts.mint.decimals,
        )?;
    }

    let node = &mut ctx.accounts.node;
    node.last_periodic_fee_ts = new_last_ts;
    node.total_admin_fees_collected = node
        .total_admin_fees_collected
        .checked_add(total_fee_due)
        .ok_or(KairosError::MathOverflow)?;

    emit!(PeriodicFeeCollectedEvent {
        node: node.key(),
        collector: collector_key,
        epochs_settled,
        periodic_fee_collected: total_fee_due,
        new_last_periodic_fee_ts: new_last_ts,
        timestamp: now_ts,
    });

    Ok(())
}
