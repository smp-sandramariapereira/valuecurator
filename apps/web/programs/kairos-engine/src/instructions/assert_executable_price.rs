use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use crate::constants::{NODE_SEED, REFERENCE_PRICE_SEED};
use crate::error::KairosError;
use crate::math::enforce_reference_price;
use crate::state::{NodeAccount, ReferencePrice};

#[derive(Accounts)]
pub struct AssertExecutablePrice<'info> {
    pub operator: Signer<'info>,
    /// CHECK: constrained by the node PDA seeds and `has_one`.
    pub owner: UncheckedAccount<'info>,
    #[account(
        seeds = [NODE_SEED, owner.key().as_ref()],
        bump = node.bump,
        has_one = owner @ KairosError::Unauthorized,
        has_one = operator @ KairosError::UnauthorizedOperator
    )]
    pub node: Account<'info, NodeAccount>,
    #[account(
        seeds = [REFERENCE_PRICE_SEED, node.key().as_ref()],
        bump = reference_price.bump,
        has_one = node @ KairosError::InvalidReferenceMint,
        constraint = reference_price.mint == node.strategy_mint
            @ KairosError::InvalidReferenceMint
    )]
    pub reference_price: Account<'info, ReferencePrice>,
    pub input_mint: InterfaceAccount<'info, Mint>,
    #[account(
        constraint = output_mint.key() == node.strategy_mint
            @ KairosError::InvalidStrategyMint
    )]
    pub output_mint: InterfaceAccount<'info, Mint>,
}

pub fn handle_assert_executable_price(
    ctx: Context<AssertExecutablePrice>,
    amount_in: u64,
    minimum_amount_out: u64,
) -> Result<()> {
    require!(amount_in > 0, KairosError::ZeroAmount);
    require!(minimum_amount_out > 0, KairosError::InvalidMinimumOutput);
    require_keys_neq!(
        ctx.accounts.input_mint.key(),
        ctx.accounts.output_mint.key(),
        KairosError::InvalidStrategyMint
    );
    ctx.accounts
        .node
        .assert_operator(&ctx.accounts.operator.key())?;
    enforce_reference_price(
        ctx.accounts.reference_price.reference_price,
        ctx.accounts.reference_price.maximum_deviation_bps,
        ctx.accounts.reference_price.multiplier_nano,
        amount_in,
        minimum_amount_out,
        ctx.accounts.input_mint.decimals,
        ctx.accounts.output_mint.decimals,
    )
}
