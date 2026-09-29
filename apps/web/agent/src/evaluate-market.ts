import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadMarketFixture, evaluateMarketFixture } from "./market-fixture.js";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function usd(micros: string): string {
  const value = BigInt(micros);
  return `${value / 1_000_000n}.${(value % 1_000_000n).toString().padStart(6, "0")}`;
}

function writeAtomically(path: string, body: string): void {
  const destination = resolve(path);
  mkdirSync(dirname(destination), { recursive: true });
  const temporary = `${destination}.tmp-${process.pid}`;
  writeFileSync(temporary, body, { encoding: "utf8", mode: 0o600 });
  renameSync(temporary, destination);
}

const fixturePath = argument("--fixture") ?? "fixtures/aapl-valid.json";
const outputPath = argument("--output");
const fixture = loadMarketFixture(fixturePath);
const { report } = evaluateMarketFixture({ fixture });

console.log("Mode: SIMULATION");
console.log(`Source: ${report.source.toUpperCase()} (not live market data)`);
console.log(`Asset: ${report.symbol}`);
console.log(`Reference feed: ${report.referenceFeedId}`);
console.log(`Reference price: $${usd(report.referencePriceMicros)}`);
console.log(`Executable price: $${usd(report.executablePriceMicros)}`);
console.log(`Price age: ${report.priceAgeMs} ms / limit ${report.maximumPriceAgeMs} ms`);
console.log(`Confidence: ${report.confidenceBps} bps / limit ${report.maximumConfidenceBps} bps`);
console.log(`Deviation: ${report.deviationBps} bps / limit ${report.maximumDeviationBps} bps`);
console.log(`Decision: ${report.decision}`);
if (report.reasons.length > 0) console.log(`Reasons: ${report.reasons.join("; ")}`);
console.log("Transaction submitted: NO");

if (outputPath) {
  writeAtomically(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Report: ${resolve(outputPath)}`);
}
