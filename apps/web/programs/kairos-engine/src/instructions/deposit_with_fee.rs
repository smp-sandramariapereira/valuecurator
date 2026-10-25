use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_2022::ID as TOKEN_2022_PROGRAM_ID;
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};

use crate::constants::NODE_SEED;
use crate::error::KairosError;
use crate::events::DepositFeeCollectedEvent;
use crate::math::split_deposit_fee;
use crate::state::NodeAccount;

/// Tier 1 Administrative Fee: Deposit into the Node PDA Vault with an automatic
/// entry fee split routed directly to the Protocol Treasury.
#[derive(Accounts)]
pub struct DepositWithFee<'info> {
    pub depositor: Signer<'info>,
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
        associated_token::authority = depositor,
        associated_token::token_program = token_program
    )]
    pub depositor_token: InterfaceAccount<'info, TokenAccount>,
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

pub fn handle_deposit_with_fee<'a>(
    ctx: Context<'a, DepositWithFee<'a>>,
    gross_amount: u64,
) -> Result<()> {
    let fee_bps = ctx.accounts.node.deposit_fee_bps;
    let (deposit_fee, net_vaulted) = split_deposit_fee(gross_amount, fee_bps)?;

    let decimals = ctx.accounts.mint.decimals;
    let token_program = ctx.accounts.token_program.key();
    let remaining = ctx.remaining_accounts.to_vec();
    let from = ctx.accounts.depositor_token.to_account_info();
    let mint = ctx.accounts.mint.to_account_info();
    let authority = ctx.accounts.depositor.to_account_info();

    if deposit_fee > 0 {
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
            deposit_fee,
            decimals,
        )?;
    }

    if net_vaulted > 0 {
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
            net_vaulted,
            decimals,
        )?;
    }

    let node = &mut ctx.accounts.node;
    node.total_admin_fees_collected = node
        .total_admin_fees_collected
        .checked_add(deposit_fee)
        .ok_or(KairosError::MathOverflow)?;

    emit!(DepositFeeCollectedEvent {
        node: node.key(),
        depositor: ctx.accounts.depositor.key(),
        gross_amount,
        deposit_fee_collected: deposit_fee,
        net_vaulted,
        deposit_fee_bps: fee_bps,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}
