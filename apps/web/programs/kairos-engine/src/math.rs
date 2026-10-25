use crate::constants::BPS_DENOMINATOR;
use crate::error::KairosError;
use anchor_lang::prelude::*;

/// Split `amount` into (infrastructure, reinvested) using `fee_bps` / 10_000.
pub fn split_yield(amount: u64, fee_bps: u16) -> Result<(u64, u64)> {
    require!(amount > 0, KairosError::ZeroAmount);
    require!((fee_bps as u64) <= BPS_DENOMINATOR, KairosError::InvalidFee);

    let infrastructure = (amount as u128)
        .checked_mul(fee_bps as u128)
        .ok_or(KairosError::MathOverflow)?
        .checked_div(BPS_DENOMINATOR as u128)
        .ok_or(KairosError::MathOverflow)? as u64;

    let reinvested = amount
        .checked_sub(infrastructure)
        .ok_or(KairosError::MathOverflow)?;

    Ok((infrastructure, reinvested))
}

/// Split a gross deposit `amount` into `(deposit_fee, net_vaulted)` using `deposit_fee_bps` / 10_000.
pub fn split_deposit_fee(amount: u64, deposit_fee_bps: u16) -> Result<(u64, u64)> {
    split_yield(amount, deposit_fee_bps)
}

/// Compute elapsed maintenance epochs and total periodic fee due between `last_ts` and `now_ts`.
/// Returns `(epochs_elapsed, total_fee_due, new_last_ts)`.
/// Strictly fails closed with `PeriodicFeeNotDue` if less than one full epoch has elapsed.
pub fn calculate_periodic_fee_due(
    last_ts: i64,
    now_ts: i64,
    epoch_seconds: i64,
    fee_per_epoch: u64,
) -> Result<(u64, u64, i64)> {
    require!(epoch_seconds > 0, KairosError::InvalidEpochDuration);
    require!(now_ts >= last_ts, KairosError::PeriodicFeeNotDue);

    let elapsed = now_ts
        .checked_sub(last_ts)
        .ok_or(KairosError::MathOverflow)?;
    let epochs = (elapsed / epoch_seconds) as u64;
    require!(epochs > 0, KairosError::PeriodicFeeNotDue);

    let total_fee = epochs
        .checked_mul(fee_per_epoch)
        .ok_or(KairosError::MathOverflow)?;
    let advance_seconds = (epochs as i64)
        .checked_mul(epoch_seconds)
        .ok_or(KairosError::MathOverflow)?;
    let new_last_ts = last_ts
        .checked_add(advance_seconds)
        .ok_or(KairosError::MathOverflow)?;

    Ok((epochs, total_fee, new_last_ts))
}

/// Absolute distance between the executable price and the reference price,
/// in basis points of the reference price. Truncates toward zero, matching
/// `ratioBps` in the off-chain evidence gate.
pub fn price_deviation_bps(reference_price: u64, executable_price: u64) -> Result<u64> {
    require!(reference_price > 0, KairosError::InvalidReferencePrice);
    require!(executable_price > 0, KairosError::InvalidExecutablePrice);

    let distance = (reference_price as u128).abs_diff(executable_price as u128);
    let bps = distance
        .checked_mul(BPS_DENOMINATOR as u128)
        .ok_or(KairosError::MathOverflow)?
        .checked_div(reference_price as u128)
        .ok_or(KairosError::MathOverflow)?;

    u64::try_from(bps).map_err(|_| error!(KairosError::MathOverflow))
}

/// Accept the pair when the deviation is within the mandate. Reject when it exceeds it.
pub fn assert_price_deviation(
    reference_price: u64,
    executable_price: u64,
    maximum_deviation_bps: u16,
) -> Result<()> {
    require!(
        (maximum_deviation_bps as u64) <= BPS_DENOMINATOR,
        KairosError::InvalidDeviationLimit
    );
    let deviation = price_deviation_bps(reference_price, executable_price)?;
    require!(
        deviation <= maximum_deviation_bps as u64,
        KairosError::PriceDeviationExceeded
    );
    Ok(())
}

/// Worst executable USD price, in micros, implied by `minimum_amount_out`.
pub fn implied_executable_price_micros(
    amount_in: u64,
    minimum_amount_out: u64,
    input_decimals: u8,
    output_decimals: u8,
    multiplier_nano: u64,
) -> Result<u64> {
    require!(amount_in > 0, KairosError::ZeroAmount);
    require!(minimum_amount_out > 0, KairosError::InvalidMinimumOutput);
    require!(multiplier_nano > 0, KairosError::InvalidMultiplier);
    require!(
        input_decimals <= 18 && output_decimals <= 18,
        KairosError::InvalidTokenDecimals
    );

    let numerator = (amount_in as u128)
        .checked_mul(ten_pow(output_decimals)?)
        .ok_or(KairosError::MathOverflow)?
        .checked_mul(1_000_000)
        .ok_or(KairosError::MathOverflow)?
        .checked_mul(1_000_000_000)
        .ok_or(KairosError::MathOverflow)?;
    let denominator = (minimum_amount_out as u128)
        .checked_mul(ten_pow(input_decimals)?)
        .ok_or(KairosError::MathOverflow)?
        .checked_mul(multiplier_nano as u128)
        .ok_or(KairosError::MathOverflow)?;
    let price = numerator
        .checked_div(denominator)
        .ok_or(KairosError::MathOverflow)?;

    u64::try_from(price).map_err(|_| error!(KairosError::MathOverflow))
}

/// Compare the owner-posted reference with the price implied by a proposed swap.
pub fn enforce_reference_price(
    reference_price: u64,
    maximum_deviation_bps: u16,
    multiplier_nano: u64,
    amount_in: u64,
    minimum_amount_out: u64,
    input_decimals: u8,
    output_decimals: u8,
) -> Result<()> {
    let executable_price = implied_executable_price_micros(
        amount_in,
        minimum_amount_out,
        input_decimals,
        output_decimals,
        multiplier_nano,
    )?;
    assert_price_deviation(reference_price, executable_price, maximum_deviation_bps)
}

fn ten_pow(exp: u8) -> Result<u128> {
    let mut scale = 1u128;
    for _ in 0..exp {
        scale = scale.checked_mul(10).ok_or(KairosError::MathOverflow)?;
    }
    Ok(scale)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::constants::{
        DEFAULT_DEPOSIT_FEE_BPS, DEFAULT_INFRASTRUCTURE_FEE_BPS, DEFAULT_PERIODIC_FEE_AMOUNT,
        PERIODIC_FEE_EPOCH_SECONDS,
    };

    #[test]
    fn default_fee_splits_fifteen_eighty_five() {
        let (infra, reinvest) = split_yield(10_000, DEFAULT_INFRASTRUCTURE_FEE_BPS).unwrap();
        assert_eq!(infra, 1_500);
        assert_eq!(reinvest, 8_500);
    }

    #[test]
    fn deposit_fee_splits_fifty_bps_entry_fee() {
        // 1,000 USDC (1_000_000_000 micro-USDC) at 50 bps = 5 USDC fee, 995 USDC net vaulted
        let (fee, net) = split_deposit_fee(1_000_000_000, DEFAULT_DEPOSIT_FEE_BPS).unwrap();
        assert_eq!(fee, 5_000_000);
        assert_eq!(net, 995_000_000);
    }

    #[test]
    fn periodic_fee_rejects_before_epoch_completes() {
        let start_ts = 1_700_000_000;
        let premature_ts = start_ts + PERIODIC_FEE_EPOCH_SECONDS - 1;
        let err = calculate_periodic_fee_due(
            start_ts,
            premature_ts,
            PERIODIC_FEE_EPOCH_SECONDS,
            DEFAULT_PERIODIC_FEE_AMOUNT,
        )
        .unwrap_err();
        assert_eq!(err, error!(KairosError::PeriodicFeeNotDue));
    }

    #[test]
    fn periodic_fee_settles_multiple_epochs_accurately() {
        let start_ts = 1_700_000_000;
        // 2 full epochs + 500 seconds partial
        let now_ts = start_ts + (2 * PERIODIC_FEE_EPOCH_SECONDS) + 500;
        let (epochs, fee, new_last) = calculate_periodic_fee_due(
            start_ts,
            now_ts,
            PERIODIC_FEE_EPOCH_SECONDS,
            DEFAULT_PERIODIC_FEE_AMOUNT,
        )
        .unwrap();
        assert_eq!(epochs, 2);
        assert_eq!(fee, 2_000_000);
        assert_eq!(new_last, start_ts + 2 * PERIODIC_FEE_EPOCH_SECONDS);
    }

    #[test]
    fn remainder_stays_with_reinvest() {
        let (infra, reinvest) = split_yield(7, DEFAULT_INFRASTRUCTURE_FEE_BPS).unwrap();
        assert_eq!(infra, 1);
        assert_eq!(reinvest, 6);
        assert_eq!(infra + reinvest, 7);
    }

    #[test]
    fn rejects_zero_amount() {
        assert!(split_yield(0, DEFAULT_INFRASTRUCTURE_FEE_BPS).is_err());
    }

    #[test]
    fn rejects_fee_over_100_percent() {
        assert!(split_yield(100, 10_001).is_err());
    }

    #[test]
    fn deviation_within_mandate_passes() {
        assert!(assert_price_deviation(100_000_000, 101_000_000, 200).is_ok());
    }

    #[test]
    fn deviation_above_mandate_is_rejected() {
        let err = assert_price_deviation(100_000_000, 103_000_000, 200).unwrap_err();
        assert_eq!(err, error!(KairosError::PriceDeviationExceeded));
    }
}
