import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { TelemetryEvent } from "./telemetry.js";

export type ShadowReport = {
  decisions: number;
  execute: number;
  defer: number;
  averageConfidence: number;
  executionsSucceeded: number;
  executionsFailed: number;
  executionsDeferred: number;
  modelVersions: Record<string, number>;
};

export function evaluateJsonLines(contents: string): ShadowReport {
  const events = contents.split("\n").filter(Boolean).map((line, index) => {
    try {
      return JSON.parse(line) as TelemetryEvent;
    } catch {
      throw new Error(`Invalid telemetry JSON at line ${index + 1}`);
    }
  });
  const decisions = events.filter((event): event is Extract<TelemetryEvent, { type: "ai_decision" }> =>
    event.type === "ai_decision");
  const executions = events.filter((event): event is Extract<TelemetryEvent, { type: "execution" }> =>
    event.type === "execution");
  const modelVersions: Record<string, number> = {};
  for (const decision of decisions) {
    modelVersions[decision.modelVersion] = (modelVersions[decision.modelVersion] ?? 0) + 1;
  }
  return {
    decisions: decisions.length,
    execute: decisions.filter((event) => event.decision === "execute").length,
    defer: decisions.filter((event) => event.decision === "defer").length,
    averageConfidence: decisions.length === 0
      ? 0
      : decisions.reduce((total, event) => total + event.confidence, 0) / decisions.length,
    executionsSucceeded: executions.filter((event) => event.status === "succeeded").length,
    executionsFailed: executions.filter((event) => event.status === "failed").length,
    executionsDeferred: executions.filter((event) => event.status === "deferred").length,
    modelVersions,
  };
}

if (process.argv[1] && import.meta.url === new URL(`file://${resolve(process.argv[1])}`).href) {
  const path = resolve(process.argv[2] ?? "data/decisions.jsonl");
  console.log(JSON.stringify(evaluateJsonLines(readFileSync(path, "utf8")), null, 2));
}
