use anchor_lang::prelude::*;

use crate::constants::NODE_SEED;
use crate::error::KairosError;
use crate::events::OperatorUpdatedEvent;
use crate::state::NodeAccount;

#[derive(Accounts)]
pub struct UpdateOperator<'info> {
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [NODE_SEED, owner.key().as_ref()],
        bump = node.bump,
        has_one = owner @ KairosError::Unauthorized
    )]
    pub node: Account<'info, NodeAccount>,
}

pub fn handle_update_operator(ctx: Context<UpdateOperator>, new_operator: Pubkey) -> Result<()> {
    require_keys_neq!(
        new_operator,
        Pubkey::default(),
        KairosError::InvalidOperator
    );
    ctx.accounts.node.assert_owner(&ctx.accounts.owner.key())?;
    require_keys_neq!(
        new_operator,
        ctx.accounts.owner.key(),
        KairosError::InvalidOperator
    );
    require_keys_neq!(
        new_operator,
        ctx.accounts.node.operator,
        KairosError::InvalidOperator
    );

    let previous_operator = ctx.accounts.node.operator;
    ctx.accounts.node.operator = new_operator;

    emit!(OperatorUpdatedEvent {
        node: ctx.accounts.node.key(),
        owner: ctx.accounts.owner.key(),
        previous_operator,
        new_operator,
        timestamp: Clock::get()?.unix_timestamp,
    });
    Ok(())
}
