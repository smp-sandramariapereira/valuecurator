/**
 * Direct calls that require a ProofGate Ed25519 authorization.
 * The policy signer is a test fixture, not the Research Lab and not the owner.
 */
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createMint,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import { Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";

const DAY = 86_400n;

export async function runProofGateScenarios(ctx) {
  const {
    connection, programId, admin, inputMint, outputMint, pool, poolInput, poolOutput,
    record, must, submit, ix, meta, u64, i64, clock, rpc, tokenAmount, accountU64,
    executionDigest, anchorLine, proveSwap, governance, evidenceDigest, proposalDigest,
    instructionsSysvar,
  } = ctx;

  const owner = Keypair.generate();
  const stranger = Keypair.generate();
  await rpc("surfnet_setAccount", [owner.publicKey.toBase58(), {
    lamports: 5_000_000_000, owner: SystemProgram.programId.toBase58(),
  }]);
  await rpc("surfnet_setAccount", [stranger.publicKey.toBase58(), {
    lamports: 2_000_000_000, owner: SystemProgram.programId.toBase58(),
  }]);
  const ownerIn = await getOrCreateAssociatedTokenAccount(connection, owner, inputMint, owner.publicKey);
  const ownerOut = await getOrCreateAssociatedTokenAccount(connection, owner, outputMint, owner.publicKey);
  await mintTo(connection, admin, inputMint, ownerIn.address, admin, 5_000_000n);

  const portfolio = PublicKey.findProgramAddressSync(
    [Buffer.from("portfolio"), owner.publicKey.toBuffer(), inputMint.toBuffer()], programId,
  )[0];
  const mandate = PublicKey.findProgramAddressSync(
    [Buffer.from("mandate"), owner.publicKey.toBuffer(), pool.toBuffer()], programId,
  )[0];
  await must(connection, [ix("initialize_portfolio", [u64(1_500n)], [
    meta(owner.publicKey, true, true), meta(inputMint), meta(portfolio, true), meta(SystemProgram.programId),
  ])], [owner]);
  const now = await clock(connection);
  await must(connection, [ix("initialize_mandate", [u64(1_000n), u64(5_000n), i64(now + DAY)], [
    meta(owner.publicKey, true, true), meta(pool), meta(portfolio), meta(inputMint), meta(mandate, true),
    meta(SystemProgram.programId),
  ])], [owner]);

  const outputQ = await createMint(connection, admin, admin.publicKey, null, 6);
  const poolQ = PublicKey.findProgramAddressSync(
    [Buffer.from("pool"), admin.publicKey.toBuffer(), inputMint.toBuffer(), outputQ.toBuffer()], programId,
  )[0];
  const poolQIn = getAssociatedTokenAddressSync(inputMint, poolQ, true);
  const poolQOut = getAssociatedTokenAddressSync(outputQ, poolQ, true);
  await must(connection, [ix("initialize_pool", [u64(1n), u64(1n)], [
    meta(admin.publicKey, true, true), meta(inputMint), meta(outputQ), meta(poolQ, true),
    meta(poolQIn, true), meta(poolQOut, true), meta(TOKEN_PROGRAM_ID),
    meta(ASSOCIATED_TOKEN_PROGRAM_ID), meta(SystemProgram.programId),
  ])], [admin]);
  const adminQ = await getOrCreateAssociatedTokenAccount(connection, admin, outputQ, admin.publicKey);
  const ownerQ = await getOrCreateAssociatedTokenAccount(connection, owner, outputQ, owner.publicKey);
  await mintTo(connection, admin, outputQ, adminQ.address, admin, 5_000_000n);
  await must(connection, [ix("fund_reserve", [u64(5_000_000n)], [
    meta(admin.publicKey, false, true), meta(poolQ), meta(outputQ), meta(adminQ.address, true),
    meta(poolQOut, true), meta(TOKEN_PROGRAM_ID),
  ])], [admin]);
  const mandateQ = PublicKey.findProgramAddressSync(
    [Buffer.from("mandate"), owner.publicKey.toBuffer(), poolQ.toBuffer()], programId,
  )[0];
  await must(connection, [ix("initialize_mandate", [u64(1_000n), u64(5_000n), i64((await clock(connection)) + DAY)], [
    meta(owner.publicKey, true, true), meta(poolQ), meta(portfolio), meta(inputMint), meta(mandateQ, true),
    meta(SystemProgram.programId),
  ])], [owner]);

  const outputR = await createMint(connection, admin, admin.publicKey, null, 6);
  const poolR = PublicKey.findProgramAddressSync(
    [Buffer.from("pool"), admin.publicKey.toBuffer(), inputMint.toBuffer(), outputR.toBuffer()], programId,
  )[0];
  const poolRIn = getAssociatedTokenAddressSync(inputMint, poolR, true);
  const poolROut = getAssociatedTokenAddressSync(outputR, poolR, true);
  await must(connection, [ix("initialize_pool", [u64(1n), u64(1n)], [
    meta(admin.publicKey, true, true), meta(inputMint), meta(outputR), meta(poolR, true),
    meta(poolRIn, true), meta(poolROut, true), meta(TOKEN_PROGRAM_ID),
    meta(ASSOCIATED_TOKEN_PROGRAM_ID), meta(SystemProgram.programId),
  ])], [admin]);
  await getOrCreateAssociatedTokenAccount(connection, owner, outputR, owner.publicKey);
  const mandateR = PublicKey.findProgramAddressSync(
    [Buffer.from("mandate"), owner.publicKey.toBuffer(), poolR.toBuffer()], programId,
  )[0];
  await must(connection, [ix("initialize_mandate", [u64(1_000n), u64(5_000n), i64((await clock(connection)) + DAY)], [
    meta(owner.publicKey, true, true), meta(poolR), meta(portfolio), meta(inputMint), meta(mandateR, true),
    meta(SystemProgram.programId),
  ])], [owner]);

  const base = {
    signer: owner.publicKey, mandateKey: mandate, portfolioKey: portfolio, poolKey: pool,
    inMint: inputMint, outMint: outputMint, ownerIn: ownerIn.address, ownerOut: ownerOut.address,
    vaultIn: poolInput, vaultOut: poolOutput,
  };

  async function snap() {
    return {
      ownerIn: (await tokenAmount(connection, ownerIn.address)).toString(),
      ownerOut: (await tokenAmount(connection, ownerOut.address)).toString(),
      poolIn: (await tokenAmount(connection, poolInput)).toString(),
      poolOut: (await tokenAmount(connection, poolOutput)).toString(),
      poolQIn: (await tokenAmount(connection, poolQIn)).toString(),
      poolQOut: (await tokenAmount(connection, poolQOut)).toString(),
      poolRIn: (await tokenAmount(connection, poolRIn)).toString(),
      poolROut: (await tokenAmount(connection, poolROut)).toString(),
      mandateSpent: (await accountU64(connection, mandate, 88))?.toString() ?? null,
      portfolioSpent: (await accountU64(connection, portfolio, 80))?.toString() ?? null,
      mandateQSpent: (await accountU64(connection, mandateQ, 88))?.toString() ?? null,
    };
  }

  function accountsOf(fields) {
    return [
      meta(fields.signer, true, true), meta(fields.poolKey), meta(fields.mandateKey, true),
      meta(fields.portfolioKey, true), meta(fields.inMint), meta(fields.outMint),
      meta(fields.ownerIn, true), meta(fields.ownerOut, true), meta(fields.vaultIn, true),
      meta(fields.vaultOut, true),
      meta(PublicKey.findProgramAddressSync(
        [Buffer.from("receipt"), fields.mandateKey.toBuffer(), u64(fields.nonce)], programId,
      )[0], true),
      meta(TOKEN_PROGRAM_ID), meta(SystemProgram.programId),
      meta(governance.config), meta(instructionsSysvar),
    ];
  }

  function builtSwap(fields, deadline) {
    const rateNumerator = fields.rateNumerator ?? 1n;
    const rateDenominator = fields.rateDenominator ?? 1n;
    const parameters = {
      programId, owner: fields.signer, pool: fields.poolKey, mandate: fields.mandateKey,
      inputMint: fields.inMint, outputMint: fields.outMint, amountIn: fields.amountIn,
      amountOut: fields.amountOut ?? fields.amountIn * rateNumerator / rateDenominator,
      minimumOut: fields.minimumOut, nonce: fields.nonce, deadline,
      rateNumerator, rateDenominator,
    };
    const execution = fields.digest ?? executionDigest(parameters);
    const issuedAt = fields.issuedAt ?? deadline - 20n;
    const expiresAt = fields.expiresAt ?? deadline + 120n;
    const evidence = fields.evidenceDigest ?? evidenceDigest;
    const proposal = fields.proposalDigest ?? proposalDigest;
    return {
      data: [
        u64(fields.amountIn), u64(fields.minimumOut), u64(fields.nonce), i64(deadline),
        u64(rateNumerator), u64(rateDenominator), execution, evidence, proposal,
        i64(issuedAt), i64(expiresAt),
      ],
      parameters, executionDigest: execution, evidenceDigest: evidence, proposalDigest: proposal,
      issuedAt, expiresAt,
    };
  }

  async function receiptOf(mandateKey, nonce) {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("receipt"), mandateKey.toBuffer(), u64(nonce)], programId,
    );
    return { pda, exists: Boolean(await connection.getAccountInfo(pda, "confirmed")) };
  }

  async function settle(id, name, fields, signers, { expectError = null, allowExistingReceipt = false } = {}) {
    const before = await snap();
    const deadline = fields.deadline ?? (await clock(connection)) + 20n;
    const built = builtSwap(fields, deadline);
    const instructions = [
      ...proveSwap(built, fields),
      ix("execute_swap", built.data, accountsOf(fields)),
    ];
    let outcome;
    if (fields.unsignedOwner) {
      const latest = await connection.getLatestBlockhash("confirmed");
      const transaction = new Transaction().add(...instructions);
      transaction.feePayer = admin.publicKey;
      transaction.recentBlockhash = latest.blockhash;
      transaction.partialSign(admin);
      try {
        const raw = transaction.serialize({ requireAllSignatures: false, verifySignatures: false });
        const signature = await connection.sendRawTransaction(raw, { skipPreflight: true });
        await connection.confirmTransaction({
          signature, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight,
        }, "confirmed");
        const detail = await connection.getTransaction(signature, {
          commitment: "confirmed", maxSupportedTransactionVersion: 0,
        });
        outcome = { signature, err: detail?.meta?.err ?? null, logs: detail?.meta?.logMessages ?? [] };
      } catch (error) {
        outcome = { signature: null, err: error instanceof Error ? error.message : String(error), logs: [] };
      }
    } else {
      outcome = await submit(connection, instructions, signers);
    }
    const after = await snap();
    const receipt = await receiptOf(fields.mandateKey, fields.nonce);
    const unchanged = JSON.stringify(before) === JSON.stringify(after);
    const line = anchorLine(outcome.logs);
    const text = `${line ?? ""}\n${outcome.logs.join("\n")}\n${typeof outcome.err === "string" ? outcome.err : JSON.stringify(outcome.err)}`;
    const blocked = Boolean(outcome.err)
      && unchanged
      && (allowExistingReceipt || !receipt.exists)
      && (!expectError || expectError.some((code) => text.includes(code)));
    const executed = !outcome.err && receipt.exists && !unchanged;
    record({
      id, name,
      ok: expectError ? blocked : executed,
      expected: expectError ? expectError.join(" | ") : "EXECUTED",
      observed: outcome.err ? (line ?? text.slice(0, 300)) : "executed",
      signature: outcome.signature,
      rolledBack: unchanged,
      receiptExists: receipt.exists,
      before, after,
    });
    if (!expectError && outcome.err) throw new Error(`${id} failed: ${line ?? text.slice(0, 300)}`);
    return { before, after, outcome };
  }

  const trade = { ...base, amountIn: 1_000n, minimumOut: 1_000n, nonce: 2_001n };
  await settle("B01", "owner e ProofGate válidos liquidam o swap", trade, [owner]);

  await settle("B02", "owner válido sem ProofGate", {
    ...trade, nonce: 2_002n, omitProof: true,
  }, [owner], { expectError: ["MissingProofGateAuthorization"] });

  await settle("B03", "ProofGate válido sem assinatura do owner", {
    ...trade, nonce: 2_003n, unsignedOwner: true,
  }, [admin], { expectError: ["signature", "Signature"] });

  await settle("B04", "assinatura ProofGate inválida", {
    ...trade, nonce: 2_004n, proof: { badSignature: true },
  }, [owner], { expectError: ["InstructionError", "Ed25519", "Custom"] });

  await settle("B05", "signatário ProofGate desconhecido", {
    ...trade, nonce: 2_005n, proof: { signer: stranger },
  }, [owner], { expectError: ["UnknownPolicySigner"] });

  await settle("B06", "autorização de outro proprietário", {
    ...trade, nonce: 2_006n, auth: { owner: stranger.publicKey },
  }, [owner], { expectError: ["AuthorizationMismatch"] });

  await settle("B07", "autorização de outro mandato", {
    ...trade, nonce: 2_007n, auth: { mandate: mandateQ },
  }, [owner], { expectError: ["AuthorizationMismatch"] });

  await settle("B08", "autorização de outro pool", {
    ...base, mandateKey: mandateQ, poolKey: poolQ, outMint: outputQ, ownerOut: ownerQ.address,
    vaultIn: poolQIn, vaultOut: poolQOut, amountIn: 100n, minimumOut: 100n, nonce: 2_008n,
    auth: { pool },
  }, [owner], { expectError: ["AuthorizationMismatch"] });

  const otherMint = new PublicKey(Buffer.alloc(32, 19));
  await settle("B09", "autorização com outro mint de entrada", {
    ...trade, nonce: 2_009n, auth: { inputMint: otherMint },
  }, [owner], { expectError: ["AuthorizationMismatch"] });

  await settle("B10", "autorização com outro mint de saída", {
    ...trade, nonce: 2_010n, auth: { outputMint: otherMint },
  }, [owner], { expectError: ["AuthorizationMismatch"] });

  await settle("B11", "quantidade diferente da autorizada", {
    ...trade, nonce: 2_011n, amountIn: 100n, minimumOut: 100n, auth: { amountIn: 101n },
  }, [owner], { expectError: ["AuthorizationMismatch"] });

  await settle("B12", "minimum output diferente do autorizado", {
    ...trade, nonce: 2_012n, amountIn: 100n, minimumOut: 100n, auth: { minimumOut: 101n },
  }, [owner], { expectError: ["AuthorizationMismatch"] });

  await settle("B13", "taxa diferente da autorizada", {
    ...trade, nonce: 2_013n, amountIn: 100n, minimumOut: 100n, rateNumerator: 2n,
    auth: { rateNumerator: 1n },
  }, [owner], { expectError: ["AuthorizationMismatch"] });

  await settle("B14", "nonce da autorização reutilizado", trade, [owner], {
    expectError: ["already in use", "0x0"],
    allowExistingReceipt: true,
  });

  const expiredAt = (await clock(connection)) - 5n;
  await settle("B15", "autorização expirada", {
    ...trade, nonce: 2_015n, amountIn: 100n, minimumOut: 100n,
    issuedAt: expiredAt - 10n, expiresAt: expiredAt,
  }, [owner], { expectError: ["AuthorizationExpired"] });

  const versionBuilt = builtSwap({
    ...trade, nonce: 2_016n, amountIn: 100n, minimumOut: 100n,
  }, (await clock(connection)) + 20n);
  const versionProof = proveSwap(versionBuilt);
  await must(connection, [ix("set_policy_version", [u64(2n)], [
    meta(ctx.initializer.publicKey, false, true), meta(governance.config, true),
  ])], [ctx.initializer]);
  governance.policyVersion = 2n;
  const beforeVersion = await snap();
  const versionOutcome = await submit(connection, [
    ...versionProof,
    ix("execute_swap", versionBuilt.data, accountsOf({
      ...trade, nonce: 2_016n, amountIn: 100n, minimumOut: 100n,
    })),
  ], [owner]);
  const afterVersion = await snap();
  const versionLine = anchorLine(versionOutcome.logs);
  const versionReceipt = await receiptOf(mandate, 2_016n);
  record({
    id: "B16",
    name: "autorização de outra versão de política",
    ok: Boolean(versionOutcome.err)
      && JSON.stringify(beforeVersion) === JSON.stringify(afterVersion)
      && !versionReceipt.exists
      && `${versionLine ?? ""}`.includes("AuthorizationMismatch"),
    expected: "AuthorizationMismatch",
    observed: versionLine ?? versionOutcome.logs.slice(-3).join(" | "),
    signature: versionOutcome.signature,
    rolledBack: JSON.stringify(beforeVersion) === JSON.stringify(afterVersion),
    receiptExists: versionReceipt.exists,
    before: beforeVersion,
    after: afterVersion,
  });
  governance.authorizationEpoch += 1n;
  const regressionEqual = await submit(connection, [ix("set_policy_version", [u64(2n)], [
    meta(ctx.initializer.publicKey, false, true), meta(governance.config, true),
  ])], [ctx.initializer]);
  const regressionLower = await submit(connection, [ix("set_policy_version", [u64(1n)], [
    meta(ctx.initializer.publicKey, false, true), meta(governance.config, true),
  ])], [ctx.initializer]);
  const versionAfter = await accountU64(connection, governance.config, 72);
  const epochAfter = await accountU64(connection, governance.config, 80);
  const regressionText = `${anchorLine(regressionEqual.logs) ?? ""}\n${anchorLine(regressionLower.logs) ?? ""}`;
  record({
    id: "C25",
    name: "versão de política igual ou inferior é rejeitada",
    ok: Boolean(regressionEqual.err) && Boolean(regressionLower.err)
      && regressionText.includes("PolicyRegression")
      && versionAfter === 2n && epochAfter === governance.authorizationEpoch,
    expected: "PolicyRegression",
    observed: regressionText,
    signature: regressionLower.signature,
    before: { policyVersion: "2", authorizationEpoch: governance.authorizationEpoch.toString() },
    after: { policyVersion: versionAfter?.toString() ?? null, authorizationEpoch: epochAfter?.toString() ?? null },
  });

  await must(connection, [ix("set_proofgate_paused", [Buffer.from([1])], [
    meta(ctx.initializer.publicKey, false, true), meta(governance.config, true),
  ])], [ctx.initializer]);
  await settle("B18", "configuração ProofGate pausada", {
    ...trade, nonce: 2_018n, amountIn: 100n, minimumOut: 100n,
  }, [owner], { expectError: ["GovernanceHalted"] });
  await must(connection, [ix("set_proofgate_paused", [Buffer.from([0])], [
    meta(ctx.initializer.publicKey, false, true), meta(governance.config, true),
  ])], [ctx.initializer]);

  await settle("B19", "autorização de outro Program ID", {
    ...trade, nonce: 2_019n, amountIn: 100n, minimumOut: 100n,
    auth: { programId: new PublicKey(Buffer.alloc(32, 4)) },
  }, [owner], { expectError: ["AuthorizationMismatch"] });

  await settle("B20", "autorização de outro domínio de implantação", {
    ...trade, nonce: 2_020n, amountIn: 100n, minimumOut: 100n,
    auth: { deploymentId: Buffer.alloc(32, 9) },
  }, [owner], { expectError: ["AuthorizationMismatch"] });

  await settle("B21", "evidence digest substituído", {
    ...trade, nonce: 2_021n, amountIn: 100n, minimumOut: 100n,
    auth: { evidenceDigest: Buffer.alloc(32, 17) },
  }, [owner], { expectError: ["AuthorizationMismatch"] });

  await settle("B22", "proposal digest substituído", {
    ...trade, nonce: 2_022n, amountIn: 100n, minimumOut: 100n,
    auth: { proposalDigest: Buffer.alloc(32, 18) },
  }, [owner], { expectError: ["AuthorizationMismatch"] });

  await settle("B23", "Ed25519 válido sem a mensagem desta operação", {
    ...trade, nonce: 2_023n, amountIn: 100n, minimumOut: 100n,
    proof: { signedMessage: Buffer.alloc(32, 3) },
  }, [owner], { expectError: ["AuthorizationMismatch"] });

  await settle("B24", "instrução Ed25519 com índices não canônicos", {
    ...trade, nonce: 2_024n, amountIn: 100n, minimumOut: 100n,
    proof: { malformedIndex: true },
  }, [owner], { expectError: ["MalformedEd25519"] });

  await settle("B25", "autorização válida acima do limite do mandato", {
    ...trade, nonce: 2_025n, amountIn: 1_001n, minimumOut: 1_001n,
  }, [owner], { expectError: ["LimitExceeded"] });

  await settle("B26", "autorização válida acima do limite agregado", {
    ...base, mandateKey: mandateQ, poolKey: poolQ, outMint: outputQ, ownerOut: ownerQ.address,
    vaultIn: poolQIn, vaultOut: poolQOut, amountIn: 600n, minimumOut: 600n, nonce: 2_026n,
  }, [owner], { expectError: ["LimitExceeded"] });

  await must(connection, [ix("set_pool_paused", [Buffer.from([1])], [
    meta(admin.publicKey, false, true), meta(pool, true),
  ])], [admin]);
  await settle("B27", "autorização válida com pool pausado", {
    ...trade, nonce: 2_027n, amountIn: 100n, minimumOut: 100n,
  }, [owner], { expectError: ["Paused"] });
  await must(connection, [ix("set_pool_paused", [Buffer.from([0])], [
    meta(admin.publicKey, false, true), meta(pool, true),
  ])], [admin]);

  const ownerR = await getOrCreateAssociatedTokenAccount(connection, owner, outputR, owner.publicKey);
  await settle("B28", "autorização válida com reserva insuficiente", {
    ...base, mandateKey: mandateR, poolKey: poolR, outMint: outputR, ownerOut: ownerR.address,
    vaultIn: poolRIn, vaultOut: poolROut, amountIn: 100n, minimumOut: 100n, nonce: 2_028n,
  }, [owner], { expectError: ["InsufficientReserve"] });

  const epochBuilt = builtSwap({
    ...trade, nonce: 2_017n, amountIn: 100n, minimumOut: 100n,
  }, (await clock(connection)) + 20n);
  const epochProof = proveSwap(epochBuilt);
  await must(connection, [ix("advance_authorization_epoch", [], [
    meta(ctx.initializer.publicKey, false, true), meta(governance.config, true),
  ])], [ctx.initializer]);
  governance.authorizationEpoch += 1n;
  const beforeEpoch = await snap();
  const epochOutcome = await submit(connection, [
    ...epochProof,
    ix("execute_swap", epochBuilt.data, accountsOf({
      ...trade, nonce: 2_017n, amountIn: 100n, minimumOut: 100n,
    })),
  ], [owner]);
  const afterEpoch = await snap();
  const epochLine = anchorLine(epochOutcome.logs);
  const epochReceipt = await receiptOf(mandate, 2_017n);
  record({
    id: "B17",
    name: "autorização revogada pelo epoch",
    ok: Boolean(epochOutcome.err)
      && JSON.stringify(beforeEpoch) === JSON.stringify(afterEpoch)
      && !epochReceipt.exists
      && `${epochLine ?? ""}`.includes("AuthorizationMismatch"),
    expected: "AuthorizationMismatch",
    observed: epochLine ?? epochOutcome.logs.slice(-3).join(" | "),
    signature: epochOutcome.signature,
    rolledBack: JSON.stringify(beforeEpoch) === JSON.stringify(afterEpoch),
    receiptExists: epochReceipt.exists,
    before: beforeEpoch,
    after: afterEpoch,
  });
}
