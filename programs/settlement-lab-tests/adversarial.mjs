/**
 * Custody and isolation cases for the Settlement Lab.
 * These calls are built directly against the program. They extend the
 * baseline suite and do not replace it.
 */
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createMint,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";

const DAY = 86_400n;

export async function runCustodyScenarios(ctx) {
  const {
    connection, programId, admin, owner, inputMint, outputMint, pool, poolInput, poolOutput,
    mandate, adminOutput, record, must, submit, ix, meta, u64, i64, clock, rpc,
    tokenAmount, accountU64, executionDigest, anchorLine, proveSwap, governance,
    evidenceDigest, proposalDigest, instructionsSysvar,
  } = ctx;

  const adminInput = await getOrCreateAssociatedTokenAccount(connection, admin, inputMint, admin.publicKey);
  const outputMintB = await createMint(connection, admin, admin.publicKey, null, 6);
  const poolB = PublicKey.findProgramAddressSync(
    [Buffer.from("pool"), admin.publicKey.toBuffer(), inputMint.toBuffer(), outputMintB.toBuffer()],
    programId,
  )[0];
  const poolBInput = getAssociatedTokenAddressSync(inputMint, poolB, true);
  const poolBOutput = getAssociatedTokenAddressSync(outputMintB, poolB, true);
  await must(connection, [
    ix("initialize_pool", [u64(1n), u64(1n)], [
      meta(admin.publicKey, true, true),
      meta(inputMint),
      meta(outputMintB),
      meta(poolB, true),
      meta(poolBInput, true),
      meta(poolBOutput, true),
      meta(TOKEN_PROGRAM_ID),
      meta(ASSOCIATED_TOKEN_PROGRAM_ID),
      meta(SystemProgram.programId),
    ]),
  ], [admin]);
  const adminOutputB = await getOrCreateAssociatedTokenAccount(connection, admin, outputMintB, admin.publicKey);
  await mintTo(connection, admin, outputMintB, adminOutputB.address, admin, 5_000_000n);
  await must(connection, [
    ix("fund_reserve", [u64(5_000_000n)], [
      meta(admin.publicKey, false, true),
      meta(poolB),
      meta(outputMintB),
      meta(adminOutputB.address, true),
      meta(poolBOutput, true),
      meta(TOKEN_PROGRAM_ID),
    ]),
  ], [admin]);

  const ownerA = Keypair.generate();
  const ownerB = Keypair.generate();
  await rpc("surfnet_setAccount", [ownerA.publicKey.toBase58(), {
    lamports: 5_000_000_000, owner: SystemProgram.programId.toBase58(),
  }]);
  await rpc("surfnet_setAccount", [ownerB.publicKey.toBase58(), {
    lamports: 5_000_000_000, owner: SystemProgram.programId.toBase58(),
  }]);
  const aInput = await getOrCreateAssociatedTokenAccount(connection, ownerA, inputMint, ownerA.publicKey);
  const aOutput = await getOrCreateAssociatedTokenAccount(connection, ownerA, outputMint, ownerA.publicKey);
  const aOutputB = await getOrCreateAssociatedTokenAccount(connection, ownerA, outputMintB, ownerA.publicKey);
  const bInput = await getOrCreateAssociatedTokenAccount(connection, ownerB, inputMint, ownerB.publicKey);
  const bOutput = await getOrCreateAssociatedTokenAccount(connection, ownerB, outputMint, ownerB.publicKey);
  await mintTo(connection, admin, inputMint, aInput.address, admin, 10_000_000n);
  await mintTo(connection, admin, inputMint, bInput.address, admin, 10_000_000n);

  const portfolioOf = (who) => PublicKey.findProgramAddressSync(
    [Buffer.from("portfolio"), who.toBuffer(), inputMint.toBuffer()],
    programId,
  )[0];
  const mandateOf = (who, poolKey) => PublicKey.findProgramAddressSync(
    [Buffer.from("mandate"), who.toBuffer(), poolKey.toBuffer()],
    programId,
  )[0];
  const portfolioA = portfolioOf(ownerA.publicKey);
  const portfolioB = portfolioOf(ownerB.publicKey);
  const mandateA1 = mandateOf(ownerA.publicKey, pool);
  const mandateA2 = mandateOf(ownerA.publicKey, poolB);
  const mandateB = mandateOf(ownerB.publicKey, pool);

  async function openPortfolio(who, portfolio, daily) {
    await must(connection, [
      ix("initialize_portfolio", [u64(daily)], [
        meta(who.publicKey, true, true),
        meta(inputMint),
        meta(portfolio, true),
        meta(SystemProgram.programId),
      ]),
    ], [who]);
  }
  async function openMandate(who, poolKey, mandateKey, portfolioKey, perTrade, daily) {
    const now = await clock(connection);
    await must(connection, [
      ix("initialize_mandate", [u64(perTrade), u64(daily), i64(now + DAY)], [
        meta(who.publicKey, true, true),
        meta(poolKey),
        meta(portfolioKey),
        meta(inputMint),
        meta(mandateKey, true),
        meta(SystemProgram.programId),
      ]),
    ], [who]);
  }

  await openPortfolio(ownerA, portfolioA, 1_500n);
  await openPortfolio(ownerB, portfolioB, 1_000n);
  await openMandate(ownerA, pool, mandateA1, portfolioA, 1_000n, 5_000n);
  await openMandate(ownerB, pool, mandateB, portfolioB, 1_000n, 5_000n);

  const snap = async () => ({
    baselineMandateSpent: (await accountU64(connection, mandate, 88))?.toString() ?? null,
    mandateA1Spent: (await accountU64(connection, mandateA1, 88))?.toString() ?? null,
    mandateA1Max: (await accountU64(connection, mandateA1, 80))?.toString() ?? null,
    mandateBSpent: (await accountU64(connection, mandateB, 88))?.toString() ?? null,
    portfolioASpent: (await accountU64(connection, portfolioA, 80))?.toString() ?? null,
    portfolioAMax: (await accountU64(connection, portfolioA, 72))?.toString() ?? null,
    portfolioBSpent: (await accountU64(connection, portfolioB, 80))?.toString() ?? null,
    poolOutput: (await tokenAmount(connection, poolOutput)).toString(),
    poolInput: (await tokenAmount(connection, poolInput)).toString(),
    poolBOutput: (await tokenAmount(connection, poolBOutput)).toString(),
    poolBInput: (await tokenAmount(connection, poolBInput)).toString(),
    adminOutput: (await tokenAmount(connection, adminOutput.address)).toString(),
    adminInput: (await tokenAmount(connection, adminInput.address)).toString(),
    ownerAInput: (await tokenAmount(connection, aInput.address)).toString(),
    ownerAOutput: (await tokenAmount(connection, aOutput.address)).toString(),
    ownerBInput: (await tokenAmount(connection, bInput.address)).toString(),
    ownerBOutput: (await tokenAmount(connection, bOutput.address)).toString(),
  });

  async function accountBytes(account) {
    const info = await connection.getAccountInfo(account, "confirmed");
    return info ? Buffer.from(info.data) : null;
  }
  async function receiptOf(mandateKey, nonce) {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("receipt"), mandateKey.toBuffer(), u64(nonce)],
      programId,
    );
    return { pda, exists: Boolean(await connection.getAccountInfo(pda, "confirmed")) };
  }

  function swapAccounts({
    signer, mandateKey, portfolioKey, poolKey, inMint, outMint, ownerIn, ownerOut, vaultIn, vaultOut, nonce,
  }) {
    return [
      meta(signer, true, true),
      meta(poolKey),
      meta(mandateKey, true),
      meta(portfolioKey, true),
      meta(inMint),
      meta(outMint),
      meta(ownerIn, true),
      meta(ownerOut, true),
      meta(vaultIn, true),
      meta(vaultOut, true),
      meta(PublicKey.findProgramAddressSync(
        [Buffer.from("receipt"), mandateKey.toBuffer(), u64(nonce)],
        programId,
      )[0], true),
      meta(TOKEN_PROGRAM_ID),
      meta(SystemProgram.programId),
      meta(governance.config),
      meta(instructionsSysvar),
    ];
  }

  function swapData({
    signer, mandateKey, poolKey, inMint, outMint, amountIn, minimumOut, nonce, deadline,
    rateNumerator = 1n, rateDenominator = 1n, amountOut, digest,
    evidence = evidenceDigest, proposal = proposalDigest,
    issuedAt, expiresAt,
  }) {
    const parameters = {
      programId, owner: signer, pool: poolKey, mandate: mandateKey, inputMint: inMint, outputMint: outMint,
      amountIn, amountOut: amountOut ?? amountIn * rateNumerator / rateDenominator,
      minimumOut, nonce, deadline, rateNumerator, rateDenominator,
    };
    const execution = digest ?? executionDigest(parameters);
    const issued = issuedAt ?? deadline - 20n;
    const expires = expiresAt ?? deadline + 120n;
    return {
      data: [
        u64(amountIn), u64(minimumOut), u64(nonce), i64(deadline),
        u64(rateNumerator), u64(rateDenominator), execution, evidence, proposal,
        i64(issued), i64(expires),
      ],
      parameters,
      executionDigest: execution,
      evidenceDigest: evidence,
      proposalDigest: proposal,
      issuedAt: issued,
      expiresAt: expires,
    };
  }

  async function rejectSwap(id, name, fields, signers, expected) {
    const before = await snap();
    const baselineBytes = await accountBytes(mandate);
    const deadline = fields.deadline ?? (await clock(connection)) + 20n;
    const built = swapData({ ...fields, deadline });
    const outcome = await submit(connection, [
      ...proveSwap(built, fields),
      ix("execute_swap", built.data, swapAccounts({ ...fields, nonce: fields.nonce })),
    ], signers);
    const after = await snap();
    const line = anchorLine(outcome.logs);
    const text = `${line ?? ""}\n${outcome.logs.join("\n")}`;
    const receipt = await receiptOf(fields.mandateKey, fields.nonce);
    const unchanged = JSON.stringify(before) === JSON.stringify(after)
      && Buffer.compare(baselineBytes, await accountBytes(mandate)) === 0;
    const matched = Boolean(outcome.err) && expected.some((code) => text.includes(code)) && unchanged && !receipt.exists;
    record({
      id, name, ok: matched, expected: expected.join(" | "),
      observed: line ?? outcome.logs.slice(-4).join(" | "),
      signature: outcome.signature, rolledBack: unchanged, receiptExists: receipt.exists,
      before, after,
    });
  }

  async function acceptSwap(id, name, fields, signer) {
    const before = await snap();
    const deadline = fields.deadline ?? (await clock(connection)) + 20n;
    const built = swapData({ ...fields, deadline });
    const outcome = await submit(connection, [
      ...proveSwap(built, fields),
      ix("execute_swap", built.data, swapAccounts(fields)),
    ], [signer]);
    const after = await snap();
    const receipt = await receiptOf(fields.mandateKey, fields.nonce);
    record({
      id, name, ok: !outcome.err && receipt.exists,
      observed: outcome.err ? anchorLine(outcome.logs) : "executed",
      signature: outcome.signature, receipt: receipt.pda.toBase58(), receiptExists: receipt.exists,
      before, after,
    });
    if (outcome.err) throw new Error(`${id} failed: ${anchorLine(outcome.logs)}`);
  }

  const baselineBefore = await accountBytes(mandate);
  const beforeA1 = await snap();
  await must(connection, [ix("set_pool_paused", [Buffer.from([1])], [
    meta(admin.publicKey, false, true), meta(pool, true),
  ])], [admin]);
  const withdrawOut = await must(connection, [ix("withdraw_output_reserve", [u64(100_000n)], [
    meta(admin.publicKey, false, true), meta(pool), meta(outputMint),
    meta(poolOutput, true), meta(adminOutput.address, true), meta(TOKEN_PROGRAM_ID),
  ])], [admin]);
  const withdrawIn = await must(connection, [ix("withdraw_input_reserve", [u64(50_000n)], [
    meta(admin.publicKey, false, true), meta(pool), meta(inputMint),
    meta(poolInput, true), meta(adminInput.address, true), meta(TOKEN_PROGRAM_ID),
  ])], [admin]);
  const afterA1 = await snap();
  const baselineAfter = await accountBytes(mandate);
  record({
    id: "A1",
    name: "admin pausa o pool e recupera parte das duas reservas",
    ok: afterA1.poolOutput === String(BigInt(beforeA1.poolOutput) - 100_000n)
      && afterA1.poolInput === String(BigInt(beforeA1.poolInput) - 50_000n)
      && afterA1.adminOutput === String(BigInt(beforeA1.adminOutput) + 100_000n)
      && afterA1.adminInput === String(BigInt(beforeA1.adminInput) + 50_000n)
      && afterA1.poolBOutput === beforeA1.poolBOutput
      && afterA1.baselineMandateSpent === beforeA1.baselineMandateSpent
      && Buffer.compare(baselineBefore, baselineAfter) === 0,
    signature: `${withdrawOut.signature} ${withdrawIn.signature}`,
    observed: "executed",
    before: beforeA1,
    after: afterA1,
  });

  async function rejectWithdraw(id, name, instruction, keys, signers, expected) {
    const before = await snap();
    const bytes = await accountBytes(mandate);
    const outcome = await submit(connection, [ix(instruction, [u64(1n)], keys)], signers);
    const after = await snap();
    const line = anchorLine(outcome.logs);
    const text = `${line ?? ""}\n${outcome.logs.join("\n")}`;
    const unchanged = JSON.stringify(before) === JSON.stringify(after)
      && Buffer.compare(bytes, await accountBytes(mandate)) === 0;
    record({
      id, name, ok: Boolean(outcome.err) && expected.some((code) => text.includes(code)) && unchanged,
      expected: expected.join(" | "),
      observed: line ?? outcome.logs.slice(-4).join(" | "),
      signature: outcome.signature, rolledBack: unchanged, before, after,
    });
  }

  const attacker = Keypair.generate();
  await rpc("surfnet_setAccount", [attacker.publicKey.toBase58(), {
    lamports: 2_000_000_000, owner: SystemProgram.programId.toBase58(),
  }]);
  const attackerOut = await getOrCreateAssociatedTokenAccount(connection, attacker, outputMint, attacker.publicKey);
  await rejectWithdraw("A2", "carteira estranha não recupera a reserva", "withdraw_output_reserve", [
    meta(attacker.publicKey, false, true), meta(pool), meta(outputMint),
    meta(poolOutput, true), meta(attackerOut.address, true), meta(TOKEN_PROGRAM_ID),
  ], [attacker], ["ConstraintSeeds", "Unauthorized", "A seeds constraint"]);

  await rejectWithdraw("A4-vault", "admin não substitui o vault pelo token do proprietário", "withdraw_output_reserve", [
    meta(admin.publicKey, false, true), meta(pool), meta(outputMint),
    meta(aOutput.address, true), meta(adminOutput.address, true), meta(TOKEN_PROGRAM_ID),
  ], [admin], ["ConstraintAssociated", "associated", "ConstraintTokenOwner"]);

  await rejectWithdraw("A4-pool", "admin não saca o vault de outro pool", "withdraw_output_reserve", [
    meta(admin.publicKey, false, true), meta(pool), meta(outputMint),
    meta(poolBOutput, true), meta(adminOutput.address, true), meta(TOKEN_PROGRAM_ID),
  ], [admin], ["ConstraintAssociated", "ConstraintTokenOwner", "MintMismatch", "ConstraintTokenMint", "associated"]);

  await must(connection, [ix("set_pool_paused", [Buffer.from([0])], [
    meta(admin.publicKey, false, true), meta(pool, true),
  ])], [admin]);
  await rejectWithdraw("A3", "admin não saca com o pool ativo", "withdraw_output_reserve", [
    meta(admin.publicKey, false, true), meta(pool), meta(outputMint),
    meta(poolOutput, true), meta(adminOutput.address, true), meta(TOKEN_PROGRAM_ID),
  ], [admin], ["MustPauseFirst"]);

  await acceptSwap("B1-A", "owner A troca no pool 1", {
    signer: ownerA.publicKey, mandateKey: mandateA1, portfolioKey: portfolioA, poolKey: pool,
    inMint: inputMint, outMint: outputMint, ownerIn: aInput.address, ownerOut: aOutput.address,
    vaultIn: poolInput, vaultOut: poolOutput, amountIn: 1_000n, minimumOut: 1_000n, nonce: 1_000n,
  }, ownerA);
  const afterA = await snap();
  await acceptSwap("B1-B", "owner B troca no mesmo pool sem alterar o mandato de A", {
    signer: ownerB.publicKey, mandateKey: mandateB, portfolioKey: portfolioB, poolKey: pool,
    inMint: inputMint, outMint: outputMint, ownerIn: bInput.address, ownerOut: bOutput.address,
    vaultIn: poolInput, vaultOut: poolOutput, amountIn: 400n, minimumOut: 400n, nonce: 50n,
  }, ownerB);
  const afterB = await snap();
  record({
    id: "B1",
    name: "mandatos e portfólios do mesmo pool ficam isolados",
    ok: afterA.mandateA1Spent === "1000" && afterA.portfolioASpent === "1000" && afterA.mandateBSpent === "0"
      && afterB.mandateA1Spent === "1000" && afterB.portfolioASpent === "1000"
      && afterB.mandateBSpent === "400" && afterB.portfolioBSpent === "400",
    observed: "executed",
    before: afterA,
    after: afterB,
  });

  await rejectSwap("B2", "owner B não usa o mandato de A", {
    signer: ownerB.publicKey, mandateKey: mandateA1, portfolioKey: portfolioB, poolKey: pool,
    inMint: inputMint, outMint: outputMint, ownerIn: bInput.address, ownerOut: bOutput.address,
    vaultIn: poolInput, vaultOut: poolOutput, amountIn: 1n, minimumOut: 1n, nonce: 9n,
  }, [ownerB], ["ConstraintSeeds", "Unauthorized"]);

  const receiptA = await receiptOf(mandateA1, 1_000n);
  await acceptSwap("B3", "o mesmo número de nonce no mandato B cria outro recibo", {
    signer: ownerB.publicKey, mandateKey: mandateB, portfolioKey: portfolioB, poolKey: pool,
    inMint: inputMint, outMint: outputMint, ownerIn: bInput.address, ownerOut: bOutput.address,
    vaultIn: poolInput, vaultOut: poolOutput, amountIn: 100n, minimumOut: 100n, nonce: 1_000n,
  }, ownerB);
  const receiptB = await receiptOf(mandateB, 1_000n);
  record({
    id: "B3-receipts",
    name: "recibos de A e B com o mesmo nonce não colidem",
    ok: receiptA.exists && receiptB.exists && receiptA.pda.toBase58() !== receiptB.pda.toBase58(),
    observed: `${receiptA.pda.toBase58()} ${receiptB.pda.toBase58()}`,
    receiptExists: true,
  });

  await openMandate(ownerA, poolB, mandateA2, portfolioA, 1_000n, 5_000n);
  const beforeC = await snap();
  await rejectSwap("C1", "o segundo pool não ultrapassa o teto agregado do portfólio", {
    signer: ownerA.publicKey, mandateKey: mandateA2, portfolioKey: portfolioA, poolKey: poolB,
    inMint: inputMint, outMint: outputMintB, ownerIn: aInput.address, ownerOut: aOutputB.address,
    vaultIn: poolBInput, vaultOut: poolBOutput, amountIn: 600n, minimumOut: 600n, nonce: 2n,
  }, [ownerA], ["LimitExceeded"]);
  const afterC = await snap();
  record({
    id: "C1-check",
    name: "pool 2 permanece intacto e o contador de A não avança",
    ok: afterC.poolBOutput === beforeC.poolBOutput && afterC.poolBInput === beforeC.poolBInput
      && afterC.portfolioASpent === "1000" && afterC.mandateA1Spent === "1000",
    observed: "rolled back",
    before: beforeC,
    after: afterC,
    rolledBack: afterC.portfolioASpent === beforeC.portfolioASpent,
  });

  const seconds = await clock(connection);
  const day = seconds / DAY;
  let boundary = (day + 1n) * DAY - 30n;
  if (boundary <= seconds) boundary = (day + 2n) * DAY - 30n;
  await rpc("surfnet_timeTravel", [{ absoluteTimestamp: Number(boundary) * 1000 }]);
  const ownerD = Keypair.generate();
  await rpc("surfnet_setAccount", [ownerD.publicKey.toBase58(), {
    lamports: 5_000_000_000, owner: SystemProgram.programId.toBase58(),
  }]);
  const dInput = await getOrCreateAssociatedTokenAccount(connection, ownerD, inputMint, ownerD.publicKey);
  const dOutput = await getOrCreateAssociatedTokenAccount(connection, ownerD, outputMint, ownerD.publicKey);
  await mintTo(connection, admin, inputMint, dInput.address, admin, 5_000n);
  const portfolioD = portfolioOf(ownerD.publicKey);
  const mandateD = mandateOf(ownerD.publicKey, pool);
  await openPortfolio(ownerD, portfolioD, 1_000n);
  await openMandate(ownerD, pool, mandateD, portfolioD, 1_000n, 1_000n);
  await acceptSwap("D-before", "consumo do limite no fim do dia UTC", {
    signer: ownerD.publicKey, mandateKey: mandateD, portfolioKey: portfolioD, poolKey: pool,
    inMint: inputMint, outMint: outputMint, ownerIn: dInput.address, ownerOut: dOutput.address,
    vaultIn: poolInput, vaultOut: poolOutput, amountIn: 1_000n, minimumOut: 1_000n, nonce: 1n,
    deadline: boundary + 20n,
  }, ownerD);
  await rejectSwap("D-full", "limite diário esgotado antes da meia-noite", {
    signer: ownerD.publicKey, mandateKey: mandateD, portfolioKey: portfolioD, poolKey: pool,
    inMint: inputMint, outMint: outputMint, ownerIn: dInput.address, ownerOut: dOutput.address,
    vaultIn: poolInput, vaultOut: poolOutput, amountIn: 1n, minimumOut: 1n, nonce: 2n,
    deadline: boundary + 20n,
  }, [ownerD], ["LimitExceeded"]);
  const spentBeforeRoll = await accountU64(connection, portfolioD, 80);
  const maxBeforeRoll = await accountU64(connection, mandateD, 80);
  await rpc("surfnet_timeTravel", [{ absoluteTimestamp: Number(boundary + 60n) * 1000 }]);
  await acceptSwap("D-after", "o dia UTC seguinte reinicia o contador e preserva o teto", {
    signer: ownerD.publicKey, mandateKey: mandateD, portfolioKey: portfolioD, poolKey: pool,
    inMint: inputMint, outMint: outputMint, ownerIn: dInput.address, ownerOut: dOutput.address,
    vaultIn: poolInput, vaultOut: poolOutput, amountIn: 1_000n, minimumOut: 1_000n, nonce: 3n,
    deadline: boundary + 80n,
  }, ownerD);
  const spentAfterRoll = await accountU64(connection, portfolioD, 80);
  const maxAfterRoll = await accountU64(connection, mandateD, 80);
  record({
    id: "D",
    name: "contador diário reinicia e o teto do mandato permanece",
    ok: spentBeforeRoll === 1_000n && spentAfterRoll === 1_000n && maxBeforeRoll === 1_000n && maxAfterRoll === 1_000n,
    observed: `spent ${spentBeforeRoll} -> ${spentAfterRoll}, max ${maxBeforeRoll} -> ${maxAfterRoll}`,
    before: { portfolioSpent: spentBeforeRoll?.toString(), mandateMax: maxBeforeRoll?.toString() },
    after: { portfolioSpent: spentAfterRoll?.toString(), mandateMax: maxAfterRoll?.toString() },
  });

  await rejectSwap("E-account", "conta de token de outro mint não movimenta saldos nem cria recibo", {
    signer: ownerA.publicKey, mandateKey: mandateA1, portfolioKey: portfolioA, poolKey: pool,
    inMint: inputMint, outMint: outputMint, ownerIn: aOutput.address, ownerOut: aInput.address,
    vaultIn: poolInput, vaultOut: poolOutput, amountIn: 1n, minimumOut: 1n, nonce: 77n,
  }, [ownerA], ["ConstraintTokenMint", "ConstraintTokenOwner", "MintMismatch"]);

  const beforeF = await snap();
  const token2022Built = swapData({
    signer: ownerA.publicKey, mandateKey: mandateA1, poolKey: pool, inMint: inputMint, outMint: outputMint,
    amountIn: 1n, minimumOut: 1n, nonce: 78n, deadline: (await clock(connection)) + 20n,
  });
  const token2022 = await submit(connection, [
    ...proveSwap(token2022Built),
    ix("execute_swap", token2022Built.data, swapAccounts({
      signer: ownerA.publicKey, mandateKey: mandateA1, portfolioKey: portfolioA, poolKey: pool,
      inMint: inputMint, outMint: outputMint, ownerIn: aInput.address, ownerOut: aOutput.address,
      vaultIn: poolInput, vaultOut: poolOutput, nonce: 78n,
    }).map((account) => account.pubkey.equals(TOKEN_PROGRAM_ID) ? meta(TOKEN_2022_PROGRAM_ID) : account)),
  ], [ownerA]);
  const afterF = await snap();
  const lineF = anchorLine(token2022.logs);
  const textF = `${lineF ?? ""}\n${token2022.logs.join("\n")}`;
  record({
    id: "F",
    name: "Token-2022 não é aceito no lugar do SPL Token clássico",
    ok: Boolean(token2022.err)
      && JSON.stringify(beforeF) === JSON.stringify(afterF)
      && ["InvalidProgramId", "invalid program id", "IncorrectProgramId", "AccountOwnedByWrongProgram", "Invalid program"].some((code) => textF.includes(code)),
    expected: "InvalidProgramId",
    observed: lineF ?? token2022.logs.slice(-4).join(" | "),
    signature: token2022.signature,
    rolledBack: JSON.stringify(beforeF) === JSON.stringify(afterF),
    before: beforeF,
    after: afterF,
  });

  const digestDeadline = (await clock(connection)) + 20n;
  const wrongProgram = new PublicKey(Buffer.alloc(32, 9));
  await rejectSwap("G", "digest com outro program id não substitui o digest executado", {
    signer: ownerB.publicKey, mandateKey: mandateB, portfolioKey: portfolioB, poolKey: pool,
    inMint: inputMint, outMint: outputMint, ownerIn: bInput.address, ownerOut: bOutput.address,
    vaultIn: poolInput, vaultOut: poolOutput, amountIn: 1n, minimumOut: 1n, nonce: 79n,
    deadline: digestDeadline,
    digest: executionDigest({
      programId: wrongProgram, owner: ownerB.publicKey, pool, mandate: mandateB,
      inputMint, outputMint, amountIn: 1n, amountOut: 1n, minimumOut: 1n, nonce: 79n,
      deadline: digestDeadline, rateNumerator: 1n, rateDenominator: 1n,
    }),
  }, [ownerB], ["DigestMismatch"]);
}
