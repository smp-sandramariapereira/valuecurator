//! Experimental Devnet-only settlement against admin-funded SPL Token reserves.
//! A direct owner signature is mandatory on every trade. No external oracle,
//! AI recommendation, off-chain receipt or untrusted research report is an
//! authorization. Never deploy to Mainnet without separate security review.

use anchor_lang::prelude::*;
use authorization::{
    authorization_digest, authorization_message, bind_proofgate_authorization, monotonic_policy_update,
    ProofGateAuthorizationV1, CONFIG_INITIALIZER,
};
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, TransferChecked},
};

// Local Surfpool identity. The matching secret lives only in
// programs/.local-keys/, which Git ignores. This address is not a Devnet
// deployment and must not be reused for KAIROS.
declare_id!("CJ2NA3E8ZWZFMjrLtzAKxGZNomLBP4Tvnh8hQiFD3ecA");

mod authorization;

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
            CpiContext::new(ctx.accounts.token_program.key(), cpi_accounts),
            amount,
            ctx.accounts.output_mint.decimals,
        )?;
        Ok(())
    }

    /// Executes only if the owner signed this transaction AND the previous
    /// instruction is an Ed25519 verification of the canonical ProofGate
    /// authorization for these exact accounts and arguments.
    ///
    /// `execution_digest` must equal the digest this instruction computes.
    /// It is not the ProofGate signature and it is not an authorization.
    #[allow(clippy::too_many_arguments)]
    pub fn execute_swap(
        ctx: Context<ExecuteSwap>,
        amount_in: u64,
        minimum_out: u64,
        nonce: u64,
        deadline: i64,
        quoted_rate_numerator: u64,
        quoted_rate_denominator: u64,
        client_execution_digest: [u8; 32],
        evidence_digest: [u8; 32],
        proposal_digest: [u8; 32],
        issued_at: i64,
        expires_at: i64,
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        require!(!ctx.accounts.pool.paused && !ctx.accounts.mandate.paused &&
            !ctx.accounts.portfolio.paused, LabError::Paused);
        require!(!ctx.accounts.proofgate_config.paused, LabError::GovernanceHalted);
        require!(ctx.accounts.mandate.expires_at > now, LabError::Expired);
        require!(deadline >= now && deadline <= now.saturating_add(MAX_QUOTE_LIFETIME_SECONDS), LabError::Expired);
        require!(amount_in > 0 && minimum_out > 0, LabError::ZeroAmount);
        require!(amount_in <= ctx.accounts.mandate.max_per_trade, LabError::LimitExceeded);
        require_keys_neq!(
            ctx.accounts.proofgate_config.policy_signer,
            ctx.accounts.owner.key(),
            LabError::Unauthorized
        );

        let out_amount = calculate_output(
            amount_in, quoted_rate_numerator, quoted_rate_denominator
        )?;
        let computed_digest = execution_digest(&ExecutionParameters {
            program_id: crate::ID,
            owner: ctx.accounts.owner.key(),
            pool: ctx.accounts.pool.key(),
            mandate: ctx.accounts.mandate.key(),
            input_mint: ctx.accounts.input_mint.key(),
            output_mint: ctx.accounts.output_mint.key(),
            amount_in,
            amount_out: out_amount,
            minimum_out,
            nonce,
            deadline,
            rate_numerator: quoted_rate_numerator,
            rate_denominator: quoted_rate_denominator,
        });
        let config = &ctx.accounts.proofgate_config;
        let authorization = authorization_message(&ProofGateAuthorizationV1 {
            program_id: crate::ID,
            deployment_id: config.deployment_id,
            proofgate_config: config.key(),
            policy_signer: config.policy_signer,
            policy_version: config.policy_version,
            authorization_epoch: config.authorization_epoch,
            owner: ctx.accounts.owner.key(),
            mandate: ctx.accounts.mandate.key(),
            pool: ctx.accounts.pool.key(),
            input_mint: ctx.accounts.input_mint.key(),
            output_mint: ctx.accounts.output_mint.key(),
            token_program: ctx.accounts.token_program.key(),
            amount_in,
            minimum_amount_out: minimum_out,
            quoted_rate_numerator,
            quoted_rate_denominator,
            evidence_digest,
            proposal_digest,
            execution_digest: client_execution_digest,
            nonce,
            issued_at,
            expires_at,
        });
        let approved_authorization = authorization_digest(&authorization);
        bind_proofgate_authorization(
            &ctx.accounts.instruction_sysvar.to_account_info(),
            &config.policy_signer,
            &approved_authorization,
        )?;
        require!(
            issued_at <= now && expires_at > now && expires_at > issued_at,
            LabError::AuthorizationExpired
        );
        require!(quoted_rate_numerator == ctx.accounts.pool.rate_numerator &&
            quoted_rate_denominator == ctx.accounts.pool.rate_denominator, LabError::QuoteChanged);
        require!(out_amount >= minimum_out && out_amount > 0, LabError::MinimumOutputNotMet);
        require!(ctx.accounts.pool_output_vault.amount >= out_amount, LabError::InsufficientReserve);
        require!(client_execution_digest == computed_digest, LabError::DigestMismatch);

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
            CpiContext::new(ctx.accounts.token_program.key(), input_transfer),
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
                ctx.accounts.token_program.key(),
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
        receipt.evidence_digest = computed_digest;
        receipt.executed_at = now;
        receipt.authorization_digest = approved_authorization;
        receipt.bump = ctx.bumps.receipt;

        emit!(SyntheticSwapExecuted {
            pool: ctx.accounts.pool.key(),
            mandate: mandate.key(),
            owner: ctx.accounts.owner.key(),
            nonce, amount_in, amount_out: out_amount,
            evidence_digest: computed_digest,
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

    /// Creates the only ProofGate configuration the swap instruction accepts.
    /// The initializer is a program constant, so a user cannot publish a
    /// lookalike config and pass it as the authority.
    pub fn initialize_proofgate_config(
        ctx: Context<InitializeProofGateConfig>,
        policy_signer: Pubkey,
        deployment_id: [u8; 32],
    ) -> Result<()> {
        require_keys_eq!(ctx.accounts.initializer.key(), CONFIG_INITIALIZER, LabError::Unauthorized);
        require_keys_neq!(policy_signer, CONFIG_INITIALIZER, LabError::Unauthorized);
        require!(deployment_id != [0u8; 32], LabError::InvalidDeployment);
        let config = &mut ctx.accounts.config;
        config.admin_authority = ctx.accounts.initializer.key();
        config.policy_signer = policy_signer;
        config.policy_version = 1;
        config.authorization_epoch = 1;
        config.deployment_id = deployment_id;
        config.paused = false;
        config.bump = ctx.bumps.config;
        Ok(())
    }

    /// Emergency stop. Does not change policy version or authorization epoch,
    /// so a later resume still rejects signatures from an older epoch.
    pub fn set_proofgate_paused(ctx: Context<GovernProofGate>, paused: bool) -> Result<()> {
        ctx.accounts.config.paused = paused;
        Ok(())
    }

    /// Material policy change. The new version must be greater, and the epoch
    /// advances so authorizations signed under the previous policy no longer match.
    pub fn set_policy_version(ctx: Context<GovernProofGate>, policy_version: u64) -> Result<()> {
        let (version, epoch) = monotonic_policy_update(
            ctx.accounts.config.policy_version,
            ctx.accounts.config.authorization_epoch,
            policy_version,
        )?;
        ctx.accounts.config.policy_version = version;
        ctx.accounts.config.authorization_epoch = epoch;
        Ok(())
    }

    /// Invalidates every authorization that carries the previous epoch.
    /// Key rotation also advances the epoch so an old signer cannot remain valid.
    pub fn rotate_policy_signer(ctx: Context<GovernProofGate>, policy_signer: Pubkey) -> Result<()> {
        require_keys_neq!(policy_signer, ctx.accounts.config.admin_authority, LabError::Unauthorized);
        require_keys_neq!(policy_signer, ctx.accounts.config.policy_signer, LabError::Unauthorized);
        ctx.accounts.config.policy_signer = policy_signer;
        ctx.accounts.config.authorization_epoch = ctx.accounts.config.authorization_epoch
            .checked_add(1)
            .ok_or(LabError::ArithmeticOverflow)?;
        Ok(())
    }

    pub fn advance_authorization_epoch(ctx: Context<GovernProofGate>) -> Result<()> {
        ctx.accounts.config.authorization_epoch = ctx.accounts.config.authorization_epoch
            .checked_add(1)
            .ok_or(LabError::ArithmeticOverflow)?;
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
            CpiContext::new_with_signer(ctx.accounts.token_program.key(), cpi, signer_seeds),
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
            CpiContext::new_with_signer(ctx.accounts.token_program.key(), cpi, signer_seeds),
            amount, ctx.accounts.input_mint.decimals
        )?;
        Ok(())
    }
}

pub const EXECUTION_DIGEST_DOMAIN: &[u8] = b"proofgate-settlement-lab/execution-v1";

/// Values the swap instruction has already decided to execute.
/// The digest covers these bytes. It does not cover a ProofGate decision.
#[derive(Clone, Copy)]
pub struct ExecutionParameters {
    pub program_id: Pubkey,
    pub owner: Pubkey,
    pub pool: Pubkey,
    pub mandate: Pubkey,
    pub input_mint: Pubkey,
    pub output_mint: Pubkey,
    pub amount_in: u64,
    pub amount_out: u64,
    pub minimum_out: u64,
    pub nonce: u64,
    pub deadline: i64,
    pub rate_numerator: u64,
    pub rate_denominator: u64,
}

pub fn execution_digest(parameters: &ExecutionParameters) -> [u8; 32] {
    let amount_in = parameters.amount_in.to_le_bytes();
    let amount_out = parameters.amount_out.to_le_bytes();
    let minimum_out = parameters.minimum_out.to_le_bytes();
    let nonce = parameters.nonce.to_le_bytes();
    let deadline = parameters.deadline.to_le_bytes();
    let rate_numerator = parameters.rate_numerator.to_le_bytes();
    let rate_denominator = parameters.rate_denominator.to_le_bytes();
    solana_sha256_hasher::hashv(&[
        EXECUTION_DIGEST_DOMAIN,
        parameters.program_id.as_ref(),
        parameters.owner.as_ref(),
        parameters.pool.as_ref(),
        parameters.mandate.as_ref(),
        parameters.input_mint.as_ref(),
        parameters.output_mint.as_ref(),
        &amount_in,
        &amount_out,
        &minimum_out,
        &nonce,
        &deadline,
        &rate_numerator,
        &rate_denominator,
    ])
    .to_bytes()
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
    pub authorization_digest: [u8; 32],
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct ProofGateConfig {
    pub admin_authority: Pubkey,
    pub policy_signer: Pubkey,
    pub policy_version: u64,
    pub authorization_epoch: u64,
    pub deployment_id: [u8; 32],
    pub paused: bool,
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
    pub pool: Box<Account<'info, Pool>>,
    #[account(
        mut,
        seeds = [b"mandate", owner.key().as_ref(), pool.key().as_ref()],
        bump = mandate.bump,
        has_one = owner @ LabError::Unauthorized,
        constraint = mandate.pool == pool.key() @ LabError::Unauthorized,
    )]
    pub mandate: Box<Account<'info, Mandate>>,
    #[account(
        mut,
        seeds = [b"portfolio", owner.key().as_ref(), pool.input_mint.as_ref()],
        bump = portfolio.bump,
        has_one = owner @ LabError::Unauthorized,
        constraint = portfolio.input_mint == pool.input_mint @ LabError::MintMismatch,
    )]
    pub portfolio: Box<Account<'info, Portfolio>>,
    #[account(address = pool.input_mint @ LabError::MintMismatch)]
    pub input_mint: Box<Account<'info, Mint>>,
    #[account(address = pool.output_mint @ LabError::MintMismatch)]
    pub output_mint: Box<Account<'info, Mint>>,
    #[account(mut, token::mint = input_mint, token::authority = owner)]
    pub owner_input: Box<Account<'info, TokenAccount>>,
    #[account(mut, token::mint = output_mint, token::authority = owner)]
    pub owner_output: Box<Account<'info, TokenAccount>>,
    #[account(mut, associated_token::mint = input_mint, associated_token::authority = pool)]
    pub pool_input_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut, associated_token::mint = output_mint, associated_token::authority = pool)]
    pub pool_output_vault: Box<Account<'info, TokenAccount>>,
    #[account(
        init, payer = owner, space = 8 + SwapReceipt::INIT_SPACE,
        seeds = [b"receipt", mandate.key().as_ref(), &nonce.to_le_bytes()],
        bump
    )]
    pub receipt: Box<Account<'info, SwapReceipt>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    #[account(seeds = [b"proofgate-config"], bump = proofgate_config.bump)]
    pub proofgate_config: Box<Account<'info, ProofGateConfig>>,
    /// CHECK: Address is the instructions sysvar. The previous instruction must
    /// be the canonical Ed25519 verification of the reconstructed authorization.
    #[account(address = solana_instructions_sysvar::ID)]
    pub instruction_sysvar: UncheckedAccount<'info>,
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

#[derive(Accounts)]
pub struct InitializeProofGateConfig<'info> {
    #[account(mut)]
    pub initializer: Signer<'info>,
    #[account(
        init, payer = initializer, space = 8 + ProofGateConfig::INIT_SPACE,
        seeds = [b"proofgate-config"], bump
    )]
    pub config: Account<'info, ProofGateConfig>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct GovernProofGate<'info> {
    pub admin_authority: Signer<'info>,
    #[account(
        mut,
        seeds = [b"proofgate-config"],
        bump = config.bump,
        has_one = admin_authority @ LabError::Unauthorized
    )]
    pub config: Account<'info, ProofGateConfig>,
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
    #[msg("Client digest does not match the parameters this instruction will execute")]
    DigestMismatch,
    #[msg("ProofGate authorization is missing")]
    MissingProofGateAuthorization,
    #[msg("Ed25519 instruction is not bound to this authorization")]
    MalformedEd25519,
    #[msg("ProofGate signer is not the configured policy authority")]
    UnknownPolicySigner,
    #[msg("Signed authorization does not match the operation being executed")]
    AuthorizationMismatch,
    #[msg("ProofGate authorization is outside its validity window")]
    AuthorizationExpired,
    #[msg("ProofGate configuration is halted")]
    GovernanceHalted,
    #[msg("Deployment identity is missing")]
    InvalidDeployment,
    #[msg("Policy version must increase")]
    PolicyRegression,
}

#[cfg(test)]
mod tests {
    use super::*;
    use anchor_lang::prelude::Pubkey;
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
    #[test]
    fn execution_digest_binds_the_executed_amount() {
        let mut parameters = ExecutionParameters {
            program_id: crate::ID,
            owner: Pubkey::new_from_array([0; 32]),
            pool: Pubkey::new_from_array([1; 32]),
            mandate: Pubkey::new_from_array([2; 32]),
            input_mint: Pubkey::new_from_array([3; 32]),
            output_mint: Pubkey::new_from_array([4; 32]),
            amount_in: 1_000,
            amount_out: 1_000,
            minimum_out: 900,
            nonce: 7,
            deadline: 1_700_000_000,
            rate_numerator: 1,
            rate_denominator: 1,
        };
        let original = execution_digest(&parameters);
        parameters.amount_in = 1_001;
        assert_ne!(original, execution_digest(&parameters));
        parameters.amount_in = 1_000;
        assert_eq!(original, execution_digest(&parameters));
    }

    #[test]
    fn execution_digest_binds_every_executed_field() {
        let base = ExecutionParameters {
            program_id: crate::ID,
            owner: Pubkey::new_from_array([0; 32]),
            pool: Pubkey::new_from_array([1; 32]),
            mandate: Pubkey::new_from_array([2; 32]),
            input_mint: Pubkey::new_from_array([3; 32]),
            output_mint: Pubkey::new_from_array([4; 32]),
            amount_in: 1_000,
            amount_out: 1_000,
            minimum_out: 900,
            nonce: 7,
            deadline: 1_700_000_000,
            rate_numerator: 1,
            rate_denominator: 1,
        };
        let original = execution_digest(&base);
        let variants = [
            ExecutionParameters { program_id: Pubkey::new_from_array([9; 32]), ..base },
            ExecutionParameters { owner: Pubkey::new_from_array([8; 32]), ..base },
            ExecutionParameters { pool: Pubkey::new_from_array([7; 32]), ..base },
            ExecutionParameters { mandate: Pubkey::new_from_array([6; 32]), ..base },
            ExecutionParameters { input_mint: Pubkey::new_from_array([5; 32]), ..base },
            ExecutionParameters { output_mint: Pubkey::new_from_array([11; 32]), ..base },
            ExecutionParameters { amount_in: 1_001, ..base },
            ExecutionParameters { amount_out: 1_001, ..base },
            ExecutionParameters { minimum_out: 901, ..base },
            ExecutionParameters { nonce: 8, ..base },
            ExecutionParameters { deadline: base.deadline + 1, ..base },
            ExecutionParameters { rate_numerator: 2, ..base },
            ExecutionParameters { rate_denominator: 2, ..base },
        ];
        for variant in variants {
            assert_ne!(original, execution_digest(&variant));
        }
    }

    #[test]
    fn authorization_message_matches_the_javascript_vector() {
        use crate::authorization::{authorization_digest, authorization_message, ProofGateAuthorizationV1, AUTHORIZATION_MESSAGE_LEN};
        let base = ProofGateAuthorizationV1 {
            program_id: Pubkey::new_from_array([1; 32]),
            deployment_id: [21; 32],
            proofgate_config: Pubkey::new_from_array([2; 32]),
            policy_signer: Pubkey::new_from_array([3; 32]),
            policy_version: 1,
            authorization_epoch: 1,
            owner: Pubkey::new_from_array([4; 32]),
            mandate: Pubkey::new_from_array([5; 32]),
            pool: Pubkey::new_from_array([6; 32]),
            input_mint: Pubkey::new_from_array([7; 32]),
            output_mint: Pubkey::new_from_array([8; 32]),
            token_program: Pubkey::new_from_array([9; 32]),
            amount_in: 1000,
            minimum_amount_out: 900,
            quoted_rate_numerator: 1,
            quoted_rate_denominator: 1,
            evidence_digest: [10; 32],
            proposal_digest: [11; 32],
            execution_digest: [12; 32],
            nonce: 7,
            issued_at: 1_700_000_000,
            expires_at: 1_700_000_120,
        };
        let message = authorization_message(&base);
        assert_eq!(message.len(), AUTHORIZATION_MESSAGE_LEN);
        assert_eq!(AUTHORIZATION_MESSAGE_LEN, 530);
        let digest = authorization_digest(&message);
        let mut changed = base;
        changed.amount_in = 1001;
        assert_ne!(digest, authorization_digest(&authorization_message(&changed)));
        changed = base;
        changed.program_id = Pubkey::new_from_array([13; 32]);
        assert_ne!(digest, authorization_digest(&authorization_message(&changed)));
        changed = base;
        changed.deployment_id = [22; 32];
        assert_ne!(digest, authorization_digest(&authorization_message(&changed)));
        changed = base;
        changed.evidence_digest = [14; 32];
        assert_ne!(digest, authorization_digest(&authorization_message(&changed)));
        changed = base;
        changed.proposal_digest = [15; 32];
        assert_ne!(digest, authorization_digest(&authorization_message(&changed)));
        changed = base;
        changed.nonce = 8;
        assert_ne!(digest, authorization_digest(&authorization_message(&changed)));
        let hex: String = digest.iter().map(|byte| format!("{byte:02x}")).collect();
        assert_eq!(hex, "79f797722d8826bb42c40785417d33c6d3e58867e3ca6caddded9d3b8d0b31f3");
    }

    #[test]
    fn policy_version_cannot_move_backwards_and_burns_the_epoch() {
        use crate::authorization::monotonic_policy_update;
        let (version, epoch) = monotonic_policy_update(1, 4, 2).unwrap();
        assert_eq!((version, epoch), (2, 5));
        assert!(monotonic_policy_update(2, 5, 2).is_err());
        assert!(monotonic_policy_update(2, 5, 1).is_err());
        assert!(monotonic_policy_update(u64::MAX, 1, u64::MAX).is_err());
        assert!(monotonic_policy_update(1, u64::MAX, 2).is_err());
    }
}
