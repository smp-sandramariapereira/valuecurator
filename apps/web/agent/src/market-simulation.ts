import { createLivePythEvidence, type LivePythEvidenceReport } from "./pyth-evidence.js";

export type MarketSimulationScenario = "safe" | "stale" | "divergent";

export type SimulatedMarketEvidenceReport = Omit<
  LivePythEvidenceReport,
  "source" | "simulated"
> & {
  source: "fixture";
  simulated: true;
  simulationScenario: MarketSimulationScenario;
};

const AAPLX_MINT = "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp";
const MAINNET_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export function createMarketSimulation(
  scenario: MarketSimulationScenario,
  nowMs = Date.now(),
  limits?: {
    maximumPriceAgeMs?: number;
    maximumConfidenceBps?: number;
    maximumDeviationBps?: number;
    maximumPriceImpactBps?: number;
  },
): SimulatedMarketEvidenceReport {
  const stale = scenario === "stale";
  const divergent = scenario === "divergent";
  const report = createLivePythEvidence({
    price: {
      feedId: "922",
      priceMicros: 343_440_000n,
      confidenceMicros: 62_170n,
      publishTimeMs: nowMs - (stale ? 60_000 : 1_000),
    },
    symbol: "AAPLx",
    executableQuote: {
      mint: AAPLX_MINT,
      source: "jupiter",
      network: "mainnet-beta",
      inputMint: MAINNET_USDC_MINT,
      inputAmount: 100_000_000n,
      inputDecimals: 6,
      expectedOutputAmount: 29_200_000n,
      minimumOutputAmount: 29_000_000n,
      outputDecimals: 8,
      multiplierNano: 1_003_269_013n,
      executablePriceMicros: divergent ? 374_000_000n : 343_810_000n,
      priceImpactBps: 25,
      routeHops: 1,
    },
    nowMs,
    maximumPriceAgeMs: limits?.maximumPriceAgeMs ?? 30_000,
    maximumConfidenceBps: limits?.maximumConfidenceBps ?? 100,
    maximumDeviationBps: limits?.maximumDeviationBps ?? 200,
    maximumPriceImpactBps: limits?.maximumPriceImpactBps ?? 200,
  });

  return {
    ...report,
    source: "fixture",
    simulated: true,
    simulationScenario: scenario,
  };
}
