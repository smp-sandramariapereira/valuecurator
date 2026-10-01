import { PublicKey } from "@solana/web3.js";
import { NextRequest, NextResponse } from "next/server";
import { createExecutionProposal } from "../../../../agent/src/execution-proposal";
import { refreshMarketEvidence } from "../../../../agent/src/market-refresh";
import {
  createMarketSimulation,
  type MarketSimulationScenario,
} from "../../../../agent/src/market-simulation";
import { DEFAULT_PYTH_PRO_URL } from "../../../../agent/src/pyth-pro";
import { DEFAULT_XSTOCKS_API_URL } from "../../../../agent/src/xstocks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_MAINNET_RPC_URL = "https://api.mainnet-beta.solana.com";
const MAINNET_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 6;

type MarketScenario = "live" | MarketSimulationScenario;

const requestWindows = new Map<string, { startedAt: number; count: number }>();
let liveInFlight: Promise<Awaited<ReturnType<typeof buildPayload>>> | null = null;

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing configuration: ${name}`);
  return value;
}

function boundedInt(name: string, fallback: number, min: number, max: number): number {
  const value = Number.parseInt(process.env[name] ?? String(fallback), 10);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be between ${min} and ${max}`);
  }
  return value;
}

function positiveBigInt(name: string, fallback: string): bigint {
  const raw = process.env[name]?.trim() || fallback;
  if (!/^\d+$/.test(raw) || BigInt(raw) <= 0n) {
    throw new Error(`${name} must be a positive integer`);
  }
  return BigInt(raw);
}

function boundedMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, " ").slice(0, 240);
}

function clientKey(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const expectedHost = forwardedHost || request.headers.get("host");
  if (!expectedHost) return false;
  try {
    return new URL(origin).host === expectedHost;
  } catch {
    return false;
  }
}

function withinRateLimit(request: NextRequest): boolean {
  const key = clientKey(request);
  const now = Date.now();
  const window = requestWindows.get(key);
  if (!window || now - window.startedAt >= RATE_WINDOW_MS) {
    requestWindows.set(key, { startedAt: now, count: 1 });
    return true;
  }
  if (window.count >= RATE_LIMIT) return false;
  window.count += 1;
  return true;
}

async function buildPayload(
  scenario: MarketScenario,
  limits?: {
    maximumPriceAgeMs: number;
    maximumConfidenceBps: number;
    maximumDeviationBps: number;
    maximumPriceImpactBps: number;
  },
) {
  const evidence = scenario === "live"
    ? (await refreshMarketEvidence({
    feedId: required("KAIROS_PYTH_FEED_ID"),
    pythApiKey: required("KAIROS_PYTH_API_KEY"),
    pythApiUrl: process.env.KAIROS_PYTH_API_URL?.trim() || DEFAULT_PYTH_PRO_URL,
    xstocksApiUrl: process.env.KAIROS_XSTOCKS_API_URL?.trim() || DEFAULT_XSTOCKS_API_URL,
    symbol: process.env.KAIROS_XSTOCK_SYMBOL?.trim() || "AAPLx",
    marketRpcUrl: process.env.KAIROS_MARKET_RPC_URL?.trim() || DEFAULT_MAINNET_RPC_URL,
    jupiterApiUrl: process.env.KAIROS_JUPITER_API_URL?.trim() || "https://api.jup.ag",
    ...(process.env.KAIROS_JUPITER_API_KEY?.trim()
      ? { jupiterApiKey: process.env.KAIROS_JUPITER_API_KEY.trim() }
      : {}),
    inputMint: new PublicKey(process.env.KAIROS_QUOTE_INPUT_MINT?.trim() || MAINNET_USDC_MINT),
    inputAmount: positiveBigInt("KAIROS_QUOTE_INPUT_AMOUNT", "100000000"),
    inputDecimals: boundedInt("KAIROS_QUOTE_INPUT_DECIMALS", 6, 0, 18),
    slippageBps: boundedInt("KAIROS_STRATEGY_SLIPPAGE_BPS", 100, 1, 10_000),
    maxAccounts: boundedInt("KAIROS_STRATEGY_MAX_ACCOUNTS", 32, 1, 64),
    maxPriceImpactBps: limits?.maximumPriceImpactBps ??
      boundedInt("KAIROS_MARKET_MAX_PRICE_IMPACT_BPS", 200, 0, 10_000),
    activationGuardMs: boundedInt("KAIROS_MULTIPLIER_ACTIVATION_GUARD_MS", 900_000, 0, 86_400_000),
    maximumPriceAgeMs: limits?.maximumPriceAgeMs ??
      boundedInt("KAIROS_MARKET_MAX_PRICE_AGE_MS", 30_000, 1_000, 300_000),
    maximumConfidenceBps: limits?.maximumConfidenceBps ??
      boundedInt("KAIROS_MARKET_MAX_CONFIDENCE_BPS", 100, 0, 10_000),
    maximumDeviationBps: limits?.maximumDeviationBps ??
      boundedInt("KAIROS_MARKET_MAX_DEVIATION_BPS", 200, 0, 10_000),
      })).report
    : createMarketSimulation(scenario, Date.now(), limits);
  const requiredApprover = process.env.KAIROS_NODE_OWNER?.trim() ||
    process.env.NEXT_PUBLIC_NODE_OWNER?.trim() || null;
  const proposal = createExecutionProposal({
    evidence,
    ...(requiredApprover ? { requiredApprover } : {}),
  });

  return {
    schemaVersion: 1 as const,
    scenario,
    refreshedAt: new Date().toISOString(),
    evidence,
    proposal,
    safeguards: {
      walletLoaded: false as const,
      transactionConstructed: false as const,
      transactionSubmitted: false as const,
    },
  };
}

type GateMandateLimits = {
  maximumPriceAgeMs: number;
  maximumConfidenceBps: number;
  maximumDeviationBps: number;
  maximumPriceImpactBps: number;
};

function integerInRange(value: unknown, minimum: number, maximum: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error("Mandate limit is outside the allowed range.");
  }
  return value;
}

function readMandate(body: unknown): GateMandateLimits | undefined {
  if (!body || typeof body !== "object" || Array.isArray(body)) return undefined;
  const mandate = (body as { mandate?: unknown }).mandate;
  if (mandate === undefined) return undefined;
  if (!mandate || typeof mandate !== "object" || Array.isArray(mandate)) {
    throw new Error("Invalid mandate limits.");
  }
  const record = mandate as Record<string, unknown>;
  return {
    maximumPriceAgeMs: integerInRange(record.maximumPriceAgeMs, 1_000, 300_000),
    maximumConfidenceBps: integerInRange(record.maximumConfidenceBps, 0, 1_000),
    maximumDeviationBps: integerInRange(record.maximumDeviationBps, 0, 2_000),
    maximumPriceImpactBps: integerInRange(record.maximumPriceImpactBps, 0, 1_000),
  };
}

async function requestedRefresh(request: NextRequest): Promise<{
  scenario: MarketScenario;
  limits?: GateMandateLimits;
}> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new Error("Invalid JSON body.");
  }
  const scenario = body && typeof body === "object" && !Array.isArray(body)
    ? (body as { scenario?: unknown }).scenario
    : undefined;
  const limits = readMandate(body);
  if (scenario === undefined || scenario === "live") return { scenario: "live", limits };
  if (scenario === "safe" || scenario === "stale" || scenario === "divergent") return { scenario, limits };
  throw new Error("Invalid scenario.");
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "Unauthorized origin." }, { status: 403 });
  }

  let refreshRequest: { scenario: MarketScenario; limits?: GateMandateLimits };
  try {
    refreshRequest = await requestedRefresh(request);
  } catch (error) {
    return NextResponse.json(
      { error: boundedMessage(error) },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (refreshRequest.scenario === "live" && !withinRateLimit(request)) {
    return NextResponse.json(
      { error: "Refresh rate limit reached. Wait one minute." },
      { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": "60" } },
    );
  }

  const { scenario, limits } = refreshRequest;

  try {
    let payload: Awaited<ReturnType<typeof buildPayload>>;
    if (scenario === "live" && !limits) {
      liveInFlight ??= buildPayload("live").finally(() => {
        liveInFlight = null;
      });
      payload = await liveInFlight;
    } else {
      payload = await buildPayload(scenario, limits);
    }
    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: boundedMessage(error) },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
