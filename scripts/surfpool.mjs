#!/usr/bin/env node
/**
 * ValueCurator Surfpool runner.
 *
 * Starts either a local offline simulator or a Devnet-backed simulator with
 * auto-deploy DISABLED. The devnet-check profile sends a read-only RPC request.
 * Never changes ~/.config/solana/cli/config.yml or handles signing keys.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { DEVNET_RPC, rpcEndpoint, rpcRequest, surfpoolArgs } from "./surfpool-profiles.mjs";

async function rpcStatus(profile) {
  const url = rpcEndpoint(profile);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(rpcRequest("getVersion")),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
    const payload = await response.json();
    if (payload.error || !payload.result?.["solana-core"]) {
      throw new Error(`RPC returned an invalid getVersion response: ${JSON.stringify(payload.error ?? payload.result)}`);
    }
    process.stdout.write(`${profile}: ${url} — Solana ${payload.result["solana-core"]} (read-only RPC)\n`);
  } finally {
    clearTimeout(timeout);
  }
}

export async function main(argv = process.argv.slice(2)) {
  const [profile, ...extras] = argv;
  if (extras.length || !["local", "devnet-fork", "devnet-check", "local-check"].includes(profile)) {
    process.stderr.write(
      "Usage: node scripts/surfpool.mjs <local|devnet-fork|local-check|devnet-check>\n" +
      "  local          start isolated offline Surfpool (no auto-deploy)\n" +
      "  devnet-fork    start Surfpool with Devnet datasource (no auto-deploy)\n" +
      "  local-check   read-only health check for 127.0.0.1:8899\n" +
      "  devnet-check  read-only health check for the PUBLIC Devnet RPC\n"
    );
    process.exitCode = 2;
    return;
  }
  if (profile.endsWith("-check")) {
    try {
      await rpcStatus(profile === "devnet-check" ? "devnet" : "local");
    } catch (error) {
      process.stderr.write(`RPC check failed: ${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    }
    return;
  }

  const args = surfpoolArgs(profile);
  process.stdout.write(`Starting Surfpool ${profile} on ${rpcEndpoint(profile)}\n`);
  process.stdout.write("No automatic program deployment. Ctrl+C to stop.\n");
  const result = spawnSync("surfpool", args, {
    stdio: "inherit", env: { ...process.env, NO_DNA: "1" },
  });
  if (result.error) {
    process.stderr.write(`Could not start Surfpool: ${result.error.message}\n`);
    process.exitCode = 1;
  } else if (result.signal) {
    process.exitCode = result.signal === "SIGINT" ? 0 : 1;
  } else {
    process.exitCode = result.status ?? 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(new URL(`file://${process.argv[1].startsWith("/") ? "" : process.cwd() + "/"}${process.argv[1]}`))) {
  await main();
}
