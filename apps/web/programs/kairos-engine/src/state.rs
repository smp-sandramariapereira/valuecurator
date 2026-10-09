use anchor_lang::prelude::*;

/// On-chain state for one Autonomous Capital Node.
#[account]
#[derive(InitSpace)]
pub struct NodeAccount {
    /// Governance authority. Can rotate the operator and recover vault funds.
    pub owner: Pubkey,
    /// Limited hot key allowed to process yield and allocate it to the strategy.
    pub operator: Pubkey,
    /// Infrastructure retention in basis points. Default 1500 = 15%.
    pub infrastructure_fee_bps: u16,
    /// Cumulative amount processed by `metabolize_yield`.
    pub total_metabolized: u64,
    /// Destination owner for the infrastructure slice.
    pub treasury_pubkey: Pubkey,
    /// Allowlisted output mint acquired by the executable strategy.
    pub strategy_mint: Pubkey,
    /// Canonical PDA bump.
    pub bump: u8,
    /// Reserved for later fields without a layout break.
    pub _reserved: [u8; 32],
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
