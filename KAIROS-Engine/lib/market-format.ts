export function formatTokenAmount(
  rawAmount: string | null | undefined,
  decimals: number | null | undefined,
  symbol: string,
): string {
  if (rawAmount === null || rawAmount === undefined) return "unavailable";
  if (!Number.isInteger(decimals) || decimals === undefined || decimals === null || decimals < 0) {
    return `${rawAmount} raw units`;
  }

  try {
    const negative = rawAmount.startsWith("-");
    const absolute = BigInt(rawAmount) < 0n ? -BigInt(rawAmount) : BigInt(rawAmount);
    if (decimals === 0) return `${negative ? "-" : ""}${absolute} ${symbol}`;
    const scale = 10n ** BigInt(decimals);
    const whole = absolute / scale;
    const fraction = (absolute % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
    return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""} ${symbol}`;
  } catch {
    return `${rawAmount} raw units`;
  }
}

export function formatMeasuredValue(value: string, unit: "ms" | "bps"): string {
  if (unit !== "ms") return `${value} ${unit}`;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return `${value} ${unit}`;
  return formatAgeMs(parsed);
}

export function formatAgeMs(milliseconds: number): string {
  if (Number.isInteger(milliseconds) && milliseconds % 1000 === 0) return `${milliseconds / 1000} s`;
  return `${milliseconds} ms`;
}

export function formatAgeComparison(ageMs: number, maximumMs: number): string {
  if (Number.isInteger(ageMs) && Number.isInteger(maximumMs) && ageMs % 1000 === 0 && maximumMs % 1000 === 0) {
    return `${ageMs / 1000} / ${maximumMs / 1000} s`;
  }
  return `${ageMs} / ${maximumMs} ms`;
}

export function formatCountdown(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
    : `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

/** Pass-through for display; reasons are authored in English. */
export function translateMarketReason(reason: string): string {
  return reason;
}
