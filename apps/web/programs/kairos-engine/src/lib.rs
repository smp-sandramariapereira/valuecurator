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

    /// Tier 1 Administrative Fee: Deposit collateral into the Node PDA Vault,
    /// routing `deposit_fee_bps` to the Protocol Treasury and crediting the net
    /// principal to the sovereign vault.
    pub fn deposit_with_fee<'a>(
        ctx: Context<'a, DepositWithFee<'a>>,
        gross_amount: u64,
    ) -> Result<()> {
        instructions::deposit_with_fee::handle_deposit_with_fee(ctx, gross_amount)
    }

    /// Tier 2 Administrative Fee: Collect elapsed 30-day periodic maintenance fees
    /// (`periodic_fee_amount` per epoch) from the Node PDA Vault to the Treasury.
    pub fn collect_periodic_fee<'a>(ctx: Context<'a, CollectPeriodicFee<'a>>) -> Result<()> {
        instructions::collect_periodic_fee::handle_collect_periodic_fee(ctx)
    }

    /// Tier 3 Administrative Fee: Pull positive strategy yield from the limited
    /// operator account and split it between the Protocol Treasury (`infrastructure_fee_bps`)
    /// and the Node PDA Vault (`10000 - infrastructure_fee_bps`).
    pub fn metabolize_yield<'a>(ctx: Context<'a, MetabolizeYield<'a>>, amount: u64) -> Result<()> {
        instructions::metabolize_yield::handle_metabolize_yield(ctx, amount)
    }

    /// Owner-only update of the Tri-Tier Administrative Fee Schedule.
    pub fn configure_admin_fees(
        ctx: Context<ConfigureAdminFees>,
        deposit_fee_bps: u16,
        periodic_fee_amount: u64,
        infrastructure_fee_bps: u16,
    ) -> Result<()> {
        instructions::configure_admin_fees::handle_configure_admin_fees(
            ctx,
            deposit_fee_bps,
            periodic_fee_amount,
            infrastructure_fee_bps,
        )
    }

    /// Owner posts the Devnet reference price the swap instruction must read.
    pub fn post_reference_price(
        ctx: Context<PostReferencePrice>,
        reference_price: u64,
        maximum_deviation_bps: u16,
        multiplier_nano: u64,
    ) -> Result<()> {
        instructions::post_reference_price::handle_post_reference_price(
            ctx,
            reference_price,
            maximum_deviation_bps,
            multiplier_nano,
        )
    }

    /// Compare a proposed swap with the owner-posted Devnet reference.
    pub fn assert_executable_price(
        ctx: Context<AssertExecutablePrice>,
        amount_in: u64,
        minimum_amount_out: u64,
    ) -> Result<()> {
        instructions::assert_executable_price::handle_assert_executable_price(
            ctx,
            amount_in,
            minimum_amount_out,
        )
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
