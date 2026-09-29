export const BPS_DENOMINATOR = 10_000n;

export type AssetPolicy = {
  mint: string;
  referenceFeedId: string;
  targetAllocationBps: number;
  maxAllocationBps: number;
  maxPriceDeviationBps: number;
};

export type InvestmentMandate = {
  id: string;
  version: number;
  validUntilMs: number;
  maxTradeValueMicros: bigint;
  maxPriceAgeMs: number;
  maxConfidenceBps: number;
  minTradeValueMicros: bigint;
  assets: readonly AssetPolicy[];
};

export type PortfolioPosition = {
  mint: string;
  valueMicros: bigint;
};

export type MarketObservation = {
  mint: string;
  referenceFeedId: string;
  referencePriceMicros: bigint;
  onchainPriceMicros: bigint;
  confidenceMicros: bigint;
  publishTimeMs: number;
};

export type RebalanceTrade = {
  mint: string;
  side: "buy" | "sell";
  valueMicros: bigint;
  currentAllocationBps: number;
  targetAllocationBps: number;
};

export type RebalanceProposal = {
  mandateId: string;
  mandateVersion: number;
  createdAtMs: number;
  portfolioValueMicros: bigint;
  trades: readonly RebalanceTrade[];
};

function requireBps(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > 10_000) {
    throw new Error(`${name} must be an integer between 0 and 10000`);
  }
}

export function validateMandate(mandate: InvestmentMandate, nowMs = Date.now()): void {
  if (!mandate.id.trim()) throw new Error("mandate id is required");
  if (!Number.isInteger(mandate.version) || mandate.version < 1) {
    throw new Error("mandate version must be a positive integer");
  }
  if (!Number.isFinite(mandate.validUntilMs) || mandate.validUntilMs <= nowMs) {
    throw new Error("mandate must have a future expiry");
  }
  if (mandate.maxTradeValueMicros <= 0n) throw new Error("max trade value must be positive");
  if (mandate.minTradeValueMicros < 0n || mandate.minTradeValueMicros > mandate.maxTradeValueMicros) {
    throw new Error("minimum trade value must be between zero and max trade value");
  }
  if (!Number.isInteger(mandate.maxPriceAgeMs) || mandate.maxPriceAgeMs < 1_000) {
    throw new Error("max price age must be at least 1000ms");
  }
  requireBps("maxConfidenceBps", mandate.maxConfidenceBps);
  if (mandate.assets.length < 2) throw new Error("mandate requires at least two assets");

  const mints = new Set<string>();
  const feeds = new Set<string>();
  let targetTotal = 0;
  for (const asset of mandate.assets) {
    if (!asset.mint.trim() || !asset.referenceFeedId.trim()) throw new Error("asset mint and feed are required");
    if (mints.has(asset.mint)) throw new Error(`duplicate asset mint ${asset.mint}`);
    if (feeds.has(asset.referenceFeedId)) throw new Error(`duplicate reference feed ${asset.referenceFeedId}`);
    mints.add(asset.mint);
    feeds.add(asset.referenceFeedId);
    requireBps("targetAllocationBps", asset.targetAllocationBps);
    requireBps("maxAllocationBps", asset.maxAllocationBps);
    requireBps("maxPriceDeviationBps", asset.maxPriceDeviationBps);
    if (asset.targetAllocationBps > asset.maxAllocationBps) {
      throw new Error(`target exceeds maximum allocation for ${asset.mint}`);
    }
    targetTotal += asset.targetAllocationBps;
  }
  if (targetTotal !== 10_000) throw new Error("target allocations must sum to 10000 bps");
}

export function allocationBps(value: bigint, total: bigint): number {
  if (total <= 0n) return 0;
  return Number((value * BPS_DENOMINATOR) / total);
}
