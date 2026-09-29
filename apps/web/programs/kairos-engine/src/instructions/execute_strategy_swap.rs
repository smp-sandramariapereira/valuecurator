use anchor_lang::{
    prelude::*,
    solana_program::{instruction::Instruction, program::invoke_signed},
};
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::constants::NODE_SEED;
use crate::error::KairosError;
use crate::events::StrategySwapEvent;
use crate::state::NodeAccount;

pub const JUPITER_V6_PROGRAM_ID: Pubkey = pubkey!("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4");

#[derive(Accounts)]
pub struct ExecuteStrategySwap<'info> {
    pub operator: Signer<'info>,
    /// CHECK: constrained by node.has_one and used as PDA seed.
    pub owner: UncheckedAccount<'info>,
    #[account(
        seeds = [NODE_SEED, owner.key().as_ref()],
        bump = node.bump,
        has_one = owner @ KairosError::Unauthorized,
        has_one = operator @ KairosError::UnauthorizedOperator
    )]
    pub node: Account<'info, NodeAccount>,
    pub input_mint: InterfaceAccount<'info, Mint>,
    #[account(
        constraint = output_mint.key() == node.strategy_mint
            @ KairosError::InvalidStrategyMint
    )]
    pub output_mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        token::mint = input_mint,
        token::authority = node,
        token::token_program = input_token_program
    )]
    pub input_vault: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = output_mint,
        token::authority = node,
        token::token_program = output_token_program
    )]
    pub output_vault: InterfaceAccount<'info, TokenAccount>,
    pub input_token_program: Interface<'info, TokenInterface>,
    pub output_token_program: Interface<'info, TokenInterface>,
    /// CHECK: executable address is pinned to Jupiter v6.
    #[account(address = JUPITER_V6_PROGRAM_ID, executable)]
    pub jupiter_program: UncheckedAccount<'info>,
}

pub fn handle_execute_strategy_swap<'a>(
    ctx: Context<'a, ExecuteStrategySwap<'a>>,
    instruction_data: Vec<u8>,
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

    let input_before = ctx.accounts.input_vault.amount;
    let output_before = ctx.accounts.output_vault.amount;
    require!(
        input_before >= amount_in,
        KairosError::InsufficientVaultBalance
    );

    let metas = ctx
        .remaining_accounts
        .iter()
        .map(|account| AccountMeta {
            pubkey: *account.key,
            is_signer: account.key == &ctx.accounts.node.key(),
            is_writable: account.is_writable,
        })
        .collect();
    let infos: Vec<AccountInfo<'a>> = ctx
        .remaining_accounts
        .iter()
        .map(|account| AccountInfo { ..account.clone() })
        .collect();

    let owner_key = ctx.accounts.owner.key();
    let bump = [ctx.accounts.node.bump];
    let signer_seeds: &[&[&[u8]]] = &[&[NODE_SEED, owner_key.as_ref(), &bump]];

    invoke_signed(
        &Instruction {
            program_id: JUPITER_V6_PROGRAM_ID,
            accounts: metas,
            data: instruction_data,
        },
        &infos,
        signer_seeds,
    )?;

    ctx.accounts.input_vault.reload()?;
    ctx.accounts.output_vault.reload()?;
    let input_spent = input_before
        .checked_sub(ctx.accounts.input_vault.amount)
        .ok_or(KairosError::InvalidSwapBalance)?;
    let output_received = ctx
        .accounts
        .output_vault
        .amount
        .checked_sub(output_before)
        .ok_or(KairosError::InvalidSwapBalance)?;

    require!(input_spent == amount_in, KairosError::InvalidSwapInput);
    require!(
        output_received >= minimum_amount_out,
        KairosError::SlippageExceeded
    );

    emit!(StrategySwapEvent {
        node: ctx.accounts.node.key(),
        operator: ctx.accounts.operator.key(),
        input_mint: ctx.accounts.input_mint.key(),
        output_mint: ctx.accounts.output_mint.key(),
        amount_in: input_spent,
        amount_out: output_received,
        minimum_amount_out,
        timestamp: Clock::get()?.unix_timestamp,
    });
    Ok(())
}
