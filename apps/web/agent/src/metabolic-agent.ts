import { AnchorProvider, BN, Program, Wallet } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAccount,
  getMint,
  getOrCreateAssociatedTokenAccount,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Connection, Keypair, PublicKey, type TransactionSignature } from "@solana/web3.js";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { confirmOnDevnet } from "./confirm.js";
import { loadConfig, type AgentConfig } from "./config.js";
import { findNodePda } from "./pda.js";
import { JUPITER_V6_PROGRAM_ID, buildJupiterSwap } from "./jupiter.js";
import { applyDecisionPolicy, requestStrategyDecision } from "./advisor.js";
import { ExecutionGuard } from "./risk-guard.js";
import { appendTelemetry } from "./telemetry.js";
import { buildGuardedMarketObservation } from "./market-data.js";
import { evaluateMarketObservation } from "./policy.js";

const idl = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../idl/kairos_engine.json", import.meta.url)), "utf8"),
) as any;

type NodeAccount = {
  owner: PublicKey;
  operator: PublicKey;
  infrastructureFeeBps: number;
  totalMetabolized: BN;
  treasuryPubkey: PublicKey;
  strategyMint: PublicKey;
  bump: number;
};

function loadOperatorKey(path: string): Keypair {
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (!Array.isArray(parsed) || !parsed.every((n) => typeof n === "number")) {
      throw new Error("expected a JSON array of secret-key bytes");
    }
    return Keypair.fromSecretKey(Uint8Array.from(parsed));
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`Cannot read operator key at ${path}: ${reason}`);
  }
}

function tokenAta(mint: PublicKey, owner: PublicKey, allowOffCurve: boolean): PublicKey {
  return getAssociatedTokenAddressSync(
    mint, owner, allowOffCurve, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
  );
}

async function readAmount(connection: Connection, ata: PublicKey): Promise<bigint> {
  const account = await getAccount(connection, ata, "confirmed", TOKEN_2022_PROGRAM_ID);
  return account.amount;
}

async function confirmRpc(
  connection: Connection,
  send: () => Promise<TransactionSignature>,
): Promise<{ signature: TransactionSignature; slot: number }> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const signature = await send();
  const { slot } = await confirmOnDevnet(
    connection, signature, blockhash, lastValidBlockHeight, "confirmed",
  );
  return { signature, slot };
}

async function metabolize(
  program: Program<any>,
  connection: Connection,
  operator: PublicKey,
  owner: PublicKey,
  mint: PublicKey,
  nodePda: PublicKey,
  node: NodeAccount,
  amount: bigint,
): Promise<void> {
  const sourceToken = tokenAta(mint, operator, false);
  const vaultToken = tokenAta(mint, nodePda, true);
  const treasuryToken = tokenAta(mint, node.treasuryPubkey, false);

  const { signature, slot } = await confirmRpc(connection, () =>
    (program.methods as any)
      .metabolizeYield(new BN(amount.toString()))
      .accountsPartial({
        operator,
        owner,
        node: nodePda,
        treasuryPubkey: node.treasuryPubkey,
        mint,
        sourceToken,
        vaultToken,
        treasuryToken,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .rpc({ commitment: "confirmed", skipPreflight: false }),
  );
  console.log(`[kairos] metabolized signature=${signature} slot=${slot} amount=${amount}`);
}

async function flushVaultThroughStrategy(
  program: Program<any>,
  connection: Connection,
  operatorKey: Keypair,
  config: AgentConfig,
  nodePda: PublicKey,
  node: NodeAccount,
  guard: ExecutionGuard,
): Promise<void> {
  const inputVault = tokenAta(config.mint, nodePda, true);
  const amount = await readAmount(connection, inputVault);
  if (amount === 0n) return;
  guard.assertCanAttempt(amount);
  const correlationId = randomUUID();

  // strategyMint is retained in the v1 account layout but now represents
  // the allowlisted output mint for the executable strategy.
  const outputMint = node.strategyMint;
  const mintInfo = await connection.getAccountInfo(outputMint, "confirmed");
  if (!mintInfo) throw new Error("Configured strategy output mint does not exist");
  const outputTokenProgram = mintInfo.owner;
  if (!outputTokenProgram.equals(TOKEN_PROGRAM_ID) && !outputTokenProgram.equals(TOKEN_2022_PROGRAM_ID)) {
    throw new Error("Configured strategy output mint has an unsupported token program");
  }

  const outputVault = (await getOrCreateAssociatedTokenAccount(
    connection,
    operatorKey,
    outputMint,
    nodePda,
    true,
    "confirmed",
    undefined,
    outputTokenProgram,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )).address;

  const swap = await buildJupiterSwap({
    apiUrl: config.jupiterApiUrl,
    apiKey: config.jupiterApiKey,
    inputMint: config.mint,
    outputMint,
    userPublicKey: nodePda,
    amount,
    slippageBps: config.strategySlippageBps,
    maxAccounts: config.strategyMaxAccounts,
  });

  const [inputMintInfo, outputMintInfo] = await Promise.all([
    getMint(connection, config.mint, "confirmed", TOKEN_2022_PROGRAM_ID),
    getMint(connection, outputMint, "confirmed", outputTokenProgram),
  ]);
  const observation = await buildGuardedMarketObservation({
    symbol: config.xstockSymbol,
    expectedMint: outputMint,
    pythFeedId: config.pythFeedId,
    usdInputAmount: amount,
    assetOutputAmount: swap.expectedAmountOut,
    usdDecimals: inputMintInfo.decimals,
    assetDecimals: outputMintInfo.decimals,
    xstocksApiUrl: config.xstocksApiUrl,
    pythApiUrl: config.pythHermesUrl,
    pythApiKey: config.pythApiKey,
  });
  const marketDecision = evaluateMarketObservation({
    asset: {
      mint: outputMint.toBase58(),
      referenceFeedId: observation.referenceFeedId,
      targetAllocationBps: 10_000,
      maxAllocationBps: 10_000,
      maxPriceDeviationBps: config.marketMaxDeviationBps,
    },
    observation,
    maxPriceAgeMs: config.marketMaxPriceAgeMs,
    maxConfidenceBps: config.marketMaxConfidenceBps,
  });
  appendTelemetry(config.telemetryPath, {
    type: "market_evidence", correlationId, timestamp: new Date().toISOString(),
    mint: observation.mint, referenceFeedId: observation.referenceFeedId,
    referencePriceMicros: observation.referencePriceMicros.toString(),
    executablePriceMicros: observation.onchainPriceMicros.toString(),
    confidenceMicros: observation.confidenceMicros.toString(),
    publishTimeMs: observation.publishTimeMs, allowed: marketDecision.allowed,
    reasons: marketDecision.reasons,
  });
  if (!marketDecision.allowed) {
    throw new Error(`Market policy blocked execution: ${marketDecision.reasons.join("; ")}`);
  }

  if (config.aiMode !== "off") {
    try {
      const decision = await requestStrategyDecision({
        endpoint: config.aiEndpoint!,
        apiKey: config.aiApiKey,
        timeoutMs: config.aiTimeoutMs,
        features: {
          inputMint: config.mint.toBase58(),
          outputMint: outputMint.toBase58(),
          amountIn: amount.toString(),
          expectedAmountOut: swap.expectedAmountOut.toString(),
          minimumAmountOut: swap.minimumAmountOut.toString(),
          priceImpactPct: swap.priceImpactPct,
          routeHops: swap.routeHops,
          slippageBps: config.strategySlippageBps,
        },
      });
      console.log(
        `[kairos] ai mode=${config.aiMode} decision=${decision.decision} confidence=${decision.confidence} model=${decision.modelVersion} reason=${decision.reason}`,
      );
      appendTelemetry(config.telemetryPath, {
        type: "ai_decision", correlationId, timestamp: new Date().toISOString(),
        mode: config.aiMode, modelVersion: decision.modelVersion, decision: decision.decision,
        confidence: decision.confidence, reason: decision.reason, amountIn: amount.toString(),
        expectedAmountOut: swap.expectedAmountOut.toString(), priceImpactPct: swap.priceImpactPct,
        routeHops: swap.routeHops,
      });
      if (!applyDecisionPolicy(config.aiMode, config.aiMinimumConfidence, decision)) {
        appendTelemetry(config.telemetryPath, {
          type: "execution", correlationId, timestamp: new Date().toISOString(), status: "deferred",
          amountIn: amount.toString(), minimumAmountOut: swap.minimumAmountOut.toString(),
        });
        return;
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      if (config.aiMode === "enforce") throw new Error(`AI decision failed closed: ${reason}`);
      console.warn(`[kairos] shadow AI unavailable; execution unaffected: ${reason}`);
    }
  }

  try {
    const { signature, slot } = await confirmRpc(connection, () =>
      (program.methods as any)
        .executeStrategySwap(
          swap.instructionData,
          new BN(amount.toString()),
          new BN(swap.minimumAmountOut.toString()),
        )
        .accountsPartial({
          operator: operatorKey.publicKey, owner: config.nodeOwner, node: nodePda,
          inputMint: config.mint, outputMint, inputVault, outputVault,
          inputTokenProgram: TOKEN_2022_PROGRAM_ID, outputTokenProgram,
          jupiterProgram: JUPITER_V6_PROGRAM_ID,
        })
        .remainingAccounts(swap.remainingAccounts)
        .rpc({ commitment: "confirmed", skipPreflight: false }),
    );
    guard.recordSuccess(amount);
    appendTelemetry(config.telemetryPath, {
      type: "execution", correlationId, timestamp: new Date().toISOString(), status: "succeeded",
      amountIn: amount.toString(), minimumAmountOut: swap.minimumAmountOut.toString(), signature, slot,
    });
    console.log(
      `[kairos] strategy swap signature=${signature} slot=${slot} input=${amount} minOutput=${swap.minimumAmountOut}`,
    );
  } catch (error) {
    guard.recordFailure();
    const reason = error instanceof Error ? error.message : String(error);
    appendTelemetry(config.telemetryPath, {
      type: "execution", correlationId, timestamp: new Date().toISOString(), status: "failed",
      amountIn: amount.toString(), minimumAmountOut: swap.minimumAmountOut.toString(), error: reason.slice(0, 500),
    });
    throw error;
  }
}

async function tick(
  program: Program<any>,
  connection: Connection,
  config: AgentConfig,
  operatorKey: Keypair,
  nodePda: PublicKey,
  lastAmount: bigint | null,
  guard: ExecutionGuard,
): Promise<bigint> {
  const node = (await (program.account as any).nodeAccount.fetchNullable(nodePda)) as NodeAccount | null;
  if (!node) throw new Error(`Node PDA ${nodePda.toBase58()} is not initialized`);
  if (!node.owner.equals(config.nodeOwner)) throw new Error("Configured node owner does not match");
  if (!node.operator.equals(operatorKey.publicKey)) throw new Error("Operator key is not authorized by the node");

  // Reconcile the durable on-chain vault first. A previous strategy call may
  // have failed after metabolize_yield committed successfully.
  await flushVaultThroughStrategy(program, connection, operatorKey, config, nodePda, node, guard);

  const sourceToken = tokenAta(config.mint, operatorKey.publicKey, false);
  const amount = await readAmount(connection, sourceToken);

  if (lastAmount === null) {
    if (config.sweepExisting && amount > 0n) {
      await metabolize(
        program, connection, operatorKey.publicKey, config.nodeOwner, config.mint, nodePda, node, amount,
      );
      return 0n;
    }
    console.log(`[kairos] baseline source=${amount}; waiting for inflows`);
    return amount;
  }

  if (amount < lastAmount) return amount;
  const delta = amount - lastAmount;
  if (delta === 0n) return amount;

  await metabolize(
    program, connection, operatorKey.publicKey, config.nodeOwner, config.mint, nodePda, node, delta,
  );
  // The next tick flushes the vault. Keeping it as a separate transaction
  // preserves recoverability if the external strategy account is unavailable.
  return amount - delta;
}

async function main(): Promise<void> {
  const config = loadConfig();
  const operatorKey = loadOperatorKey(config.operatorKeyPath);
  const connection = new Connection(config.rpcUrl, {
    commitment: "confirmed",
    wsEndpoint: config.rpcUrl.replace("https://", "wss://"),
  });
  const provider = new AnchorProvider(connection, new Wallet(operatorKey), {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
  const program = new Program<any>(idl, provider);
  if (!program.programId.equals(config.programId)) {
    throw new Error("IDL program ID does not match KAIROS_PROGRAM_ID");
  }

  const [nodePda] = findNodePda(program.programId, config.nodeOwner);
  const guard = new ExecutionGuard({
    statePath: config.riskStatePath,
    maxSwapAmount: config.maxSwapAmount,
    maxDailyInput: config.maxDailyInput,
    maxConsecutiveFailures: config.maxConsecutiveFailures,
    cooldownMs: config.circuitCooldownMs,
  });
  console.log(
    `[kairos] operator online owner=${config.nodeOwner} operator=${operatorKey.publicKey} node=${nodePda}`,
  );

  let lastAmount: bigint | null = null;
  let stopping = false;
  const stop = (): void => { stopping = true; };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  while (!stopping) {
    try {
      lastAmount = await tick(
        program, connection, config, operatorKey, nodePda, lastAmount, guard,
      );
    } catch (err) {
      const reason = err instanceof Error ? err.stack ?? err.message : String(err);
      console.error(`[kairos] tick failed: ${reason}`);
    }
    await new Promise((resolve) => setTimeout(resolve, config.pollMs));
  }
}

main().catch((err: unknown) => {
  console.error(`[kairos] fatal: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
