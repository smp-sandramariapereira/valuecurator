use anchor_lang::prelude::*;

#[event]
pub struct MetabolicEvent {
    pub node: Pubkey,
    pub operator: Pubkey,
    pub vaulted: u64,
    pub infrastructure_funded: u64,
    pub timestamp: i64,
}

#[event]
pub struct StrategyAllocationEvent {
    pub node: Pubkey,
    pub operator: Pubkey,
    pub strategy_authority: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct EmergencyWithdrawalEvent {
    pub node: Pubkey,
    pub owner: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct OperatorUpdatedEvent {
    pub node: Pubkey,
    pub owner: Pubkey,
    pub previous_operator: Pubkey,
    pub new_operator: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct StrategySwapEvent {
    pub node: Pubkey,
    pub operator: Pubkey,
    pub input_mint: Pubkey,
    pub output_mint: Pubkey,
    pub amount_in: u64,
    pub amount_out: u64,
    pub minimum_amount_out: u64,
    pub timestamp: i64,
}

#[event]
pub struct ResearchAssetMintedEvent {
    pub node: Pubkey,
    pub owner: Pubkey,
    pub operator: Pubkey,
    pub artifact_mint: Pubkey,
    pub recipient_ata: Pubkey,
    pub eidos_id: String,
    pub manifest_sha256: [u8; 32],
    pub amount: u64,
    pub royalty_bps: u16,
    pub timestamp: i64,
}

