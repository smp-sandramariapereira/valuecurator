//! Experimental Devnet-only settlement against admin-funded SPL Token reserves.
//! A direct owner signature is mandatory on every trade. No external oracle,
//! AI recommendation, off-chain receipt or untrusted research report is an
//! authorization. Never deploy to Mainnet without separate security review.

use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, TransferChecked},
};

// BUILD-ONLY PLACEHOLDER. Generate/sync a fresh deployment identity, and
// validate upgrade authority before running anchor deploy; do not reuse KAIROS.
declare_id!("Fg6PaFpoGXkYsidMpWxTWqkZ7oHaZ3ZB37LSEjrA6n");

const SECONDS_PER_DAY: i64 = 86_400;
const MAX_QUOTE_LIFETIME_SECONDS: i64 = 300;

#[program]
pub mod proofgate_settlement_lab {
    use super::*;

    pub fn initialize_pool(
        ctx: Context<InitializePool>,
        rate_numerator: u64,
        rate_denominator: u64,
    ) -> Result<()> {
        require!(rate_numerator > 0 && rate_denominator > 0, LabError::InvalidRate);
        require_keys_neq!(
            ctx.accounts.input_mint.key(),
            ctx.accounts.output_mint.key(),
            LabError::SameMint
        );
        let pool = &mut ctx.accounts.pool;
        pool.admin = ctx.accounts.admin.key();
        pool.input_mint = ctx.accounts.input_mint.key();
        pool.output_mint = ctx.accounts.output_mint.key();
        pool.rate_numerator = rate_numerator;
        pool.rate_denominator = rate_denominator;
        pool.paused = false;
        pool.bump = ctx.bumps.pool;
        Ok(())
    }

    pub fn initialize_portfolio(ctx: Context<InitializePortfolio>, max_daily_input: u64) -> Result<()> {
        require!(max_daily_input > 0, LabError::InvalidLimit);
        let portfolio = &mut ctx.accounts.portfolio;
        portfolio.owner = ctx.accounts.owner.key();
        portfolio.input_mint = ctx.accounts.input_mint.key();
        portfolio.max_daily_input = max_daily_input;
        portfolio.spent_daily_input = 0;
        portfolio.day_index = 0;
        portfolio.paused = false;
        portfolio.bump = ctx.bumps.portfolio;
        Ok(())
    }

    pub fn initialize_mandate(
        ctx: Context<InitializeMandate>,
        max_per_trade: u64,
        max_daily_input: u64,
        expires_at: i64,
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        require!(max_per_trade > 0 && max_daily_input >= max_per_trade, LabError::InvalidLimit);
        require!(expires_at > now, LabError::Expired);
        require!(!ctx.accounts.pool.paused, LabError::Paused);
        let mandate = &mut ctx.accounts.mandate;
        mandate.owner = ctx.accounts.owner.key();
        mandate.pool = ctx.accounts.pool.key();
        mandate.max_per_trade = max_per_trade;
        mandate.max_daily_input = max_daily_input;
        mandate.spent_daily_input = 0;
        mandate.day_index = 0;
        mandate.expires_at = expires_at;
        mandate.paused = false;
        mandate.bump = ctx.bumps.mandate;
        Ok(())
    }

    /// Admin pre-funds synthetic output-token reserves. This is not a DEX.
    pub fn fund_reserve(ctx: Context<FundReserve>, amount: u64) -> Result<()> {
        require!(amount > 0, LabError::ZeroAmount);
        let cpi_accounts = TransferChecked {
            from: ctx.accounts.admin_source.to_account_info(),
            mint: ctx.accounts.output_mint.to_account_info(),
            to: ctx.accounts.pool_output_vault.to_account_info(),
            authority: ctx.accounts.admin.to_account_info(),
        };
        token::transfer_checked(
            CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts),
            amount,
            ctx.accounts.output_mint.decimals,
        )?;
        Ok(())
    }

    /// Executes only if the owner has signed THIS Solana transaction.
    /// The nonce receipt is created atomically, preventing the same nonce
    /// from being accepted twice. Rate is pinned against the pool snapshot.
    /// evidence_digest is an *opaque audit reference*, not oracle verification.
    #[allow(clippy::too_many_arguments)]
    pub fn execute_swap(
        ctx: Context<ExecuteSwap>,
        amount_in: u64,
        minimum_out: u64,
        nonce: u64,
        deadline: i64,
        quoted_rate_numerator: u64,
        quoted_rate_denominator: u64,
        evidence_digest: [u8; 32],
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        require!(!ctx.accounts.pool.paused && !ctx.accounts.mandate.paused &&
            !ctx.accounts.portfolio.paused, LabError::Paused);
        require!(ctx.accounts.mandate.expires_at > now, LabError::Expired);
        require!(deadline >= now && deadline <= now.saturating_add(MAX_QUOTE_LIFETIME_SECONDS), LabError::Expired);
        require!(amount_in > 0 && minimum_out > 0, LabError::ZeroAmount);
        require!(amount_in <= ctx.accounts.mandate.max_per_trade, LabError::LimitExceeded);
        require!(quoted_rate_numerator == ctx.accounts.pool.rate_numerator &&
            quoted_rate_denominator == ctx.accounts.pool.rate_denominator, LabError::QuoteChanged);

        let out_amount = calculate_output(
            amount_in, quoted_rate_numerator, quoted_rate_denominator
        )?;
        require!(out_amount >= minimum_out && out_amount > 0, LabError::MinimumOutputNotMet);
        require!(ctx.accounts.pool_output_vault.amount >= out_amount, LabError::InsufficientReserve);

        let day_index = now.div_euclid(SECONDS_PER_DAY);
        let mandate = &mut ctx.accounts.mandate;
        let portfolio = &mut ctx.accounts.portfolio;
        if mandate.day_index != day_index {
            mandate.day_index = day_index;
            mandate.spent_daily_input = 0;
        }
        if portfolio.day_index != day_index {
            portfolio.day_index = day_index;
            portfolio.spent_daily_input = 0;
        }
        mandate.spent_daily_input = mandate.spent_daily_input
            .checked_add(amount_in).ok_or(LabError::ArithmeticOverflow)?;
        portfolio.spent_daily_input = portfolio.spent_daily_input
            .checked_add(amount_in).ok_or(LabError::ArithmeticOverflow)?;
        require!(mandate.spent_daily_input <= mandate.max_daily_input &&
            portfolio.spent_daily_input <= portfolio.max_daily_input, LabError::LimitExceeded);

        let input_transfer = TransferChecked {
            from: ctx.accounts.owner_input.to_account_info(),
            mint: ctx.accounts.input_mint.to_account_info(),
            to: ctx.accounts.pool_input_vault.to_account_info(),
            authority: ctx.accounts.owner.to_account_info(),
        };
        token::transfer_checked(
            CpiContext::new(ctx.accounts.token_program.to_account_info(), input_transfer),
            amount_in,
            ctx.accounts.input_mint.decimals,
        )?;

        let admin_key = ctx.accounts.pool.admin;
        let input_key = ctx.accounts.pool.input_mint;
        let output_key = ctx.accounts.pool.output_mint;
        let bump = [ctx.accounts.pool.bump];
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"pool", admin_key.as_ref(), input_key.as_ref(), output_key.as_ref(), &bump,
        ]];
        let output_transfer = TransferChecked {
            from: ctx.accounts.pool_output_vault.to_account_info(),
            mint: ctx.accounts.output_mint.to_account_info(),
            to: ctx.accounts.owner_output.to_account_info(),
            authority: ctx.accounts.pool.to_account_info(),
        };
        token::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                output_transfer,
                signer_seeds,
            ),
            out_amount,
            ctx.accounts.output_mint.decimals,
        )?;

        let receipt = &mut ctx.accounts.receipt;
        receipt.mandate = mandate.key();
        receipt.owner = ctx.accounts.owner.key();
        receipt.nonce = nonce;
        receipt.amount_in = amount_in;
        receipt.amount_out = out_amount;
        receipt.evidence_digest = evidence_digest;
        receipt.executed_at = now;
        receipt.bump = ctx.bumps.receipt;

        emit!(SyntheticSwapExecuted {
            pool: ctx.accounts.pool.key(),
            mandate: mandate.key(),
            owner: ctx.accounts.owner.key(),
            nonce, amount_in, amount_out: out_amount,
            evidence_digest,
        });
        Ok(())
    }

    pub fn set_pool_paused(ctx: Context<SetPoolPaused>, paused: bool) -> Result<()> {
        ctx.accounts.pool.paused = paused;
        Ok(())
    }

    pub fn set_mandate_paused(ctx: Context<SetMandatePaused>, paused: bool) -> Result<()> {
        ctx.accounts.mandate.paused = paused;
        Ok(())
    }

    pub fn set_portfolio_paused(ctx: Context<SetPortfolioPaused>, paused: bool) -> Result<()> {
        ctx.accounts.portfolio.paused = paused;
        Ok(())
    }

    /// Admin recovers **only lab-owned reserve assets**, never user's wallet funds.
    pub fn withdraw_output_reserve(ctx: Context<WithdrawOutputReserve>, amount: u64) -> Result<()> {
        require!(amount > 0, LabError::ZeroAmount);
        require!(ctx.accounts.pool.paused, LabError::MustPauseFirst);
        let admin_key = ctx.accounts.pool.admin;
        let input_key = ctx.accounts.pool.input_mint;
        let output_key = ctx.accounts.pool.output_mint;
        let bump = [ctx.accounts.pool.bump];
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"pool", admin_key.as_ref(), input_key.as_ref(), output_key.as_ref(), &bump,
        ]];
        let cpi = TransferChecked {
            from: ctx.accounts.pool_output_vault.to_account_info(),
            mint: ctx.accounts.output_mint.to_account_info(),
            to: ctx.accounts.admin_destination.to_account_info(),
            authority: ctx.accounts.pool.to_account_info(),
        };
        token::transfer_checked(
            CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), cpi, signer_seeds),
            amount, ctx.accounts.output_mint.decimals
        )?;
        Ok(())
    }

    pub fn withdraw_input_reserve(ctx: Context<WithdrawInputReserve>, amount: u64) -> Result<()> {
        require!(amount > 0, LabError::ZeroAmount);
        require!(ctx.accounts.pool.paused, LabError::MustPauseFirst);
        let admin_key = ctx.accounts.pool.admin;
        let input_key = ctx.accounts.pool.input_mint;
        let output_key = ctx.accounts.pool.output_mint;
        let bump = [ctx.accounts.pool.bump];
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"pool", admin_key.as_ref(), input_key.as_ref(), output_key.as_ref(), &bump,
        ]];
        let cpi = TransferChecked {
            from: ctx.accounts.pool_input_vault.to_account_info(),
            mint: ctx.accounts.input_mint.to_account_info(),
            to: ctx.accounts.admin_destination.to_account_info(),
            authority: ctx.accounts.pool.to_account_info(),
        };
        token::transfer_checked(
            CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), cpi, signer_seeds),
            amount, ctx.accounts.input_mint.decimals
        )?;
        Ok(())
    }
}

/// Rate applies directly to raw SPL base units; client must account for mint
/// decimals. No floating point and no feed conversion occurs on-chain.
pub fn calculate_output(amount: u64, numerator: u64, denominator: u64) -> Result<u64> {
    require!(amount > 0 && numerator > 0 && denominator > 0, LabError::InvalidRate);
    let result = (amount as u128).checked_mul(numerator as u128)
        .ok_or(LabError::ArithmeticOverflow)?
        .checked_div(denominator as u128)
        .ok_or(LabError::InvalidRate)?;
    require!(result > 0 && result <= u64::MAX as u128, LabError::ArithmeticOverflow);
    Ok(result as u64)
}

#[account]
#[derive(InitSpace)]
pub struct Pool {
    pub admin: Pubkey,
    pub input_mint: Pubkey,
    pub output_mint: Pubkey,
    pub rate_numerator: u64,
    pub rate_denominator: u64,
    pub paused: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Portfolio {
    pub owner: Pubkey,
    pub input_mint: Pubkey,
    pub max_daily_input: u64,
    pub spent_daily_input: u64,
    pub day_index: i64,
    pub paused: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Mandate {
    pub owner: Pubkey,
    pub pool: Pubkey,
    pub max_per_trade: u64,
    pub max_daily_input: u64,
    pub spent_daily_input: u64,
    pub day_index: i64,
    pub expires_at: i64,
    pub paused: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct SwapReceipt {
    pub mandate: Pubkey,
    pub owner: Pubkey,
    pub nonce: u64,
    pub amount_in: u64,
    pub amount_out: u64,
    pub evidence_digest: [u8; 32],
    pub executed_at: i64,
    pub bump: u8,
}

#[derive(Accounts)]
pub struct InitializePool<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    pub input_mint: Account<'info, Mint>,
    pub output_mint: Account<'info, Mint>,
    #[account(
        init, payer = admin, space = 8 + Pool::INIT_SPACE,
        seeds = [b"pool", admin.key().as_ref(), input_mint.key().as_ref(), output_mint.key().as_ref()],
        bump
    )]
    pub pool: Account<'info, Pool>,
    #[account(init, payer = admin,
        associated_token::mint = input_mint,
        associated_token::authority = pool)]
    pub pool_input_vault: Account<'info, TokenAccount>,
    #[account(init, payer = admin,
        associated_token::mint = output_mint,
        associated_token::authority = pool)]
    pub pool_output_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializePortfolio<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    pub input_mint: Account<'info, Mint>,
    #[account(init, payer = owner, space = 8 + Portfolio::INIT_SPACE,
        seeds = [b"portfolio", owner.key().as_ref(), input_mint.key().as_ref()], bump)]
    pub portfolio: Account<'info, Portfolio>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeMandate<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    pub pool: Account<'info, Pool>,
    #[account(
        seeds = [b"portfolio", owner.key().as_ref(), pool.input_mint.as_ref()],
        bump = portfolio.bump,
        has_one = owner @ LabError::Unauthorized
    )]
    pub portfolio: Account<'info, Portfolio>,
    #[account(constraint = portfolio.input_mint == pool.input_mint @ LabError::MintMismatch)]
    pub input_mint: Account<'info, Mint>,
    #[account(init, payer = owner, space = 8 + Mandate::INIT_SPACE,
        seeds = [b"mandate", owner.key().as_ref(), pool.key().as_ref()], bump)]
    pub mandate: Account<'info, Mandate>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FundReserve<'info> {
    pub admin: Signer<'info>,
    #[account(
        seeds = [b"pool", admin.key().as_ref(), pool.input_mint.as_ref(), pool.output_mint.as_ref()],
        bump = pool.bump,
        has_one = admin @ LabError::Unauthorized,
    )]
    pub pool: Account<'info, Pool>,
    #[account(address = pool.output_mint @ LabError::MintMismatch)]
    pub output_mint: Account<'info, Mint>,
    #[account(mut, token::mint = output_mint, token::authority = admin)]
    pub admin_source: Account<'info, TokenAccount>,
    #[account(mut, associated_token::mint = output_mint, associated_token::authority = pool)]
    pub pool_output_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(amount_in: u64, minimum_out: u64, nonce: u64)]
pub struct ExecuteSwap<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        seeds = [b"pool", pool.admin.as_ref(), pool.input_mint.as_ref(), pool.output_mint.as_ref()],
        bump = pool.bump,
    )]
    pub pool: Account<'info, Pool>,
    #[account(
        mut,
        seeds = [b"mandate", owner.key().as_ref(), pool.key().as_ref()],
        bump = mandate.bump,
        has_one = owner @ LabError::Unauthorized,
        constraint = mandate.pool == pool.key() @ LabError::Unauthorized,
    )]
    pub mandate: Account<'info, Mandate>,
    #[account(
        mut,
        seeds = [b"portfolio", owner.key().as_ref(), pool.input_mint.as_ref()],
        bump = portfolio.bump,
        has_one = owner @ LabError::Unauthorized,
        constraint = portfolio.input_mint == pool.input_mint @ LabError::MintMismatch,
    )]
    pub portfolio: Account<'info, Portfolio>,
    #[account(address = pool.input_mint @ LabError::MintMismatch)]
    pub input_mint: Account<'info, Mint>,
    #[account(address = pool.output_mint @ LabError::MintMismatch)]
    pub output_mint: Account<'info, Mint>,
    #[account(mut, token::mint = input_mint, token::authority = owner)]
    pub owner_input: Account<'info, TokenAccount>,
    #[account(mut, token::mint = output_mint, token::authority = owner)]
    pub owner_output: Account<'info, TokenAccount>,
    #[account(mut, associated_token::mint = input_mint, associated_token::authority = pool)]
    pub pool_input_vault: Account<'info, TokenAccount>,
    #[account(mut, associated_token::mint = output_mint, associated_token::authority = pool)]
    pub pool_output_vault: Account<'info, TokenAccount>,
    #[account(
        init, payer = owner, space = 8 + SwapReceipt::INIT_SPACE,
        seeds = [b"receipt", mandate.key().as_ref(), &nonce.to_le_bytes()],
        bump
    )]
    pub receipt: Account<'info, SwapReceipt>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetPoolPaused<'info> {
    pub admin: Signer<'info>,
    #[account(mut, seeds = [b"pool", admin.key().as_ref(), pool.input_mint.as_ref(), pool.output_mint.as_ref()],
        bump = pool.bump, has_one = admin @ LabError::Unauthorized)]
    pub pool: Account<'info, Pool>,
}
#[derive(Accounts)]
pub struct SetMandatePaused<'info> {
    pub owner: Signer<'info>,
    #[account(mut, seeds = [b"mandate", owner.key().as_ref(), mandate.pool.as_ref()],
        bump = mandate.bump, has_one = owner @ LabError::Unauthorized)]
    pub mandate: Account<'info, Mandate>,
}
#[derive(Accounts)]
pub struct SetPortfolioPaused<'info> {
    pub owner: Signer<'info>,
    #[account(mut, seeds = [b"portfolio", owner.key().as_ref(), portfolio.input_mint.as_ref()],
        bump = portfolio.bump, has_one = owner @ LabError::Unauthorized)]
    pub portfolio: Account<'info, Portfolio>,
}
#[derive(Accounts)]
pub struct WithdrawOutputReserve<'info> {
    pub admin: Signer<'info>,
    #[account(seeds = [b"pool", admin.key().as_ref(), pool.input_mint.as_ref(), pool.output_mint.as_ref()],
        bump = pool.bump, has_one = admin @ LabError::Unauthorized)]
    pub pool: Account<'info, Pool>,
    #[account(address = pool.output_mint @ LabError::MintMismatch)]
    pub output_mint: Account<'info, Mint>,
    #[account(mut, associated_token::mint = output_mint, associated_token::authority = pool)]
    pub pool_output_vault: Account<'info, TokenAccount>,
    #[account(mut, token::mint = output_mint, token::authority = admin)]
    pub admin_destination: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}
#[derive(Accounts)]
pub struct WithdrawInputReserve<'info> {
    pub admin: Signer<'info>,
    #[account(seeds = [b"pool", admin.key().as_ref(), pool.input_mint.as_ref(), pool.output_mint.as_ref()],
        bump = pool.bump, has_one = admin @ LabError::Unauthorized)]
    pub pool: Account<'info, Pool>,
    #[account(address = pool.input_mint @ LabError::MintMismatch)]
    pub input_mint: Account<'info, Mint>,
    #[account(mut, associated_token::mint = input_mint, associated_token::authority = pool)]
    pub pool_input_vault: Account<'info, TokenAccount>,
    #[account(mut, token::mint = input_mint, token::authority = admin)]
    pub admin_destination: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[event]
pub struct SyntheticSwapExecuted {
    pub pool: Pubkey,
    pub mandate: Pubkey,
    pub owner: Pubkey,
    pub nonce: u64,
    pub amount_in: u64,
    pub amount_out: u64,
    pub evidence_digest: [u8; 32],
}

#[error_code]
pub enum LabError {
    #[msg("Only the configured authority may perform this operation")]
    Unauthorized,
    #[msg("Pool and mandate must be unpaused")]
    Paused,
    #[msg("Pause pool before reserve recovery")]
    MustPauseFirst,
    #[msg("Mint or token pair mismatch")]
    MintMismatch,
    #[msg("Input and output mints must differ")]
    SameMint,
    #[msg("Invalid exchange rate")]
    InvalidRate,
    #[msg("Invalid amount")]
    ZeroAmount,
    #[msg("Invalid per-operation or daily limit")]
    InvalidLimit,
    #[msg("Mandate or quote expired")]
    Expired,
    #[msg("Quote is no longer the pool's immutable rate")]
    QuoteChanged,
    #[msg("Risk limits exceeded")]
    LimitExceeded,
    #[msg("Minimum output not met")]
    MinimumOutputNotMet,
    #[msg("Pool lacks sufficient synthetic output reserve")]
    InsufficientReserve,
    #[msg("Integer arithmetic overflow")]
    ArithmeticOverflow,
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rate_rounds_down_in_integer_base_units() {
        assert_eq!(calculate_output(100, 3, 2).unwrap(), 150);
        assert_eq!(calculate_output(101, 1, 2).unwrap(), 50);
    }
    #[test]
    fn zero_denominator_and_overflow_are_rejected() {
        assert!(calculate_output(100, 1, 0).is_err());
        assert!(calculate_output(u64::MAX, u64::MAX, 1).is_err());
        assert!(calculate_output(1, 1, 2).is_err());
    }
}
