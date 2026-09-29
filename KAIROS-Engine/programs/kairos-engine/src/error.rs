use anchor_lang::prelude::*;

#[error_code]
pub enum KairosError {
    #[msg("Only the node owner can perform this instruction")]
    Unauthorized,
    #[msg("Only the configured node operator can perform this instruction")]
    UnauthorizedOperator,
    #[msg("infrastructure_fee_bps cannot exceed 10000")]
    InvalidFee,
    #[msg("Yield amount must be greater than zero")]
    ZeroAmount,
    #[msg("Arithmetic overflow while processing yield")]
    MathOverflow,
    #[msg("Treasury token account owner must match node.treasury_pubkey")]
    InvalidTreasuryAccount,
    #[msg("Strategy token account owner must match node.strategy_authority")]
    InvalidStrategyAccount,
    #[msg("Token program must be SPL Token-2022")]
    InvalidTokenProgram,
    #[msg("Operator cannot be the default public key")]
    InvalidOperator,
    #[msg("Strategy authority cannot be the default public key")]
    InvalidStrategyAuthority,
    #[msg("Strategy output mint does not match the node allowlist")]
    InvalidStrategyMint,
    #[msg("minimum_amount_out must be greater than zero")]
    InvalidMinimumOutput,
    #[msg("Vault balance is lower than the requested strategy input")]
    InsufficientVaultBalance,
    #[msg("Strategy swap produced an invalid balance transition")]
    InvalidSwapBalance,
    #[msg("Strategy swap did not consume the exact approved input")]
    InvalidSwapInput,
    #[msg("Strategy swap output was below minimum_amount_out")]
    SlippageExceeded,
}
