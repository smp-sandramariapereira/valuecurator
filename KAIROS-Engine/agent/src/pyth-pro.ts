import type { PythPrice } from "./pyth.js";

export const DEFAULT_PYTH_PRO_URL = "https://pyth-lazer.dourolabs.app";

export type PythProChannel =
  | "real_time"
  | "fixed_rate@50ms"
  | "fixed_rate@200ms"
  | "fixed_rate@1000ms";

type UnknownRecord = Record<string, unknown>;

function record(value: unknown, label: string): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`invalid ${label}`);
  }
  return value as UnknownRecord;
}

function integer(value: unknown, label: string): bigint {
  if (typeof value === "string" && /^-?\d+$/.test(value)) return BigInt(value);
  if (typeof value === "number" && Number.isSafeInteger(value)) return BigInt(value);
  throw new Error(`invalid ${label}`);
}

function safeInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new Error(`invalid ${label}`);
  }
  return value;
}

function normalizeFeedId(feedId: string): string {
  const normalized = feedId.trim();
  if (!/^\d+$/.test(normalized)) throw new Error("Pyth Pro feed id must be numeric");
  const parsed = BigInt(normalized);
  if (parsed < 0n || parsed > 4_294_967_295n) {
    throw new Error("Pyth Pro feed id must fit in an unsigned 32-bit integer");
  }
  return parsed.toString();
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

function microsToMillis(value: bigint): number {
  const milliseconds = value / 1_000n;
  if (milliseconds < 0n || milliseconds > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("invalid Pyth Pro publish time");
  }
  return Number(milliseconds);
}

export async function fetchPythProPrice(options: {
  feedId: string;
  apiKey: string;
  apiUrl?: string;
  channel?: PythProChannel;
  signal?: AbortSignal;
}): Promise<PythPrice> {
  const feedId = normalizeFeedId(options.feedId);
  const apiKey = options.apiKey.trim();
  if (!apiKey) throw new Error("Pyth Pro API key is required");

  const apiUrl = new URL(options.apiUrl ?? DEFAULT_PYTH_PRO_URL);
  if (apiUrl.protocol !== "https:" && apiUrl.hostname !== "localhost" && apiUrl.hostname !== "127.0.0.1") {
    throw new Error("Pyth Pro API must use HTTPS");
  }
  apiUrl.pathname = apiUrl.pathname.replace(/\/+$/, "") + "/";
  const url = new URL("v1/latest_price", apiUrl);
  const headers = {
    accept: "application/json",
    authorization: `Bearer ${apiKey}`,
    "content-type": "application/json",
  };
  const requestInit: RequestInit = {
    method: "POST",
    headers,
    body: JSON.stringify({
      priceFeedIds: [Number(feedId)],
      properties: ["price", "confidence", "exponent", "feedUpdateTimestamp", "publisherCount", "marketSession"],
      formats: ["solana"],
      channel: options.channel ?? "fixed_rate@1000ms",
      parsed: true,
      jsonBinaryEncoding: "hex",
    }),
  };
  if (options.signal) requestInit.signal = options.signal;

  const response = await fetch(url, requestInit);
  if (!response.ok) {
    const body = (await response.text()).slice(0, 240);
    throw new Error(`Pyth Pro price request failed (${response.status}): ${body}`);
  }

  const body = record(await response.json(), "Pyth Pro response");
  const parsed = record(body.parsed, "Pyth Pro parsed payload");
  if (!Array.isArray(parsed.priceFeeds) || parsed.priceFeeds.length !== 1) {
    throw new Error("Pyth Pro response must contain exactly one parsed feed");
  }
  const priceFeed = record(parsed.priceFeeds[0], "Pyth Pro price feed");
  const returnedFeedId = integer(priceFeed.priceFeedId, "Pyth Pro returned feed id").toString();
  if (returnedFeedId !== feedId) throw new Error("Pyth Pro returned an unexpected feed");

  const rawPrice = integer(priceFeed.price, "Pyth Pro price");
  const rawConfidence = integer(priceFeed.confidence, "Pyth Pro confidence");
  const exponent = safeInteger(priceFeed.exponent, "Pyth Pro exponent");
  const updateTimestamp = priceFeed.feedUpdateTimestamp ?? parsed.timestampUs;
  const publishTimeMs = microsToMillis(integer(updateTimestamp, "Pyth Pro feed update timestamp"));
  if (rawPrice <= 0n || rawConfidence < 0n) {
    throw new Error("Pyth Pro price must be positive and confidence non-negative");
  }

  return {
    feedId,
    priceMicros: scaleToMicros(rawPrice, exponent),
    confidenceMicros: scaleToMicros(rawConfidence, exponent),
    publishTimeMs,
  };
}
