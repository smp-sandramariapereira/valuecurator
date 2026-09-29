import type { MarketObservation } from "./mandate.js";

export const DEFAULT_PYTH_HERMES_URL = "https://pyth.dourolabs.app/hermes";

type UnknownRecord = Record<string, unknown>;

function record(value: unknown, label: string): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`invalid ${label}`);
  return value as UnknownRecord;
}

function integer(value: unknown, label: string): bigint {
  if (typeof value !== "string" || !/^-?\d+$/.test(value)) throw new Error(`invalid ${label}`);
  return BigInt(value);
}

function numberInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) throw new Error(`invalid ${label}`);
  return value;
}

function normalizeFeedId(feedId: string): string {
  const normalized = feedId.trim().toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]{64}$/.test(normalized)) throw new Error("Pyth feed id must contain 32 bytes of hex");
  return normalized;
}

function scaleToMicros(value: bigint, exponent: number): bigint {
  const scale = exponent + 6;
  if (scale >= 0) return value * (10n ** BigInt(scale));
  const divisor = 10n ** BigInt(-scale);
  const quotient = value / divisor;
  const remainder = value % divisor;
  if (remainder === 0n) return quotient;
  const absoluteRemainder = remainder < 0n ? -remainder : remainder;
  const rounded = absoluteRemainder * 2n >= divisor ? 1n : 0n;
  return quotient + (value < 0n ? -rounded : rounded);
}

export type PythPrice = {
  feedId: string;
  priceMicros: bigint;
  confidenceMicros: bigint;
  publishTimeMs: number;
};

export async function fetchPythPrice(options: {
  feedId: string;
  apiUrl?: string;
  apiKey?: string;
  signal?: AbortSignal;
}): Promise<PythPrice> {
  const feedId = normalizeFeedId(options.feedId);
  const apiUrl = new URL(options.apiUrl ?? DEFAULT_PYTH_HERMES_URL);
  if (apiUrl.protocol !== "https:" && apiUrl.hostname !== "localhost" && apiUrl.hostname !== "127.0.0.1") {
    throw new Error("Pyth Hermes API must use HTTPS");
  }
  apiUrl.pathname = apiUrl.pathname.replace(/\/+$/, "") + "/";
  const url = new URL("v2/updates/price/latest", apiUrl);
  url.searchParams.append("ids[]", feedId);
  url.searchParams.set("parsed", "true");
  const headers: Record<string, string> = { accept: "application/json" };
  if (options.apiKey?.trim()) headers.authorization = `Bearer ${options.apiKey.trim()}`;
  const requestInit: RequestInit = { headers };
  if (options.signal) requestInit.signal = options.signal;

  const response = await fetch(url, requestInit);
  if (!response.ok) {
    const body = (await response.text()).slice(0, 240);
    throw new Error(`Pyth price request failed (${response.status}): ${body}`);
  }
  const body = record(await response.json(), "Pyth response");
  if (!Array.isArray(body.parsed) || body.parsed.length !== 1) throw new Error("Pyth response must contain exactly one parsed feed");
  const parsed = record(body.parsed[0], "Pyth parsed feed");
  const returnedId = typeof parsed.id === "string" ? normalizeFeedId(parsed.id) : "";
  if (returnedId !== feedId) throw new Error("Pyth returned an unexpected feed");
  const price = record(parsed.price, "Pyth price");
  const rawPrice = integer(price.price, "Pyth price value");
  const rawConfidence = integer(price.conf, "Pyth confidence");
  const exponent = numberInteger(price.expo, "Pyth exponent");
  const publishTime = numberInteger(price.publish_time, "Pyth publish time");
  if (rawPrice <= 0n || rawConfidence < 0n) throw new Error("Pyth price must be positive and confidence non-negative");

  return {
    feedId,
    priceMicros: scaleToMicros(rawPrice, exponent),
    confidenceMicros: scaleToMicros(rawConfidence, exponent),
    publishTimeMs: publishTime * 1_000,
  };
}

export function toMarketObservation(options: {
  mint: string;
  onchainPriceMicros: bigint;
  pyth: PythPrice;
}): MarketObservation {
  if (!options.mint.trim()) throw new Error("market observation mint is required");
  if (options.onchainPriceMicros <= 0n) throw new Error("on-chain price must be positive");
  return {
    mint: options.mint,
    referenceFeedId: options.pyth.feedId,
    referencePriceMicros: options.pyth.priceMicros,
    onchainPriceMicros: options.onchainPriceMicros,
    confidenceMicros: options.pyth.confidenceMicros,
    publishTimeMs: options.pyth.publishTimeMs,
  };
}
