//! Token-2022 Transfer Hook interface so an RWA mint can call this program
//! on every transfer. The hook cannot move tokens (Token-2022 passes accounts
//! read-only); retention still happens in `metabolize_yield`. The hook exists
//! so a mint can require this program on the transfer path.

use anchor_lang::prelude::*;
use anchor_spl::token_2022::{
    spl_token_2022::{
        extension::{
            transfer_hook::TransferHookAccount, BaseStateWithExtensions, StateWithExtensions,
        },
        state::Account as Token2022Account,
    },
    ID as TOKEN_2022_PROGRAM_ID,
};
use anchor_spl::token_interface::{Mint, TokenAccount};
use spl_tlv_account_resolution::state::ExtraAccountMetaList;
use spl_transfer_hook_interface::{error::TransferHookError, instruction::ExecuteInstruction};

use crate::constants::EXTRA_ACCOUNT_METAS_SEED;

#[derive(Accounts)]
pub struct InitializeExtraAccountMetaList<'info> {
    /// CHECK: TLV buffer of extra account metas for Token-2022 resolution.
    #[account(
        init,
        payer = payer,
        space = ExtraAccountMetaList::size_of(0).unwrap(),
        seeds = [EXTRA_ACCOUNT_METAS_SEED, mint.key().as_ref()],
        bump
    )]
    pub extra_metas_account: UncheckedAccount<'info>,
    #[account(mint::token_program = TOKEN_2022_PROGRAM_ID)]
    pub mint: InterfaceAccount<'info, Mint>,
    pub mint_authority: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ExecuteTransferHook<'info> {
    #[account(
        token::mint = mint,
        token::authority = owner_delegate,
        token::token_program = TOKEN_2022_PROGRAM_ID
    )]
    pub source_account: InterfaceAccount<'info, TokenAccount>,
    #[account(mint::token_program = TOKEN_2022_PROGRAM_ID)]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        token::mint = mint,
        token::token_program = TOKEN_2022_PROGRAM_ID
    )]
    pub destination_account: InterfaceAccount<'info, TokenAccount>,
    /// CHECK: Token-2022 owner/delegate on the source account.
    pub owner_delegate: UncheckedAccount<'info>,
    /// CHECK: TLV extra-account-metas PDA.
    #[account(
        seeds = [EXTRA_ACCOUNT_METAS_SEED, mint.key().as_ref()],
        bump
    )]
    pub extra_metas_account: UncheckedAccount<'info>,
}

pub fn handle_initialize_extra_account_meta_list(
    ctx: Context<InitializeExtraAccountMetaList>,
) -> Result<()> {
    let mint = &ctx.accounts.mint;
    let mint_authority = mint.mint_authority.ok_or(Into::<ProgramError>::into(
        TransferHookError::MintHasNoMintAuthority,
    ))?;
    if ctx.accounts.mint_authority.key() != mint_authority {
        Err(Into::<ProgramError>::into(
            TransferHookError::IncorrectMintAuthority,
        ))?;
    }

    let mut data = ctx.accounts.extra_metas_account.try_borrow_mut_data()?;
    ExtraAccountMetaList::init::<ExecuteInstruction>(&mut data, &[])?;
    Ok(())
}

pub fn handle_execute_transfer_hook(ctx: Context<ExecuteTransferHook>, _amount: u64) -> Result<()> {
    check_token_account_is_transferring(
        &ctx.accounts
            .source_account
            .to_account_info()
            .try_borrow_data()?,
    )?;
    check_token_account_is_transferring(
        &ctx.accounts
            .destination_account
            .to_account_info()
            .try_borrow_data()?,
    )?;
    Ok(())
}

fn check_token_account_is_transferring(account_data: &[u8]) -> Result<()> {
    let token_account = StateWithExtensions::<Token2022Account>::unpack(account_data)?;
    let extension = token_account.get_extension::<TransferHookAccount>()?;
    if bool::from(extension.transferring) {
        Ok(())
    } else {
        Err(Into::<ProgramError>::into(
            TransferHookError::ProgramCalledOutsideOfTransfer,
        ))?
    }
}
