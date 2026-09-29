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
}
