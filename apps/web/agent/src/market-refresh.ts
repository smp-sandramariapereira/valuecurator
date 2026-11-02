import { getMint, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import type { ProviderId } from "@valuecurator/oracle-contracts";
import { Connection, PublicKey } from "@solana/web3.js";
import { fetchJupiterExecutableQuote, quoteScaledUsdPriceMicros } from "./jupiter.js";
import { collectAdmissibleEvidence } from "./oracle/oracle-manager.js";
import { createLivePythEvidence, type ExecutableQuoteEvidence, type LivePythEvidenceReport } from "./pyth-evidence.js";
import { fetchXStockAsset, fetchXStockMultiplier, type XStockAsset, type XStockMultiplier } from "./xstocks.js";

export const DOCUMENTED_AAPLX_MINT = "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp";

export const MARKET_REFRESH_SAFEGUARDS = {
  walletLoaded: false,
  transactionConstructed: false,
  transactionSubmitted: false,
} as const;

export type MarketRefreshConfig = {
  providerId: ProviderId;
  feedId: string;
  apiKey?: string;
  apiUrl?: string;
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

function sameFeed(configured: string, returned: string): boolean {
  const normalize = (value: string) => value.trim().toLowerCase().replace(/^0x/, "");
  return normalize(configured) === normalize(returned);
}

export function referencePriceFromEvidence(evidence: { price: string; confidence: string | null }): {
  priceMicros: bigint;
  confidenceMicros: bigint;
} {
  if (evidence.confidence === null) throw new Error("oracle confidence is absent");
  if (!/^[1-9]\d*$/.test(evidence.price)) throw new Error("reference price must be positive");
  if (!/^(0|[1-9]\d*)$/.test(evidence.confidence)) throw new Error("oracle confidence is absent");
  return { priceMicros: BigInt(evidence.price), confidenceMicros: BigInt(evidence.confidence) };
}

export async function refreshMarketEvidence(
  config: MarketRefreshConfig,
  nowMs?: number,
  dependencies: {
    collect?: typeof collectAdmissibleEvidence;
    fetchAsset?: typeof fetchXStockAsset;
    fetchMultiplier?: typeof fetchXStockMultiplier;
    fetchQuote?: typeof fetchJupiterExecutableQuote;
    readMint?: typeof getMint;
  } = {},
): Promise<MarketRefreshResult> {
  const collect = dependencies.collect ?? collectAdmissibleEvidence;
  const loadAsset = dependencies.fetchAsset ?? fetchXStockAsset;
  const loadMultiplier = dependencies.fetchMultiplier ?? fetchXStockMultiplier;
  const loadQuote = dependencies.fetchQuote ?? fetchJupiterExecutableQuote;
  const loadMint = dependencies.readMint ?? getMint;
  const observedAtMs = nowMs ?? Date.now();
  let managed: Awaited<ReturnType<typeof collectAdmissibleEvidence>>;
  try {
    managed = await collect({
      requested: [config.providerId],
      entitlements: {
        planId: "operator",
        providers: [config.providerId],
        fallback: false,
        remainingRequests: 1,
      },
      fallbackOptIn: false,
      asset: { symbol: config.symbol, mint: DOCUMENTED_AAPLX_MINT, network: "mainnet-beta" },
      feedId: config.feedId,
      maximumPriceAgeMs: config.maximumPriceAgeMs,
      credentialFor: (providerId) => providerId === config.providerId ? config.apiKey : undefined,
      apiUrlFor: (providerId) => providerId === config.providerId ? config.apiUrl : undefined,
      licenseFor: () => "authorized",
      observedAtMs,
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    throw new Error(`Reference price unavailable: ${boundedReason(error)}`, { cause: error });
  }
  if (!managed.evidence || managed.decision.admissibility !== "ADMISSIBLE") {
    const reasons = managed.decision.reasons.join("; ") || "no admissible reference price";
    throw new Error(`Reference price unavailable: ${reasons}`);
  }
  if (managed.evidence.providerId !== config.providerId) {
    throw new Error("Reference price unavailable: oracle provider does not match the configuration");
  }
  if (!sameFeed(config.feedId, managed.evidence.feedId)) {
    throw new Error("Reference price unavailable: oracle feed does not match the configuration");
  }
  const price = {
    ...referencePriceFromEvidence(managed.evidence),
    feedId: managed.evidence.feedId,
    publishTimeMs: managed.evidence.publishTimeMs,
  };

  const [assetResult, multiplierResult] = await Promise.all([
    readDependency<XStockAsset>(
      "xStocks asset discovery",
      loadAsset({
        apiUrl: config.xstocksApiUrl,
        symbol: config.symbol,
        signal: AbortSignal.timeout(30_000),
      }),
    ),
    readDependency<XStockMultiplier>(
      "xStocks multiplier",
      loadMultiplier({
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
  if (asset && asset.symbol !== config.symbol) additionalReasons.push("xStocks symbol does not match the configured asset");
  if (asset && asset.solanaMint.toBase58() !== DOCUMENTED_AAPLX_MINT) {
    additionalReasons.push("xStocks mint does not match the documented asset");
  }
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
    const mint = await loadMint(connection, asset.solanaMint, "confirmed", TOKEN_2022_PROGRAM_ID);
    const quote = await loadQuote({
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
      source: managed.evidence.providerId,
      provenance: managed.evidence.provenance,
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
