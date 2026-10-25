use anchor_lang::prelude::*;

/// On-chain state for one Autonomous Capital Node with Tri-Tier Administrative Fee Accounting.
#[account]
#[derive(InitSpace)]
pub struct NodeAccount {
    /// Governance authority. Can rotate the operator and recover vault funds.
    pub owner: Pubkey,
    /// Limited hot key allowed to process yield and allocate it to the strategy.
    pub operator: Pubkey,
    /// Tier 3 — Performance / yield metabolism retention in basis points. Default 1500 = 15%.
    pub infrastructure_fee_bps: u16,
    /// Cumulative yield amount processed by `metabolize_yield`.
    pub total_metabolized: u64,
    /// Destination owner for all three administrative fee tiers (Deposit, Periodic, Performance).
    pub treasury_pubkey: Pubkey,
    /// Allowlisted output mint acquired by the executable strategy.
    pub strategy_mint: Pubkey,
    /// Canonical PDA bump.
    pub bump: u8,
    /// Tier 1 — Deposit / entry fee in basis points charged on capital deposits. Default 50 = 0.50%.
    pub deposit_fee_bps: u16,
    /// Tier 2 — Periodic flat maintenance fee per 30-day epoch in token base units. Default 1_000_000 (1 USDC).
    pub periodic_fee_amount: u64,
    /// Unix timestamp of the last settled periodic maintenance epoch.
    pub last_periodic_fee_ts: i64,
    /// Cumulative administrative fees (Deposit + Periodic + Performance) routed to `treasury_pubkey`.
    pub total_admin_fees_collected: u64,
    /// Remaining reserved bytes (preserves exact 32-byte tail layout).
    pub _reserved: [u8; 6],
}

impl NodeAccount {
    pub fn assert_owner(&self, signer: &Pubkey) -> Result<()> {
        require_keys_eq!(self.owner, *signer, crate::error::KairosError::Unauthorized);
        Ok(())
    }

    pub fn assert_operator(&self, signer: &Pubkey) -> Result<()> {
        require_keys_eq!(
            self.operator,
            *signer,
            crate::error::KairosError::UnauthorizedOperator
        );
        Ok(())
    }
}

/// Owner-posted reference for the Devnet swap check.
///
/// The live AAPLx Pyth feed stays on mainnet. This account lives on the same
/// cluster as the program, and only the node owner can write it.
#[account]
#[derive(InitSpace)]
pub struct ReferencePrice {
    pub node: Pubkey,
    /// Strategy mint this price describes.
    pub mint: Pubkey,
    /// USD price of one whole output token, in micros.
    pub reference_price: u64,
    /// xStocks multiplier in nano units. `1_000_000_000` means 1.0.
    pub multiplier_nano: u64,
    pub maximum_deviation_bps: u16,
    pub bump: u8,
}
