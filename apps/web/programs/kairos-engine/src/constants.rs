use anchor_lang::prelude::*;

/// PDA seed for `NodeAccount`. Seeds: `[NODE_SEED, owner]`.
#[constant]
pub const NODE_SEED: &[u8] = b"node";

/// PDA seed for the Devnet reference price. Seeds: `[REFERENCE_PRICE_SEED, node]`.
#[constant]
pub const REFERENCE_PRICE_SEED: &[u8] = b"reference-price";

/// PDA seed for Token-2022 ExtraAccountMetaList. Seeds: `[EXTRA_ACCOUNT_METAS_SEED, mint]`.
#[constant]
pub const EXTRA_ACCOUNT_METAS_SEED: &[u8] = b"extra-account-metas";

/// Default performance / infrastructure retention on positive yield: 1500 bps = 15%.
#[constant]
pub const DEFAULT_INFRASTRUCTURE_FEE_BPS: u16 = 1500;

/// Default deposit / entry fee on capital inflows: 50 bps = 0.50%.
#[constant]
pub const DEFAULT_DEPOSIT_FEE_BPS: u16 = 50;

/// Default periodic node maintenance fee per 30-day epoch: 1_000_000 micro-USDC = 1.00 USDC.
#[constant]
pub const DEFAULT_PERIODIC_FEE_AMOUNT: u64 = 1_000_000;

/// Standard 30-day epoch duration in seconds for periodic fee collection.
#[constant]
pub const PERIODIC_FEE_EPOCH_SECONDS: i64 = 2_592_000;

/// Basis-point denominator (100% = 10_000).
#[constant]
pub const BPS_DENOMINATOR: u64 = 10_000;
