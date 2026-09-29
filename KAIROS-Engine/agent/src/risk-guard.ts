import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export type RiskLimits = {
  statePath: string;
  maxSwapAmount: bigint;
  maxDailyInput: bigint;
  maxConsecutiveFailures: number;
  cooldownMs: number;
};

type RiskState = {
  dateUtc: string;
  dailyInput: string;
  consecutiveFailures: number;
  circuitOpenUntil: number;
};

function utcDate(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

export class ExecutionGuard {
  private state: RiskState;

  constructor(private readonly limits: RiskLimits, now = Date.now()) {
    if (limits.maxSwapAmount <= 0n || limits.maxDailyInput < limits.maxSwapAmount) {
      throw new Error("Risk limits require 0 < maxSwapAmount <= maxDailyInput");
    }
    if (!Number.isInteger(limits.maxConsecutiveFailures) || limits.maxConsecutiveFailures < 1) {
      throw new Error("maxConsecutiveFailures must be a positive integer");
    }
    if (!Number.isInteger(limits.cooldownMs) || limits.cooldownMs < 1_000) {
      throw new Error("cooldownMs must be at least 1000");
    }
    this.state = this.load(now);
  }

  assertCanAttempt(amount: bigint, now = Date.now()): void {
    this.rollDay(now);
    if (amount <= 0n) throw new Error("Swap amount must be positive");
    if (amount > this.limits.maxSwapAmount) throw new Error("Swap exceeds KAIROS_MAX_SWAP_AMOUNT");
    if (BigInt(this.state.dailyInput) + amount > this.limits.maxDailyInput) {
      throw new Error("Swap exceeds KAIROS_MAX_DAILY_INPUT");
    }
    if (now < this.state.circuitOpenUntil) {
      throw new Error(`Circuit breaker open until ${new Date(this.state.circuitOpenUntil).toISOString()}`);
    }
  }

  recordSuccess(amount: bigint, now = Date.now()): void {
    this.assertCanAttempt(amount, now);
    this.state.dailyInput = (BigInt(this.state.dailyInput) + amount).toString();
    this.state.consecutiveFailures = 0;
    this.state.circuitOpenUntil = 0;
    this.persist();
  }

  recordFailure(now = Date.now()): void {
    this.rollDay(now);
    this.state.consecutiveFailures += 1;
    if (this.state.consecutiveFailures >= this.limits.maxConsecutiveFailures) {
      this.state.circuitOpenUntil = now + this.limits.cooldownMs;
    }
    this.persist();
  }

  snapshot(): Readonly<RiskState> {
    return { ...this.state };
  }

  private rollDay(now: number): void {
    const date = utcDate(now);
    if (this.state.dateUtc !== date) {
      this.state = { dateUtc: date, dailyInput: "0", consecutiveFailures: 0, circuitOpenUntil: 0 };
      this.persist();
    }
  }

  private load(now: number): RiskState {
    try {
      const parsed = JSON.parse(readFileSync(this.limits.statePath, "utf8")) as Partial<RiskState>;
      if (typeof parsed.dateUtc !== "string" || typeof parsed.dailyInput !== "string" ||
          !/^\d+$/.test(parsed.dailyInput) || !Number.isInteger(parsed.consecutiveFailures) ||
          !Number.isFinite(parsed.circuitOpenUntil)) throw new Error("invalid fields");
      return {
        dateUtc: parsed.dateUtc,
        dailyInput: parsed.dailyInput,
        consecutiveFailures: parsed.consecutiveFailures!,
        circuitOpenUntil: parsed.circuitOpenUntil!,
      };
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
      if (code !== "ENOENT") throw new Error(`Cannot load risk state: ${error instanceof Error ? error.message : String(error)}`);
      return { dateUtc: utcDate(now), dailyInput: "0", consecutiveFailures: 0, circuitOpenUntil: 0 };
    }
  }

  private persist(): void {
    const directory = dirname(this.limits.statePath);
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const temp = `${this.limits.statePath}.tmp`;
    writeFileSync(temp, `${JSON.stringify(this.state)}\n`, { encoding: "utf8", mode: 0o600 });
    renameSync(temp, this.limits.statePath);
  }
}
