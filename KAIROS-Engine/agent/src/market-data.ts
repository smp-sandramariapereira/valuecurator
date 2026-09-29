import { PublicKey } from "@solana/web3.js";
import type { MarketObservation } from "./mandate.js";
import { quoteUsdPriceMicros } from "./jupiter.js";
import { fetchPythPrice } from "./pyth.js";
import { fetchPythProPrice } from "./pyth-pro.js";
import { fetchXStockAsset } from "./xstocks.js";

export async function buildGuardedMarketObservation(options: {
  symbol: string;
  expectedMint: PublicKey;
  pythFeedId: string;
  usdInputAmount: bigint;
  assetOutputAmount: bigint;
  usdDecimals: number;
  assetDecimals: number;
  xstocksApiUrl?: string;
  pythApiUrl?: string;
  pythApiKey?: string;
  signal?: AbortSignal;
}): Promise<MarketObservation> {
  const numericPythProFeed = /^\\d+$/.test(options.pythFeedId.trim());
  const referencePrice = numericPythProFeed
    ? fetchPythProPrice({
        ...(options.pythApiUrl ? { apiUrl: options.pythApiUrl } : {}),
        feedId: options.pythFeedId,
        apiKey: options.pythApiKey ?? "",
        ...(options.signal ? { signal: options.signal } : {}),
      })
    : fetchPythPrice({
        ...(options.pythApiUrl ? { apiUrl: options.pythApiUrl } : {}),
        feedId: options.pythFeedId,
        ...(options.pythApiKey ? { apiKey: options.pythApiKey } : {}),
        ...(options.signal ? { signal: options.signal } : {}),
      });
  const [asset, pyth] = await Promise.all([
    fetchXStockAsset({
      ...(options.xstocksApiUrl ? { apiUrl: options.xstocksApiUrl } : {}),
      symbol: options.symbol,
      ...(options.signal ? { signal: options.signal } : {}),
    }),
    referencePrice,
  ]);

  if (!asset.solanaMint.equals(options.expectedMint)) {
    throw new Error("xStocks deployment mint does not match the investment mandate");
  }
  if (asset.tradingHalted) throw new Error(`xStocks trading is halted for ${asset.symbol}`);
  if (!asset.supportsAtomicSwaps) throw new Error(`xStocks asset ${asset.symbol} does not support atomic swaps`);

  return {
    mint: asset.solanaMint.toBase58(),
    referenceFeedId: pyth.feedId,
    referencePriceMicros: pyth.priceMicros,
    onchainPriceMicros: quoteUsdPriceMicros({
      usdInputAmount: options.usdInputAmount,
      assetOutputAmount: options.assetOutputAmount,
      usdDecimals: options.usdDecimals,
      assetDecimals: options.assetDecimals,
    }),
    confidenceMicros: pyth.confidenceMicros,
    publishTimeMs: pyth.publishTimeMs,
  };
}
