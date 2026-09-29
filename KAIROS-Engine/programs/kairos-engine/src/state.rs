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
