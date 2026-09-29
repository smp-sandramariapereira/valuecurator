import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export type TelemetryEvent =
  | {
      type: "market_evidence";
      correlationId: string;
      timestamp: string;
      mint: string;
      referenceFeedId: string;
      referencePriceMicros: string;
      executablePriceMicros: string;
      confidenceMicros: string;
      publishTimeMs: number;
      allowed: boolean;
      reasons: readonly string[];
    }
  | {
      type: "ai_decision";
      correlationId: string;
      timestamp: string;
      mode: "shadow" | "enforce";
      modelVersion: string;
      decision: "execute" | "defer";
      confidence: number;
      reason: string;
      amountIn: string;
      expectedAmountOut: string;
      priceImpactPct: number;
      routeHops: number;
    }
  | {
      type: "execution";
      correlationId: string;
      timestamp: string;
      status: "succeeded" | "failed" | "deferred";
      amountIn: string;
      minimumAmountOut: string;
      signature?: string;
      slot?: number;
      error?: string;
    };

export function appendTelemetry(path: string, event: TelemetryEvent): void {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  appendFileSync(path, `${JSON.stringify(event)}\n`, { encoding: "utf8", mode: 0o600 });
}
