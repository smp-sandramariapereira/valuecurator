import type { CatalogProvider } from "../../lib/oracle-api";

export const oracleDataFlow = {
  arrow: "data only",
  engine: "Calculation engine",
  checks: ["Age", "Confidence", "Deviation"] as const,
  boundary: "A price enters. No signature leaves.",
};

export function oracleChoiceCopy(provider: CatalogProvider, blockedReason: string | null): string {
  if (!provider.enabled) return provider.licenseLabel;
  if (blockedReason) return blockedReason;
  return provider.costLabel;
}
