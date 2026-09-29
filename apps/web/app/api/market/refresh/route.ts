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

async function buildPayload(scenario: MarketScenario) {
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
    maxPriceImpactBps: boundedInt("KAIROS_MARKET_MAX_PRICE_IMPACT_BPS", 200, 0, 10_000),
    activationGuardMs: boundedInt("KAIROS_MULTIPLIER_ACTIVATION_GUARD_MS", 900_000, 0, 86_400_000),
    maximumPriceAgeMs: boundedInt("KAIROS_MARKET_MAX_PRICE_AGE_MS", 30_000, 1_000, 300_000),
    maximumConfidenceBps: boundedInt("KAIROS_MARKET_MAX_CONFIDENCE_BPS", 100, 0, 10_000),
    maximumDeviationBps: boundedInt("KAIROS_MARKET_MAX_DEVIATION_BPS", 200, 0, 10_000),
      })).report
    : createMarketSimulation(scenario);
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

async function requestedScenario(request: NextRequest): Promise<MarketScenario> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new Error("Invalid JSON body.");
  }
  const scenario = body && typeof body === "object" && !Array.isArray(body)
    ? (body as { scenario?: unknown }).scenario
    : undefined;
  if (scenario === undefined || scenario === "live") return "live";
  if (scenario === "safe" || scenario === "stale" || scenario === "divergent") return scenario;
  throw new Error("Invalid scenario.");
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "Unauthorized origin." }, { status: 403 });
  }
  if (!withinRateLimit(request)) {
    return NextResponse.json(
      { error: "Refresh rate limit reached. Wait one minute." },
      { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": "60" } },
    );
  }

  let scenario: MarketScenario;
  try {
    scenario = await requestedScenario(request);
  } catch (error) {
    return NextResponse.json(
      { error: boundedMessage(error) },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    let payload: Awaited<ReturnType<typeof buildPayload>>;
    if (scenario === "live") {
      liveInFlight ??= buildPayload("live").finally(() => {
        liveInFlight = null;
      });
      payload = await liveInFlight;
    } else {
      payload = await buildPayload(scenario);
    }
    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: boundedMessage(error) },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
