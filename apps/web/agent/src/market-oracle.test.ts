import assert from "node:assert/strict";
import test from "node:test";
import { PublicKey } from "@solana/web3.js";
import { payloadDigest, type OracleEvidenceV2 } from "@valuecurator/oracle-contracts";
import { readMarketOracleSelection } from "./market-oracle-config.js";
import {
  DOCUMENTED_AAPLX_MINT,
  MARKET_REFRESH_SAFEGUARDS,
  refreshMarketEvidence,
  referencePriceFromEvidence,
  type MarketRefreshConfig,
} from "./market-refresh.js";
import { createMarketSimulation } from "./market-simulation.js";

const FEED = "ab".repeat(32);
const SECRET = "test-credential-not-for-display";

function admissible(providerId: "pyth-hermes" | "pyth-pro", feedId = FEED): OracleEvidenceV2 {
  const parsed = {
    providerId,
    feedId,
    price: "343440000",
    confidence: "62170",
    publishTimeMs: 1_000,
  };
  return {
    schemaVersion: 2,
    providerId,
    feedId,
    asset: { symbol: "AAPLx", mint: DOCUMENTED_AAPLX_MINT, network: "mainnet-beta" },
    price: parsed.price,
    confidence: parsed.confidence,
    publishTimeMs: parsed.publishTimeMs,
    observedAtMs: 2_000,
    payloadDigest: payloadDigest(parsed),
    provenance: `${providerId} parsed price`,
    license: "authorized",
    simulated: false,
    disabled: false,
  };
}

function config(providerId: "pyth-hermes" | "pyth-pro" = "pyth-hermes"): MarketRefreshConfig {
  return {
    providerId,
    feedId: FEED,
    ...(providerId === "pyth-pro" ? { apiKey: SECRET } : {}),
    symbol: "AAPLx",
    xstocksApiUrl: "https://api.xstocks.fi/api/v2",
    marketRpcUrl: "https://api.mainnet-beta.solana.com",
    jupiterApiUrl: "https://api.jup.ag",
    inputMint: new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
    inputAmount: 100_000_000n,
    inputDecimals: 6,
    slippageBps: 100,
    maxAccounts: 32,
    maxPriceImpactBps: 200,
    activationGuardMs: 900_000,
    maximumPriceAgeMs: 30_000,
    maximumConfidenceBps: 100,
    maximumDeviationBps: 200,
  };
}

function asset() {
  return {
    id: "asset-aapl",
    symbol: "AAPLx",
    name: "Apple xStock",
    underlyingSymbol: "AAPL",
    solanaMint: new PublicKey(DOCUMENTED_AAPLX_MINT),
    tradingHalted: false,
    supportsAtomicSwaps: true,
  };
}

test("T01 T03 a configured Hermes provider does not require Pyth", () => {
  const selection = readMarketOracleSelection({
    KAIROS_ORACLE_PROVIDER: "pyth-hermes",
    KAIROS_ORACLE_FEED_ID: FEED,
  });
  assert.equal(selection.providerId, "pyth-hermes");
  assert.equal(selection.feedId, FEED);
  assert.equal("apiKey" in selection, false);
});

test("T02 a missing provider is an explicit configuration error", () => {
  assert.throws(
    () => readMarketOracleSelection({}),
    /Missing configuration: KAIROS_ORACLE_PROVIDER/,
  );
});

test("T04 a disabled provider is rejected", () => {
  assert.throws(
    () => readMarketOracleSelection({
      KAIROS_ORACLE_PROVIDER: "chainlink",
      KAIROS_ORACLE_FEED_ID: FEED,
    }),
    /chainlink is disabled/,
  );
});

test("T05 an incompatible feed is rejected and an unknown provider is rejected", async () => {
  assert.throws(
    () => readMarketOracleSelection({ KAIROS_ORACLE_PROVIDER: "band-oracle", KAIROS_ORACLE_FEED_ID: FEED }),
    /not a registered oracle provider/,
  );
  await assert.rejects(
    refreshMarketEvidence(config(), 2_000, {
      collect: async () => ({
        evidence: admissible("pyth-hermes", "cd".repeat(32)),
        providerId: "pyth-hermes",
        decision: { admissibility: "ADMISSIBLE", reasons: [] },
      }),
    }),
    /oracle feed does not match the configuration/,
  );
});

test("T06 a stale reference is blocked before a quote is requested", async () => {
  let quoted = false;
  await assert.rejects(
    refreshMarketEvidence(config(), 2_000, {
      collect: async () => ({
        evidence: null,
        providerId: null,
        decision: { admissibility: "INADMISSIBLE", reasons: ["market observation is stale"] },
      }),
      fetchQuote: async () => {
        quoted = true;
        throw new Error("quote should not run");
      },
    }),
    /market observation is stale/,
  );
  assert.equal(quoted, false);
});

test("T07 a non-positive price is blocked", () => {
  assert.throws(() => referencePriceFromEvidence({ price: "0", confidence: "1" }), /reference price must be positive/);
});

test("T08 absent confidence is rejected without substituting zero", () => {
  assert.throws(() => referencePriceFromEvidence({ price: "10", confidence: null }), /oracle confidence is absent/);
});

test("T09 excessive divergence is blocked", async () => {
  const result = await refreshMarketEvidence(config(), 2_000, {
    collect: async () => ({
      evidence: admissible("pyth-hermes"),
      providerId: "pyth-hermes",
      decision: { admissibility: "ADMISSIBLE", reasons: [] },
    }),
    fetchAsset: async () => asset(),
    fetchMultiplier: async () => ({
      currentMultiplierNano: 1_000_000_000n,
      newMultiplierNano: null,
      activationTimeMs: null,
      reason: null,
    }),
    readMint: async () => ({ decimals: 8 }) as Awaited<ReturnType<typeof import("@solana/spl-token").getMint>>,
    fetchQuote: async () => ({
      inputAmount: 100_000_000n,
      expectedAmountOut: 1n,
      minimumAmountOut: 1n,
      priceImpactPct: 0.25,
      routeHops: 1,
    }),
  });
  assert.equal(result.report.decision, "BLOCKED");
  assert.match(result.report.reasons.join(" "), /deviation is too high/);
});

test("T10 an unavailable Jupiter quote does not invent an executable price", async () => {
  const result = await refreshMarketEvidence(config(), 2_000, {
    collect: async () => ({
      evidence: admissible("pyth-hermes"),
      providerId: "pyth-hermes",
      decision: { admissibility: "ADMISSIBLE", reasons: [] },
    }),
    fetchAsset: async () => asset(),
    fetchMultiplier: async () => ({
      currentMultiplierNano: 1_000_000_000n,
      newMultiplierNano: null,
      activationTimeMs: null,
      reason: null,
    }),
    readMint: async () => ({ decimals: 8 }) as Awaited<ReturnType<typeof import("@solana/spl-token").getMint>>,
    fetchQuote: async () => {
      throw new Error("jupiter unavailable");
    },
  });
  assert.equal(result.report.executablePriceMicros, null);
  assert.equal(result.report.decision, "BLOCKED");
  assert.match(result.report.reasons.join(" "), /executable quote unavailable/);
});

test("T11 an unauthorized fallback is not requested", async () => {
  let requested: readonly string[] = [];
  let fallback = true;
  await refreshMarketEvidence(config(), 2_000, {
    collect: async (options) => {
      requested = options.requested;
      fallback = options.fallbackOptIn;
      return {
        evidence: admissible("pyth-hermes"),
        providerId: "pyth-hermes",
        decision: { admissibility: "ADMISSIBLE", reasons: [] },
      };
    },
    fetchAsset: async () => asset(),
    fetchMultiplier: async () => ({
      currentMultiplierNano: 1_000_000_000n,
      newMultiplierNano: null,
      activationTimeMs: null,
      reason: null,
    }),
    readMint: async () => ({ decimals: 8 }) as Awaited<ReturnType<typeof import("@solana/spl-token").getMint>>,
    fetchQuote: async () => {
      throw new Error("stop after selection");
    },
  });
  assert.deepEqual(requested, ["pyth-hermes"]);
  assert.equal(fallback, false);
});

test("T12 T13 T14 simulated scenarios stay labeled and keep their decisions", () => {
  const now = 1_700_000_000_000;
  const safe = createMarketSimulation("safe", now);
  const stale = createMarketSimulation("stale", now);
  const divergent = createMarketSimulation("divergent", now);
  assert.equal(safe.simulated, true);
  assert.equal(safe.simulationScenario, "safe");
  assert.equal(safe.source, "fixture");
  assert.equal(safe.decision, "APPROVED");
  assert.equal(stale.simulated, true);
  assert.equal(stale.decision, "BLOCKED");
  assert.match(stale.reasons.join(" "), /stale/);
  assert.equal(divergent.simulated, true);
  assert.equal(divergent.decision, "BLOCKED");
  assert.match(divergent.reasons.join(" "), /deviation/);
});

test("T15 T16 T17 the displayed source is the provider, the credential stays out, and no transaction is marked", async () => {
  const result = await refreshMarketEvidence({ ...config("pyth-pro"), feedId: "922" }, 2_000, {
    collect: async () => ({
      evidence: admissible("pyth-pro", "922"),
      providerId: "pyth-pro",
      decision: { admissibility: "ADMISSIBLE", reasons: [] },
    }),
    fetchAsset: async () => asset(),
    fetchMultiplier: async () => ({
      currentMultiplierNano: 1_000_000_000n,
      newMultiplierNano: null,
      activationTimeMs: null,
      reason: null,
    }),
    readMint: async () => ({ decimals: 8 }) as Awaited<ReturnType<typeof import("@solana/spl-token").getMint>>,
    fetchQuote: async () => {
      throw new Error("jupiter unavailable");
    },
  });
  assert.equal(result.report.source, "pyth-pro");
  assert.equal(result.report.provenance, "pyth-pro parsed price");
  assert.equal(JSON.stringify(result.report).includes(SECRET), false);
  assert.equal(result.report.transactionSubmitted, false);
  assert.equal(MARKET_REFRESH_SAFEGUARDS.transactionSubmitted, false);
  assert.equal(MARKET_REFRESH_SAFEGUARDS.transactionConstructed, false);
  assert.equal(MARKET_REFRESH_SAFEGUARDS.walletLoaded, false);
});
