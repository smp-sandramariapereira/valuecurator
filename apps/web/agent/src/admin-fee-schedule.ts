/**
 * Tri-Tier Administrative Fee Engine — Off-Chain Deterministic Mirror
 * Matches `kairos_engine` Anchor instructions:
 *  1. Tier 1 (Deposit Fee): `deposit_with_fee` (`DEFAULT_DEPOSIT_FEE_BPS = 50` -> 0.50%)
 *  2. Tier 2 (Periodic Node Fee): `collect_periodic_fee` (`1_000_000` micro-USDC / 30-day epoch)
 *  3. Tier 3 (Performance / Yield Fee): `metabolize_yield` (`DEFAULT_INFRASTRUCTURE_FEE_BPS = 1500` -> 15%)
 */

export const BPS_DENOMINATOR = 10_000n;
export const DEFAULT_DEPOSIT_FEE_BPS = 50; // 0.50%
export const DEFAULT_PERIODIC_FEE_AMOUNT = 1_000_000n; // 1.00 USDC (6 decimals)
export const PERIODIC_FEE_EPOCH_SECONDS = 2_592_000n; // 30 days in seconds
export const DEFAULT_PERFORMANCE_FEE_BPS = 1_500; // 15.00%

export interface DepositFeeSplit {
  grossAmount: bigint;
  depositFeeCollected: bigint;
  netVaulted: bigint;
  depositFeeBps: number;
}

export interface PeriodicFeeSettlement {
  epochsSettled: bigint;
  periodicFeeCollected: bigint;
  newLastPeriodicFeeTs: bigint;
}

export interface PerformanceFeeSplit {
  grossYield: bigint;
  performanceFeeCollected: bigint;
  netReinvested: bigint;
  performanceFeeBps: number;
}

export function computeDepositFeeSplit(
  grossAmount: bigint,
  depositFeeBps: number = DEFAULT_DEPOSIT_FEE_BPS
): DepositFeeSplit {
  if (grossAmount <= 0n) {
    throw new Error("ZeroAmount: Deposit grossAmount must be greater than zero");
  }
  if (depositFeeBps < 0 || depositFeeBps > 10_000) {
    throw new Error("InvalidFee: depositFeeBps must be between 0 and 10000");
  }
  const depositFeeCollected = (grossAmount * BigInt(depositFeeBps)) / BPS_DENOMINATOR;
  const netVaulted = grossAmount - depositFeeCollected;
  return {
    grossAmount,
    depositFeeCollected,
    netVaulted,
    depositFeeBps,
  };
}

export function computePeriodicFeeDue(
  lastPeriodicFeeTs: bigint,
  nowTs: bigint,
  feePerEpoch: bigint = DEFAULT_PERIODIC_FEE_AMOUNT,
  epochSeconds: bigint = PERIODIC_FEE_EPOCH_SECONDS
): PeriodicFeeSettlement {
  if (epochSeconds <= 0n) {
    throw new Error("InvalidEpochDuration: epochSeconds must be positive");
  }
  if (nowTs < lastPeriodicFeeTs) {
    throw new Error("PeriodicFeeNotDue: current timestamp precedes last fee timestamp");
  }
  const elapsed = nowTs - lastPeriodicFeeTs;
  const epochsSettled = elapsed / epochSeconds;
  if (epochsSettled <= 0n) {
    throw new Error("PeriodicFeeNotDue: at least one full 30-day epoch must elapse");
  }
  const periodicFeeCollected = epochsSettled * feePerEpoch;
  const newLastPeriodicFeeTs = lastPeriodicFeeTs + epochsSettled * epochSeconds;
  return {
    epochsSettled,
    periodicFeeCollected,
    newLastPeriodicFeeTs,
  };
}

export function computePerformanceFeeSplit(
  grossYield: bigint,
  performanceFeeBps: number = DEFAULT_PERFORMANCE_FEE_BPS
): PerformanceFeeSplit {
  if (grossYield <= 0n) {
    throw new Error("ZeroAmount: grossYield must be greater than zero");
  }
  if (performanceFeeBps < 0 || performanceFeeBps > 10_000) {
    throw new Error("InvalidFee: performanceFeeBps must be between 0 and 10000");
  }
  const performanceFeeCollected =
    (grossYield * BigInt(performanceFeeBps)) / BPS_DENOMINATOR;
  const netReinvested = grossYield - performanceFeeCollected;
  return {
    grossYield,
    performanceFeeCollected,
    netReinvested,
    performanceFeeBps,
  };
}
