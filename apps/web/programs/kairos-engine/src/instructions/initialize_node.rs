use anchor_lang::prelude::*;

use crate::constants::{
    BPS_DENOMINATOR, DEFAULT_DEPOSIT_FEE_BPS, DEFAULT_INFRASTRUCTURE_FEE_BPS,
    DEFAULT_PERIODIC_FEE_AMOUNT, NODE_SEED,
};
use crate::error::KairosError;
use crate::state::NodeAccount;

#[derive(Accounts)]
pub struct InitializeNode<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// Governance authority and PDA seed.
    pub owner: Signer<'info>,
    #[account(
        init,
        payer = payer,
        space = 8 + NodeAccount::INIT_SPACE,
        seeds = [NODE_SEED, owner.key().as_ref()],
        bump
    )]
    pub node: Account<'info, NodeAccount>,
    pub system_program: Program<'info, System>,
}

pub fn handle_initialize_node(
    ctx: Context<InitializeNode>,
    infrastructure_fee_bps: u16,
    treasury_pubkey: Pubkey,
    operator: Pubkey,
    strategy_mint: Pubkey,
) -> Result<()> {
    require!(
        (infrastructure_fee_bps as u64) <= BPS_DENOMINATOR,
        KairosError::InvalidFee
    );
    require_keys_neq!(operator, Pubkey::default(), KairosError::InvalidOperator);
    require_keys_neq!(
        operator,
        ctx.accounts.owner.key(),
        KairosError::InvalidOperator
    );
    require_keys_neq!(
        strategy_mint,
        Pubkey::default(),
        KairosError::InvalidStrategyMint
    );

    let fee = if infrastructure_fee_bps == 0 {
        DEFAULT_INFRASTRUCTURE_FEE_BPS
    } else {
        infrastructure_fee_bps
    };

    let now_ts = Clock::get()?.unix_timestamp;
    let node = &mut ctx.accounts.node;
    node.owner = ctx.accounts.owner.key();
    node.operator = operator;
    node.infrastructure_fee_bps = fee;
    node.total_metabolized = 0;
    node.treasury_pubkey = treasury_pubkey;
    node.strategy_mint = strategy_mint;
    node.bump = ctx.bumps.node;
    node.deposit_fee_bps = DEFAULT_DEPOSIT_FEE_BPS;
    node.periodic_fee_amount = DEFAULT_PERIODIC_FEE_AMOUNT;
    node.last_periodic_fee_ts = now_ts;
    node.total_admin_fees_collected = 0;
    node._reserved = [0u8; 6];

    Ok(())
}
