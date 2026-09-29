import {
  BPS_DENOMINATOR,
  allocationBps,
  validateMandate,
  type InvestmentMandate,
  type MarketObservation,
  type PortfolioPosition,
  type RebalanceProposal,
} from "./mandate.js";

export type PolicyDecision = {
  allowed: boolean;
  reasons: readonly string[];
};

function indexUnique<T>(items: readonly T[], key: (item: T) => string, label: string): Map<string, T> {
  const result = new Map<string, T>();
  for (const item of items) {
    const id = key(item);
    if (result.has(id)) throw new Error(`duplicate ${label} for ${id}`);
    result.set(id, item);
  }
  return result;
}

export function createRebalanceProposal(
  mandate: InvestmentMandate,
  positions: readonly PortfolioPosition[],
  nowMs = Date.now(),
): RebalanceProposal {
  validateMandate(mandate, nowMs);
  const positionByMint = indexUnique(positions, (position) => position.mint, "position");
  for (const position of positions) {
    if (position.valueMicros < 0n) throw new Error(`negative position value for ${position.mint}`);
    if (!mandate.assets.some((asset) => asset.mint === position.mint) && position.valueMicros > 0n) {
      throw new Error(`portfolio contains unauthorized asset ${position.mint}`);
    }
  }

  const portfolioValueMicros = positions.reduce((total, position) => total + position.valueMicros, 0n);
  if (portfolioValueMicros <= 0n) throw new Error("portfolio value must be positive");

  const trades = [...mandate.assets]
    .sort((left, right) => left.mint.localeCompare(right.mint))
    .flatMap((asset) => {
      const current = positionByMint.get(asset.mint)?.valueMicros ?? 0n;
      const target = (portfolioValueMicros * BigInt(asset.targetAllocationBps)) / BPS_DENOMINATOR;
      const delta = target - current;
      const valueMicros = delta < 0n ? -delta : delta;
      if (valueMicros < mandate.minTradeValueMicros || valueMicros === 0n) return [];
      return [{
        mint: asset.mint,
        side: delta > 0n ? "buy" as const : "sell" as const,
        valueMicros,
        currentAllocationBps: allocationBps(current, portfolioValueMicros),
        targetAllocationBps: asset.targetAllocationBps,
      }];
    });

  return {
    mandateId: mandate.id,
    mandateVersion: mandate.version,
    createdAtMs: nowMs,
    portfolioValueMicros,
    trades,
  };
}

export function evaluateProposal(
  mandate: InvestmentMandate,
  proposal: RebalanceProposal,
  observations: readonly MarketObservation[],
  nowMs = Date.now(),
): PolicyDecision {
  const reasons: string[] = [];
  try {
    validateMandate(mandate, nowMs);
  } catch (error) {
    return { allowed: false, reasons: [error instanceof Error ? error.message : String(error)] };
  }
  if (proposal.mandateId !== mandate.id || proposal.mandateVersion !== mandate.version) {
    reasons.push("proposal mandate identity or version mismatch");
  }
  if (proposal.createdAtMs > nowMs || nowMs - proposal.createdAtMs > mandate.maxPriceAgeMs) {
    reasons.push("proposal is stale");
  }

  let observationByMint: Map<string, MarketObservation>;
  try {
    observationByMint = indexUnique(observations, (observation) => observation.mint, "observation");
  } catch (error) {
    return { allowed: false, reasons: [error instanceof Error ? error.message : String(error)] };
  }

  const assetByMint = new Map(mandate.assets.map((asset) => [asset.mint, asset]));
  for (const trade of proposal.trades) {
    const asset = assetByMint.get(trade.mint);
    if (!asset) {
      reasons.push(`unauthorized trade asset ${trade.mint}`);
      continue;
    }
    if (trade.valueMicros <= 0n) reasons.push(`non-positive trade value for ${trade.mint}`);
    if (trade.valueMicros > mandate.maxTradeValueMicros) {
      reasons.push(`trade exceeds maximum value for ${trade.mint}`);
    }
    if (trade.targetAllocationBps !== asset.targetAllocationBps ||
        trade.targetAllocationBps > asset.maxAllocationBps) {
      reasons.push(`allocation violates mandate for ${trade.mint}`);
    }

    const observation = observationByMint.get(trade.mint);
    if (!observation) {
      reasons.push(`missing market observation for ${trade.mint}`);
      continue;
    }
    if (observation.referenceFeedId !== asset.referenceFeedId) {
      reasons.push(`reference feed mismatch for ${trade.mint}`);
    }
    if (observation.referencePriceMicros <= 0n || observation.onchainPriceMicros <= 0n ||
        observation.confidenceMicros < 0n) {
      reasons.push(`invalid market observation for ${trade.mint}`);
      continue;
    }
    if (observation.publishTimeMs > nowMs || nowMs - observation.publishTimeMs > mandate.maxPriceAgeMs) {
      reasons.push(`stale market observation for ${trade.mint}`);
    }
    if (observation.confidenceMicros * BPS_DENOMINATOR >
        observation.referencePriceMicros * BigInt(mandate.maxConfidenceBps)) {
      reasons.push(`confidence interval too wide for ${trade.mint}`);
    }
    const difference = observation.onchainPriceMicros >= observation.referencePriceMicros
      ? observation.onchainPriceMicros - observation.referencePriceMicros
      : observation.referencePriceMicros - observation.onchainPriceMicros;
    if (difference * BPS_DENOMINATOR >
        observation.referencePriceMicros * BigInt(asset.maxPriceDeviationBps)) {
      reasons.push(`price deviation too high for ${trade.mint}`);
    }
  }
  return { allowed: reasons.length === 0, reasons };
}

export function evaluateMarketObservation(options: {
  asset: InvestmentMandate["assets"][number];
  observation: MarketObservation;
  maxPriceAgeMs: number;
  maxConfidenceBps: number;
  nowMs?: number;
}): PolicyDecision {
  const { asset, observation } = options;
  const nowMs = options.nowMs ?? Date.now();
  const reasons: string[] = [];
  if (observation.mint !== asset.mint) reasons.push("market observation mint mismatch");
  if (observation.referenceFeedId !== asset.referenceFeedId) reasons.push("market observation feed mismatch");
  if (observation.referencePriceMicros <= 0n || observation.onchainPriceMicros <= 0n ||
      observation.confidenceMicros < 0n) {
    reasons.push("invalid market observation");
    return { allowed: false, reasons };
  }
  if (observation.publishTimeMs > nowMs || nowMs - observation.publishTimeMs > options.maxPriceAgeMs) {
    reasons.push("market observation is stale");
  }
  if (observation.confidenceMicros * BPS_DENOMINATOR >
      observation.referencePriceMicros * BigInt(options.maxConfidenceBps)) {
    reasons.push("market confidence interval is too wide");
  }
  const difference = observation.onchainPriceMicros >= observation.referencePriceMicros
    ? observation.onchainPriceMicros - observation.referencePriceMicros
    : observation.referencePriceMicros - observation.onchainPriceMicros;
  if (difference * BPS_DENOMINATOR >
      observation.referencePriceMicros * BigInt(asset.maxPriceDeviationBps)) {
    reasons.push("executable price deviation is too high");
  }
  return { allowed: reasons.length === 0, reasons };
}
