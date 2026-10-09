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
///
/// Matches `quoteScaledUsdPriceMicros`: input is treated as the USD leg and
/// `minimum_amount_out` is the least output the operator is willing to accept.
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
    use crate::constants::DEFAULT_INFRASTRUCTURE_FEE_BPS;

    #[test]
    fn default_fee_splits_fifteen_eighty_five() {
        let (infra, reinvest) = split_yield(10_000, DEFAULT_INFRASTRUCTURE_FEE_BPS).unwrap();
        assert_eq!(infra, 1_500);
        assert_eq!(reinvest, 8_500);
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
        // |101 - 100| / 100 = 100 bps, under a 200 bps mandate.
        assert!(assert_price_deviation(100_000_000, 101_000_000, 200).is_ok());
    }

    #[test]
    fn deviation_above_mandate_is_rejected() {
        // |103 - 100| / 100 = 300 bps, over a 200 bps mandate.
        let err = assert_price_deviation(100_000_000, 103_000_000, 200).unwrap_err();
        assert_eq!(err, error!(KairosError::PriceDeviationExceeded));
    }

    #[test]
    fn implied_price_within_reference_passes() {
        // 1.01 USDC for 1.000000 output base units, 6 and 8 decimals, multiplier 1.0.
        // Implied price is $1.01 = 101_000_000 micros, 100 bps from $1.00.
        let executable = implied_executable_price_micros(
            1_010_000,
            1_000_000,
            6,
            8,
            1_000_000_000,
        )
        .unwrap();
        assert_eq!(executable, 101_000_000);
        assert!(assert_price_deviation(100_000_000, executable, 200).is_ok());
    }

    #[test]
    fn implied_price_above_reference_is_rejected() {
        // 1.30 USDC for the same output is $1.30, 3000 bps from $1.00.
        let executable = implied_executable_price_micros(
            1_300_000,
            1_000_000,
            6,
            8,
            1_000_000_000,
        )
        .unwrap();
        assert_eq!(executable, 130_000_000);
        let err = assert_price_deviation(100_000_000, executable, 200).unwrap_err();
        assert_eq!(err, error!(KairosError::PriceDeviationExceeded));
    }

    #[test]
    fn six_decimal_whole_token_uses_one_million_as_one_dollar() {
        let fair = implied_executable_price_micros(1_000_000, 1_000_000, 6, 6, 1_000_000_000).unwrap();
        assert_eq!(fair, 1_000_000);
        assert!(enforce_reference_price(1_000_000, 200, 1_000_000_000, 1_000_000, 1_000_000, 6, 6).is_ok());

        let err = enforce_reference_price(1_000_000, 200, 1_000_000_000, 1_300_000, 1_000_000, 6, 6)
            .unwrap_err();
        assert_eq!(err, error!(KairosError::PriceDeviationExceeded));
    }
}
