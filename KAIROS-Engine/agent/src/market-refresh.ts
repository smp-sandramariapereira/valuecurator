import { getMint, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";
import { fetchJupiterExecutableQuote, quoteScaledUsdPriceMicros } from "./jupiter.js";
import { createLivePythEvidence, type ExecutableQuoteEvidence, type LivePythEvidenceReport } from "./pyth-evidence.js";
import { fetchPythProPrice } from "./pyth-pro.js";
import { fetchXStockAsset, fetchXStockMultiplier, type XStockAsset, type XStockMultiplier } from "./xstocks.js";

export type MarketRefreshConfig = {
  feedId: string;
  pythApiKey: string;
  pythApiUrl: string;
  xstocksApiUrl: string;
  symbol: string;
  marketRpcUrl: string;
  jupiterApiUrl: string;
  jupiterApiKey?: string;
  inputMint: PublicKey;
  inputAmount: bigint;
  inputDecimals: number;
  slippageBps: number;
  maxAccounts: number;
  maxPriceImpactBps: number;
  activationGuardMs: number;
  maximumPriceAgeMs: number;
  maximumConfidenceBps: number;
  maximumDeviationBps: number;
};

export type MarketRefreshResult = {
  report: LivePythEvidenceReport;
  asset: XStockAsset | null;
  multiplier: XStockMultiplier | null;
};

function boundedReason(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, " ").slice(0, 240);
}

type DependencyResult<T> = { value: T; reason: null } | { value: null; reason: string };

async function readDependency<T>(label: string, operation: Promise<T>): Promise<DependencyResult<T>> {
  try {
    return { value: await operation, reason: null };
  } catch (error) {
    return { value: null, reason: `${label} unavailable: ${boundedReason(error)}` };
  }
}

export async function refreshMarketEvidence(
  config: MarketRefreshConfig,
  nowMs?: number,
): Promise<MarketRefreshResult> {
  let price: Awaited<ReturnType<typeof fetchPythProPrice>>;
  try {
    price = await fetchPythProPrice({
      feedId: config.feedId,
      apiKey: config.pythApiKey,
      apiUrl: config.pythApiUrl,
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    throw new Error(`Pyth Pro unavailable: ${boundedReason(error)}`, { cause: error });
  }

  const [assetResult, multiplierResult] = await Promise.all([
    readDependency<XStockAsset>(
      "xStocks asset discovery",
      fetchXStockAsset({
        apiUrl: config.xstocksApiUrl,
        symbol: config.symbol,
        signal: AbortSignal.timeout(30_000),
      }),
    ),
    readDependency<XStockMultiplier>(
      "xStocks multiplier",
      fetchXStockMultiplier({
        apiUrl: config.xstocksApiUrl,
        symbol: config.symbol,
        signal: AbortSignal.timeout(30_000),
      }),
    ),
  ]);
  const asset = assetResult.value;
  const multiplier = multiplierResult.value;
  const additionalReasons: string[] = [];
  if (assetResult.reason) additionalReasons.push(assetResult.reason);
  if (multiplierResult.reason) additionalReasons.push(multiplierResult.reason);
  if (asset?.tradingHalted) additionalReasons.push("xStocks reports trading halted");
  const multiplierCheckTimeMs = nowMs ?? Date.now();
  if (multiplier?.activationTimeMs !== null && multiplier?.activationTimeMs !== undefined &&
      multiplier.newMultiplierNano !== null &&
      Math.abs(multiplier.activationTimeMs - multiplierCheckTimeMs) <= config.activationGuardMs) {
    additionalReasons.push("xStocks multiplier activation is inside the safety window");
  }

  let executableQuote: ExecutableQuoteEvidence | undefined;
  if (asset && multiplier) try {
    const connection = new Connection(config.marketRpcUrl, "confirmed");
    const mint = await getMint(connection, asset.solanaMint, "confirmed", TOKEN_2022_PROGRAM_ID);
    const quote = await fetchJupiterExecutableQuote({
      apiUrl: config.jupiterApiUrl,
      apiKey: config.jupiterApiKey,
      inputMint: config.inputMint,
      outputMint: asset.solanaMint,
      amount: config.inputAmount,
      slippageBps: config.slippageBps,
      maxAccounts: config.maxAccounts,
      signal: AbortSignal.timeout(15_000),
    });
    const priceImpactBps = Math.round(quote.priceImpactPct * 100);
    executableQuote = {
      mint: asset.solanaMint.toBase58(),
      source: "jupiter",
      network: "mainnet-beta",
      inputMint: config.inputMint.toBase58(),
      inputAmount: quote.inputAmount,
      inputDecimals: config.inputDecimals,
      expectedOutputAmount: quote.expectedAmountOut,
      minimumOutputAmount: quote.minimumAmountOut,
      outputDecimals: mint.decimals,
      multiplierNano: multiplier.currentMultiplierNano,
      executablePriceMicros: quoteScaledUsdPriceMicros({
        usdInputAmount: quote.inputAmount,
        assetOutputAmount: quote.minimumAmountOut,
        usdDecimals: config.inputDecimals,
        assetDecimals: mint.decimals,
        multiplierNano: multiplier.currentMultiplierNano,
      }),
      priceImpactBps,
      routeHops: quote.routeHops,
    };
  } catch (error) {
    additionalReasons.push(`executable quote unavailable: ${boundedReason(error)}`);
  }

  const evaluatedAtMs = nowMs ?? Date.now();
  return {
    asset,
    multiplier,
    report: createLivePythEvidence({
      price,
      symbol: asset?.symbol ?? config.symbol,
      ...(executableQuote ? { executableQuote } : {}),
      additionalReasons,
      nowMs: evaluatedAtMs,
      maximumPriceAgeMs: config.maximumPriceAgeMs,
      maximumConfidenceBps: config.maximumConfidenceBps,
      maximumDeviationBps: config.maximumDeviationBps,
      maximumPriceImpactBps: config.maxPriceImpactBps,
    }),
  };
}
