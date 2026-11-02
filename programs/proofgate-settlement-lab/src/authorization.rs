//! Canonical ProofGate authorization and Ed25519 instruction binding.
//!
//! The signed bytes are the authorization. The Ed25519 precompile proves
//! that `policy_signer` signed those bytes. This module checks that the
//! previous instruction is that precompile and that its message is exactly
//! the authorization reconstructed from the swap that is about to execute.
//! A boolean supplied by the client is never consulted.

use anchor_lang::prelude::*;
use solana_instructions_sysvar::{load_current_index_checked, load_instruction_at_checked};

pub const AUTHORIZATION_DOMAIN: &[u8] = b"proofgate-settlement-lab/authorization-v1";
pub const AUTHORIZATION_SCHEMA_VERSION: u8 = 1;
pub const AUTHORIZATION_MESSAGE_LEN: usize = AUTHORIZATION_DOMAIN.len()
    + 1
    + 32 * 10
    + 8 * 7
    + 32 * 3
    + 8 * 2;

/// Only this key may create the singleton `["proofgate-config"]` account.
/// The secret stays in `programs/.local-keys/` and is not a policy signer.
pub const CONFIG_INITIALIZER: Pubkey = pubkey!("BMa9qun9QuCceSgozPtPNwQarro5CvQ63Twv3jDWcY8a");

pub const ED25519_PROGRAM_ID: Pubkey = pubkey!("Ed25519SigVerify111111111111111111111111111");

const CURRENT_INSTRUCTION: u16 = u16::MAX;
const ED25519_HEADER_LEN: usize = 16;
const SIGNATURE_LEN: usize = 64;
const PUBKEY_LEN: usize = 32;

#[derive(Clone, Copy)]
pub struct ProofGateAuthorizationV1 {
    pub program_id: Pubkey,
    pub deployment_id: [u8; 32],
    pub proofgate_config: Pubkey,
    pub policy_signer: Pubkey,
    pub policy_version: u64,
    pub authorization_epoch: u64,
    pub owner: Pubkey,
    pub mandate: Pubkey,
    pub pool: Pubkey,
    pub input_mint: Pubkey,
    pub output_mint: Pubkey,
    pub token_program: Pubkey,
    pub amount_in: u64,
    pub minimum_amount_out: u64,
    pub quoted_rate_numerator: u64,
    pub quoted_rate_denominator: u64,
    pub evidence_digest: [u8; 32],
    pub proposal_digest: [u8; 32],
    pub execution_digest: [u8; 32],
    pub nonce: u64,
    pub issued_at: i64,
    pub expires_at: i64,
}

pub fn authorization_message(authorization: &ProofGateAuthorizationV1) -> [u8; AUTHORIZATION_MESSAGE_LEN] {
    let mut message = [0u8; AUTHORIZATION_MESSAGE_LEN];
    let mut cursor = 0;
    write_bytes(&mut message, &mut cursor, AUTHORIZATION_DOMAIN);
    write_bytes(&mut message, &mut cursor, &[AUTHORIZATION_SCHEMA_VERSION]);
    write_bytes(&mut message, &mut cursor, authorization.program_id.as_ref());
    write_bytes(&mut message, &mut cursor, &authorization.deployment_id);
    write_bytes(&mut message, &mut cursor, authorization.proofgate_config.as_ref());
    write_bytes(&mut message, &mut cursor, authorization.policy_signer.as_ref());
    write_bytes(&mut message, &mut cursor, &authorization.policy_version.to_le_bytes());
    write_bytes(&mut message, &mut cursor, &authorization.authorization_epoch.to_le_bytes());
    write_bytes(&mut message, &mut cursor, authorization.owner.as_ref());
    write_bytes(&mut message, &mut cursor, authorization.mandate.as_ref());
    write_bytes(&mut message, &mut cursor, authorization.pool.as_ref());
    write_bytes(&mut message, &mut cursor, authorization.input_mint.as_ref());
    write_bytes(&mut message, &mut cursor, authorization.output_mint.as_ref());
    write_bytes(&mut message, &mut cursor, authorization.token_program.as_ref());
    write_bytes(&mut message, &mut cursor, &authorization.amount_in.to_le_bytes());
    write_bytes(&mut message, &mut cursor, &authorization.minimum_amount_out.to_le_bytes());
    write_bytes(&mut message, &mut cursor, &authorization.quoted_rate_numerator.to_le_bytes());
    write_bytes(&mut message, &mut cursor, &authorization.quoted_rate_denominator.to_le_bytes());
    write_bytes(&mut message, &mut cursor, &authorization.evidence_digest);
    write_bytes(&mut message, &mut cursor, &authorization.proposal_digest);
    write_bytes(&mut message, &mut cursor, &authorization.execution_digest);
    write_bytes(&mut message, &mut cursor, &authorization.nonce.to_le_bytes());
    write_bytes(&mut message, &mut cursor, &authorization.issued_at.to_le_bytes());
    write_bytes(&mut message, &mut cursor, &authorization.expires_at.to_le_bytes());
    message
}

fn write_bytes(destination: &mut [u8], cursor: &mut usize, bytes: &[u8]) {
    let end = *cursor + bytes.len();
    destination[*cursor..end].copy_from_slice(bytes);
    *cursor = end;
}

/// Confirms the immediately previous instruction is one Ed25519 verification
/// of `message` by `policy_signer`. `message` is the 32-byte SHA-256 of the
/// canonical authorization. The raw authorization is 530 bytes and does not
/// fit in the same transaction as the swap accounts.
#[inline(never)]
pub fn bind_proofgate_authorization(
    instruction_sysvar: &AccountInfo,
    policy_signer: &Pubkey,
    message: &[u8],
) -> Result<()> {
    let current = load_current_index_checked(instruction_sysvar)?;
    require!(current > 0, crate::LabError::MissingProofGateAuthorization);
    let instruction = load_instruction_at_checked((current - 1) as usize, instruction_sysvar)?;
    require!(
        instruction.program_id == ED25519_PROGRAM_ID,
        crate::LabError::MissingProofGateAuthorization
    );
    require!(instruction.accounts.is_empty(), crate::LabError::MalformedEd25519);
    let data = instruction.data.as_slice();
    require!(
        data.len() >= ED25519_HEADER_LEN && data[0] == 1 && data[1] == 0,
        crate::LabError::MalformedEd25519
    );
    let signature_offset = read_u16(data, 2);
    let signature_index = read_u16(data, 4);
    let pubkey_offset = read_u16(data, 6);
    let pubkey_index = read_u16(data, 8);
    let message_offset = read_u16(data, 10);
    let message_size = read_u16(data, 12);
    let message_index = read_u16(data, 14);
    require!(
        signature_index == CURRENT_INSTRUCTION
            && pubkey_index == CURRENT_INSTRUCTION
            && message_index == CURRENT_INSTRUCTION,
        crate::LabError::MalformedEd25519
    );
    let signature_end = (signature_offset as usize)
        .checked_add(SIGNATURE_LEN)
        .ok_or(crate::LabError::MalformedEd25519)?;
    let pubkey_end = (pubkey_offset as usize)
        .checked_add(PUBKEY_LEN)
        .ok_or(crate::LabError::MalformedEd25519)?;
    let message_end = (message_offset as usize)
        .checked_add(message_size as usize)
        .ok_or(crate::LabError::MalformedEd25519)?;
    require!(
        signature_end <= data.len() && pubkey_end <= data.len() && message_end <= data.len(),
        crate::LabError::MalformedEd25519
    );
    let signed_key = &data[pubkey_offset as usize..pubkey_end];
    let signed_message = &data[message_offset as usize..message_end];
    require!(signed_key == policy_signer.as_ref(), crate::LabError::UnknownPolicySigner);
    require!(
        message_size as usize == message.len() && signed_message == message,
        crate::LabError::AuthorizationMismatch
    );
    Ok(())
}

fn read_u16(data: &[u8], offset: usize) -> u16 {
    u16::from_le_bytes([data[offset], data[offset + 1]])
}

pub fn authorization_digest(message: &[u8]) -> [u8; 32] {
    solana_sha256_hasher::hashv(&[message]).to_bytes()
}

/// Ordinary policy updates are strictly increasing and burn the current epoch.
/// Pause and resume do not call this function, so they do not invalidate
/// authorizations that still match the current version and epoch.
pub fn monotonic_policy_update(current_version: u64, current_epoch: u64, requested_version: u64) -> Result<(u64, u64)> {
    require!(requested_version > current_version, crate::LabError::PolicyRegression);
    let epoch = current_epoch.checked_add(1).ok_or(crate::LabError::ArithmeticOverflow)?;
    Ok((requested_version, epoch))
}
