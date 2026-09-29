pub mod constants;
pub mod error;
pub mod events;
pub mod instructions;
pub mod math;
pub mod state;

use anchor_lang::prelude::*;
use spl_discriminator::SplDiscriminate;
use spl_transfer_hook_interface::instruction::{
    ExecuteInstruction, InitializeExtraAccountMetaListInstruction,
};

pub use constants::*;
pub use error::*;
pub use events::*;
pub use instructions::*;
pub use math::*;
pub use state::*;

declare_id!("6owAcXj4FxJom96cEX9CSFjGrg6zp4U8atTjrpCUMiW5");

#[program]
pub mod kairos_engine {
    use super::*;

    pub fn initialize_node(
        ctx: Context<InitializeNode>,
        infrastructure_fee_bps: u16,
        treasury_pubkey: Pubkey,
        operator: Pubkey,
        strategy_mint: Pubkey,
    ) -> Result<()> {
        instructions::initialize_node::handle_initialize_node(
            ctx,
            infrastructure_fee_bps,
            treasury_pubkey,
            operator,
            strategy_mint,
        )
    }

    /// Pull yield from the limited operator account and split it between
    /// infrastructure and the node PDA vault.
    pub fn metabolize_yield<'a>(ctx: Context<'a, MetabolizeYield<'a>>, amount: u64) -> Result<()> {
        instructions::metabolize_yield::handle_metabolize_yield(ctx, amount)
    }

    /// Execute an exact-input Jupiter swap from the recoverable vault into
    /// the node's allowlisted target mint, enforcing output on-chain.
    pub fn execute_strategy_swap<'a>(
        ctx: Context<'a, ExecuteStrategySwap<'a>>,
        instruction_data: Vec<u8>,
        amount_in: u64,
        minimum_amount_out: u64,
    ) -> Result<()> {
        instructions::execute_strategy_swap::handle_execute_strategy_swap(
            ctx,
            instruction_data,
            amount_in,
            minimum_amount_out,
        )
    }

    /// Owner-only escape hatch for recovering vaulted funds.
    pub fn emergency_withdraw<'a>(
        ctx: Context<'a, EmergencyWithdraw<'a>>,
        amount: u64,
    ) -> Result<()> {
        instructions::emergency_withdraw::handle_emergency_withdraw(ctx, amount)
    }

    /// Owner-only rotation of the limited hot operator.
    pub fn update_operator(ctx: Context<UpdateOperator>, new_operator: Pubkey) -> Result<()> {
        instructions::update_operator::handle_update_operator(ctx, new_operator)
    }

    #[instruction(discriminator = InitializeExtraAccountMetaListInstruction::SPL_DISCRIMINATOR_SLICE)]
    pub fn initialize_extra_account_meta_list(
        ctx: Context<InitializeExtraAccountMetaList>,
    ) -> Result<()> {
        instructions::transfer_hook::handle_initialize_extra_account_meta_list(ctx)
    }

    #[instruction(discriminator = ExecuteInstruction::SPL_DISCRIMINATOR_SLICE)]
    pub fn execute_transfer_hook(ctx: Context<ExecuteTransferHook>, amount: u64) -> Result<()> {
        instructions::transfer_hook::handle_execute_transfer_hook(ctx, amount)
    }
}
