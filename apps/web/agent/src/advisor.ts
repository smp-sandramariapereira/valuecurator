export type AIMode = "off" | "shadow" | "enforce";

export type StrategyFeatures = {
  inputMint: string;
  outputMint: string;
  amountIn: string;
  expectedAmountOut: string;
  minimumAmountOut: string;
  priceImpactPct: number;
  routeHops: number;
  slippageBps: number;
};

export type StrategyDecision = {
  decision: "execute" | "defer";
  confidence: number;
  reason: string;
  modelVersion: string;
};

function parseDecision(value: unknown): StrategyDecision {
  if (!value || typeof value !== "object") throw new Error("AI response must be an object");
  const candidate = value as Record<string, unknown>;
  if (candidate.decision !== "execute" && candidate.decision !== "defer") {
    throw new Error("AI decision must be execute or defer");
  }
  if (
    typeof candidate.confidence !== "number" ||
    !Number.isFinite(candidate.confidence) ||
    candidate.confidence < 0 ||
    candidate.confidence > 1
  ) {
    throw new Error("AI confidence must be between 0 and 1");
  }
  if (typeof candidate.reason !== "string" || candidate.reason.length < 1 || candidate.reason.length > 240) {
    throw new Error("AI reason must contain 1 to 240 characters");
  }
  if (typeof candidate.modelVersion !== "string" || candidate.modelVersion.length < 1) {
    throw new Error("AI modelVersion is required");
  }
  return candidate as StrategyDecision;
}

export async function requestStrategyDecision(params: {
  endpoint: string;
  apiKey: string | undefined;
  timeoutMs: number;
  features: StrategyFeatures;
}): Promise<StrategyDecision> {
  const url = new URL(params.endpoint);
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("AI endpoint must use HTTPS outside localhost");
  }

  const headers: Record<string, string> = { "content-type": "application/json" };
  if (params.apiKey) headers.authorization = `Bearer ${params.apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      schemaVersion: 1,
      task: "kairos_strategy_execution",
      features: params.features,
    }),
    signal: AbortSignal.timeout(params.timeoutMs),
  });
  const body: unknown = await response.json();
  if (!response.ok) {
    throw new Error(`AI advisor failed (${response.status})`);
  }
  return parseDecision(body);
}

export function applyDecisionPolicy(
  mode: AIMode,
  minimumConfidence: number,
  decision: StrategyDecision,
): boolean {
  if (mode === "off" || mode === "shadow") return true;
  return decision.decision === "execute" && decision.confidence >= minimumConfidence;
}
