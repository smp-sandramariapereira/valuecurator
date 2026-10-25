use anchor_lang::prelude::*;

use crate::constants::{BPS_DENOMINATOR, NODE_SEED};
use crate::error::KairosError;
use crate::events::AdminFeeScheduleUpdatedEvent;
use crate::state::NodeAccount;

#[derive(Accounts)]
pub struct ConfigureAdminFees<'info> {
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [NODE_SEED, owner.key().as_ref()],
        bump = node.bump,
        has_one = owner @ KairosError::Unauthorized
    )]
    pub node: Account<'info, NodeAccount>,
}

pub fn handle_configure_admin_fees(
    ctx: Context<ConfigureAdminFees>,
    deposit_fee_bps: u16,
    periodic_fee_amount: u64,
    infrastructure_fee_bps: u16,
) -> Result<()> {
    ctx.accounts.node.assert_owner(&ctx.accounts.owner.key())?;
    require!(
        (deposit_fee_bps as u64) <= BPS_DENOMINATOR,
        KairosError::InvalidFee
    );
    require!(
        (infrastructure_fee_bps as u64) <= BPS_DENOMINATOR,
        KairosError::InvalidFee
    );

    let node = &mut ctx.accounts.node;
    node.deposit_fee_bps = deposit_fee_bps;
    node.periodic_fee_amount = periodic_fee_amount;
    node.infrastructure_fee_bps = infrastructure_fee_bps;

    emit!(AdminFeeScheduleUpdatedEvent {
        node: node.key(),
        owner: ctx.accounts.owner.key(),
        deposit_fee_bps,
        periodic_fee_amount,
        infrastructure_fee_bps,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}
