use anchor_lang::prelude::*;

use crate::constants::{BPS_DENOMINATOR, NODE_SEED, REFERENCE_PRICE_SEED};
use crate::error::KairosError;
use crate::state::{NodeAccount, ReferencePrice};

#[derive(Accounts)]
pub struct PostReferencePrice<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        seeds = [NODE_SEED, owner.key().as_ref()],
        bump = node.bump,
        has_one = owner @ KairosError::Unauthorized
    )]
    pub node: Account<'info, NodeAccount>,
    #[account(
        init_if_needed,
        payer = owner,
        space = 8 + ReferencePrice::INIT_SPACE,
        seeds = [REFERENCE_PRICE_SEED, node.key().as_ref()],
        bump
    )]
    pub reference_price: Account<'info, ReferencePrice>,
    pub system_program: Program<'info, System>,
}

pub fn handle_post_reference_price(
    ctx: Context<PostReferencePrice>,
    reference_price: u64,
    maximum_deviation_bps: u16,
    multiplier_nano: u64,
) -> Result<()> {
    require!(reference_price > 0, KairosError::InvalidReferencePrice);
    require!(multiplier_nano > 0, KairosError::InvalidMultiplier);
    require!(
        (maximum_deviation_bps as u64) <= BPS_DENOMINATOR,
        KairosError::InvalidDeviationLimit
    );
    require_keys_neq!(
        ctx.accounts.node.strategy_mint,
        Pubkey::default(),
        KairosError::InvalidStrategyMint
    );
    ctx.accounts.node.assert_owner(&ctx.accounts.owner.key())?;

    let price = &mut ctx.accounts.reference_price;
    price.node = ctx.accounts.node.key();
    price.mint = ctx.accounts.node.strategy_mint;
    price.reference_price = reference_price;
    price.multiplier_nano = multiplier_nano;
    price.maximum_deviation_bps = maximum_deviation_bps;
    price.bump = ctx.bumps.reference_price;
    Ok(())
}
