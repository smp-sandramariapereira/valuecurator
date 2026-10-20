use anchor_lang::prelude::*;
use anchor_spl::token_2022::{self, MintTo, ID as TOKEN_2022_PROGRAM_ID};
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};

use crate::constants::{NODE_SEED, REFERENCE_PRICE_SEED};
use crate::error::KairosError;
use crate::events::StrategySwapEvent;
use crate::math::enforce_reference_price;
use crate::state::{NodeAccount, ReferencePrice};

/// Deterministic Devnet Strategy Swap (`execute_devnet_strategy_swap`).
///
/// Unlike `execute_strategy_swap` (which invokes `JUPITER_V6_PROGRAM_ID` on Mainnet),
/// this instruction settles a Token-2022 strategy acquisition directly on Solana Devnet:
/// 1. Validates operator authority and non-zero amounts.
/// 2. Enforces the owner-posted `ReferencePrice` invariant (`enforce_reference_price`)
///    in `math.rs`, rejecting any order whose implied price deviates beyond `maximum_deviation_bps`.
/// 3. Transfers `amount_in` of `input_mint` (e.g., Devnet dUSDC) from `input_vault` (Node PDA)
///    into `treasury_reserve_vault` (Treasury liquidity reserve).
/// 4. Mints `minimum_amount_out` of `output_mint` (Token-2022 RWA / Research Asset where
///    `mint_authority == node`) directly into `output_vault` (or client ATA).
/// 5. Emits `StrategySwapEvent` on-chain for Solscan / Solana Explorer verification.
#[derive(Accounts)]
pub struct ExecuteDevnetStrategySwap<'info> {
    pub operator: Signer<'info>,
    /// CHECK: constrained by `node.has_one = owner` and PDA seeds.
    pub owner: UncheckedAccount<'info>,
    #[account(
        seeds = [NODE_SEED, owner.key().as_ref()],
        bump = node.bump,
        has_one = owner @ KairosError::Unauthorized,
        has_one = operator @ KairosError::UnauthorizedOperator
    )]
    pub node: Box<Account<'info, NodeAccount>>,
    #[account(
        seeds = [REFERENCE_PRICE_SEED, node.key().as_ref()],
        bump = reference_price.bump,
        has_one = node @ KairosError::InvalidReferenceMint,
        constraint = reference_price.mint == node.strategy_mint
            @ KairosError::InvalidReferenceMint
    )]
    pub reference_price: Box<Account<'info, ReferencePrice>>,
    pub input_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        mut,
        constraint = output_mint.key() == node.strategy_mint
            @ KairosError::InvalidStrategyMint,
        mint::authority = node,
        mint::token_program = output_token_program
    )]
    pub output_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        mut,
        token::mint = input_mint,
        token::authority = node,
        token::token_program = input_token_program
    )]
    pub input_vault: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        mut,
        token::mint = input_mint,
        token::authority = node.treasury_pubkey @ KairosError::InvalidTreasuryAccount,
        token::token_program = input_token_program
    )]
    pub treasury_reserve_vault: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        mut,
        token::mint = output_mint,
        token::token_program = output_token_program
    )]
    pub output_vault: Box<InterfaceAccount<'info, TokenAccount>>,
    pub input_token_program: Interface<'info, TokenInterface>,
    #[account(
        constraint = output_token_program.key() == TOKEN_2022_PROGRAM_ID @ KairosError::InvalidTokenProgram
    )]
    pub output_token_program: Interface<'info, TokenInterface>,
}

pub fn handle_execute_devnet_strategy_swap<'a>(
    ctx: Context<'a, ExecuteDevnetStrategySwap<'a>>,
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

    // Deterministic ProofGate price invariant check on-chain
    enforce_reference_price(
        ctx.accounts.reference_price.reference_price,
        ctx.accounts.reference_price.maximum_deviation_bps,
        ctx.accounts.reference_price.multiplier_nano,
        amount_in,
        minimum_amount_out,
        ctx.accounts.input_mint.decimals,
        ctx.accounts.output_mint.decimals,
    )?;

    let owner_key = ctx.accounts.owner.key();
    let bump = [ctx.accounts.node.bump];
    let signer_seeds: &[&[&[u8]]] = &[&[NODE_SEED, owner_key.as_ref(), &bump]];

    // Leg 1: Transfer exact `amount_in` of input collateral (dUSDC) from Node Vault to Treasury Reserve
    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.input_token_program.key(),
            TransferChecked {
                from: ctx.accounts.input_vault.to_account_info(),
                mint: ctx.accounts.input_mint.to_account_info(),
                to: ctx.accounts.treasury_reserve_vault.to_account_info(),
                authority: ctx.accounts.node.to_account_info(),
            },
            signer_seeds,
        ),
        amount_in,
        ctx.accounts.input_mint.decimals,
    )?;

    // Leg 2: Mint `minimum_amount_out` of Token-2022 strategy asset into output vault / client ATA
    token_2022::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.output_token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.output_mint.to_account_info(),
                to: ctx.accounts.output_vault.to_account_info(),
                authority: ctx.accounts.node.to_account_info(),
            },
            signer_seeds,
        ),
        minimum_amount_out,
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
