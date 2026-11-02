export const PORTFOLIO_DRAFT_STORAGE_KEY = "valuecurator.experimental-portfolio-draft.v1";
export const WATCHLIST_STORAGE_KEY = "valuecurator.experimental-watchlist.v1";

export const RISK_PROFILES = ["conservador", "moderado", "arrojado"] as const;
export type RiskProfile = (typeof RISK_PROFILES)[number];

export type PortfolioDraft = {
  kind: "experimental-local-draft";
  name: string;
  objective: string;
  horizon: string;
  riskProfile: RiskProfile | "";
  currency: "USD";
  assetIds: string[];
  weights: Record<string, number>;
  updatedAt: string;
};

export type AllocationReview = {
  valid: boolean;
  total: number;
  errors: string[];
  warnings: string[];
};

export type RebalanceRow = {
  assetId: string;
  plannedPercent: number;
  desiredPercent: number;
  differencePercent: number;
  relation: "acima" | "abaixo" | "igual";
};

export type RebalanceSimulation = {
  state: "DRAFT" | "SIMULATED" | "REQUIRES_REVIEW";
  basis: "PLANEJADO";
  rows: RebalanceRow[];
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function finitePercent(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return round2(value);
}

export function reviewAllocation(assetIds: readonly string[], weights: Readonly<Record<string, number>>): AllocationReview {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (assetIds.length === 0) errors.push("Selecione ao menos um ativo.");
  if (new Set(assetIds).size !== assetIds.length) errors.push("Há um ativo repetido.");
  let total = 0;
  for (const id of assetIds) {
    const weight = finitePercent(weights[id]);
    if (weight === null || weight <= 0 || weight > 100) {
      errors.push(`Peso inválido para ${id}.`);
      continue;
    }
    total = round2(total + weight);
    if (weight > 40) warnings.push(`Concentração acima de 40% em ${id}.`);
  }
  if (assetIds.length > 0 && total !== 100) errors.push("A soma dos pesos precisa ser 100%.");
  return { valid: errors.length === 0, total, errors, warnings };
}

export function simulateRebalance(
  assetIds: readonly string[],
  planned: Readonly<Record<string, number>>,
  desired: Readonly<Record<string, number>>,
): RebalanceSimulation {
  const current = reviewAllocation(assetIds, planned);
  const next = reviewAllocation(assetIds, desired);
  const rows = assetIds.map((assetId) => {
    const plannedPercent = finitePercent(planned[assetId]) ?? 0;
    const desiredPercent = finitePercent(desired[assetId]) ?? 0;
    const differencePercent = round2(desiredPercent - plannedPercent);
    const relation: RebalanceRow["relation"] = differencePercent > 0 ? "abaixo" : differencePercent < 0 ? "acima" : "igual";
    return { assetId, plannedPercent, desiredPercent, differencePercent, relation };
  });
  const state = !current.valid || !next.valid ? "REQUIRES_REVIEW" : "SIMULATED";
  return { state, basis: "PLANEJADO", rows };
}

export function parsePortfolioDraft(value: unknown): PortfolioDraft | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.kind !== "experimental-local-draft") return null;
  if (record.currency !== "USD") return null;
  if (typeof record.name !== "string" || typeof record.objective !== "string" || typeof record.horizon !== "string") return null;
  if (record.riskProfile !== "" && !RISK_PROFILES.includes(record.riskProfile as RiskProfile)) return null;
  if (!Array.isArray(record.assetIds) || record.assetIds.some((id) => typeof id !== "string")) return null;
  if (!record.weights || typeof record.weights !== "object" || Array.isArray(record.weights)) return null;
  const weights: Record<string, number> = {};
  for (const [id, weight] of Object.entries(record.weights)) {
    const parsed = finitePercent(weight);
    if (parsed === null) return null;
    weights[id] = parsed;
  }
  if (typeof record.updatedAt !== "string") return null;
  return {
    kind: "experimental-local-draft",
    name: record.name,
    objective: record.objective,
    horizon: record.horizon,
    riskProfile: record.riskProfile as RiskProfile | "",
    currency: "USD",
    assetIds: record.assetIds as string[],
    weights,
    updatedAt: record.updatedAt,
  };
}

export function parseWatchlist(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const record = value as Record<string, unknown>;
  if (record.kind !== "experimental-local-watchlist" || !Array.isArray(record.assetIds)) return [];
  return record.assetIds.filter((id): id is string => typeof id === "string");
}
