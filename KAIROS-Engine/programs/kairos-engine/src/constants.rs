use anchor_lang::prelude::*;

/// PDA seed for `NodeAccount`. Seeds: `[NODE_SEED, owner]`.
#[constant]
pub const NODE_SEED: &[u8] = b"node";

/// PDA seed for Token-2022 ExtraAccountMetaList. Seeds: `[EXTRA_ACCOUNT_METAS_SEED, mint]`.
#[constant]
pub const EXTRA_ACCOUNT_METAS_SEED: &[u8] = b"extra-account-metas";

/// Default infrastructure retention: 1500 bps = 15%.
#[constant]
pub const DEFAULT_INFRASTRUCTURE_FEE_BPS: u16 = 1500;

/// Basis-point denominator (100% = 10_000).
#[constant]
pub const BPS_DENOMINATOR: u64 = 10_000;
