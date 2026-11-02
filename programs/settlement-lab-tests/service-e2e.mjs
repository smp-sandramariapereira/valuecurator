/**
 * Local Surfpool path through the authorization service.
 * Mints and the policy key exist only for this process. Nothing here targets
 * public Devnet, and the policy secret is not written to disk.
 */
import {
  TOKEN_PROGRAM_ID,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import { Keypair, PublicKey, SystemProgram, SYSVAR_INSTRUCTIONS_PUBKEY } from "@solana/web3.js";
import { parseProofGateConfig } from "../../apps/proofgate-authorization-service/src/config.mjs";
import { createAuthorizationService } from "../../apps/proofgate-authorization-service/src/service.mjs";

const TOKEN = TOKEN_PROGRAM_ID.toBase58();

function readU64(data, offset) {
  return Buffer.from(data).readBigUInt64LE(offset);
}

function readI64(data, offset) {
  return Buffer.from(data).readBigInt64LE(offset);
}

function readKey(data, offset) {
  return new PublicKey(Buffer.from(data).subarray(offset, offset + 32)).toBase58();
}

export async function runServiceE2E({
  connection, programId, admin, inputMint, outputMint, pool, poolInput, poolOutput,
  governance, record, must, submit, ix, meta, u64, i64, clock, rpc, tokenAmount,
}) {
  const owner = Keypair.generate();
  await rpc("surfnet_setAccount", [owner.publicKey.toBase58(), {
    lamports: 2_000_000_000,
    owner: SystemProgram.programId.toBase58(),
  }]);
  const portfolio = PublicKey.findProgramAddressSync(
    [Buffer.from("portfolio"), owner.publicKey.toBuffer(), inputMint.toBuffer()],
    programId,
  )[0];
  const mandate = PublicKey.findProgramAddressSync(
    [Buffer.from("mandate"), owner.publicKey.toBuffer(), pool.toBuffer()],
    programId,
  )[0];
  const ownerInput = await getOrCreateAssociatedTokenAccount(connection, owner, inputMint, owner.publicKey);
  const ownerOutput = await getOrCreateAssociatedTokenAccount(connection, owner, outputMint, owner.publicKey);
  await mintTo(connection, admin, inputMint, ownerInput.address, admin, 10_000n);
  const now = await clock(connection);
  await must(connection, [
    ix("initialize_portfolio", [u64(10_000n)], [
      meta(owner.publicKey, true, true), meta(inputMint), meta(portfolio, true), meta(SystemProgram.programId),
    ]),
    ix("initialize_mandate", [u64(2_000n), u64(5_000n), i64(now + 86_400n)], [
      meta(owner.publicKey, true, true), meta(pool), meta(portfolio), meta(inputMint),
      meta(mandate, true), meta(SystemProgram.programId),
    ]),
  ], [owner]);

  const registry = new Map([["lab:dAAPL", {
    assetId: "lab:dAAPL",
    network: "devnet-lab",
    mint: outputMint.toBase58(),
    tokenProgram: TOKEN,
    verificationStatus: "VERIFIED",
    synthetic: true,
  }]]);
  let chainNow = now;
  const service = createAuthorizationService({
    policySigner: governance.policySigner,
    now: () => Number(chainNow) * 1000,
    labRegistry: registry,
    loadConfig: async () => {
      const account = await connection.getAccountInfo(governance.config);
      const parsed = parseProofGateConfig(account.data);
      return { ...parsed, programId, config: governance.config, profile: "DEVNET_LAB" };
    },
    loadMandate: async () => {
      const [mandateAccount, poolAccount, portfolioAccount] = await Promise.all([
        connection.getAccountInfo(mandate),
        connection.getAccountInfo(pool),
        connection.getAccountInfo(portfolio),
      ]);
      return {
        owner: readKey(mandateAccount.data, 8),
        mandate: mandate.toBase58(),
        pool: readKey(mandateAccount.data, 40),
        inputMint: readKey(poolAccount.data, 40),
        outputMint: readKey(poolAccount.data, 72),
        maxPerTrade: readU64(mandateAccount.data, 72),
        maxDaily: readU64(mandateAccount.data, 80),
        spent: readU64(mandateAccount.data, 88),
        portfolioRemaining: readU64(portfolioAccount.data, 72) - readU64(portfolioAccount.data, 80),
        rateNumerator: readU64(poolAccount.data, 104),
        rateDenominator: readU64(poolAccount.data, 112),
        rateExpiresAt: Number(readI64(poolAccount.data, 120)),
        paused: mandateAccount.data[112] !== 0,
        poolPaused: poolAccount.data[128] !== 0,
        portfolioPaused: portfolioAccount.data[96] !== 0,
        expiresAt: Number(readI64(mandateAccount.data, 104)),
      };
    },
  });

  const evidence = (request) => ({
    schema: "lab-fixed-rate-v1",
    profile: "DEVNET_LAB",
    assetId: request.assetId,
    inputMint: request.inputMint,
    outputMint: request.outputMint,
    rateNumerator: "1",
    rateDenominator: "1",
    observedAt: Number(chainNow) - 5,
    expiresAt: Number(chainNow) + 120,
  });
  const base = {
    profile: "DEVNET_LAB",
    assetId: "lab:dAAPL",
    owner: owner.publicKey.toBase58(),
    mandate: mandate.toBase58(),
    pool: pool.toBase58(),
    inputMint: inputMint.toBase58(),
    outputMint: outputMint.toBase58(),
    tokenProgram: TOKEN,
    network: "devnet-lab",
    amountIn: "1000",
    minimumAmountOut: "1000",
    rateNumerator: "1",
    rateDenominator: "1",
    nonce: "42",
  };
  chainNow = await clock(connection);
  const proposal = { ...base, evidence: evidence(base) };
  const before = {
    ownerInput: (await tokenAmount(connection, ownerInput.address)).toString(),
    ownerOutput: (await tokenAmount(connection, ownerOutput.address)).toString(),
    poolInput: (await tokenAmount(connection, poolInput)).toString(),
    poolOutput: (await tokenAmount(connection, poolOutput)).toString(),
  };
  const authorized = await service.authorize(proposal);
  const receipt = PublicKey.findProgramAddressSync(
    [Buffer.from("receipt"), mandate.toBuffer(), u64(42n)],
    programId,
  )[0];
  const swapAccounts = [
    meta(owner.publicKey, true, true), meta(pool), meta(mandate, true), meta(portfolio, true),
    meta(inputMint), meta(outputMint), meta(ownerInput.address, true), meta(ownerOutput.address, true),
    meta(poolInput, true), meta(poolOutput, true), meta(receipt, true), meta(TOKEN_PROGRAM_ID),
    meta(SystemProgram.programId), meta(governance.config), meta(SYSVAR_INSTRUCTIONS_PUBKEY),
  ];
  let happy = null;
  if (authorized.decision === "AUTHORIZED") {
    const fields = authorized.fields;
    happy = await submit(connection, [
      authorized.proof,
      ix("execute_swap", [
        u64(fields.amountIn), u64(fields.minimumOut), u64(fields.nonce), i64(fields.deadline),
        u64(fields.rateNumerator), u64(fields.rateDenominator), fields.executionDigest,
        fields.evidenceDigest, fields.proposalDigest, i64(fields.issuedAt), i64(fields.expiresAt),
      ], swapAccounts),
    ], [owner]);
  }
  const receiptAccount = await connection.getAccountInfo(receipt);
  const after = {
    ownerInput: (await tokenAmount(connection, ownerInput.address)).toString(),
    ownerOutput: (await tokenAmount(connection, ownerOutput.address)).toString(),
    poolInput: (await tokenAmount(connection, poolInput)).toString(),
    poolOutput: (await tokenAmount(connection, poolOutput)).toString(),
  };
  const receiptDigest = receiptAccount ? Buffer.from(receiptAccount.data.subarray(136, 168)).toString("hex") : null;
  record({
    id: "C-E2E",
    name: "serviço autoriza o swap sintético e o contrato liquida",
    ok: authorized.decision === "AUTHORIZED"
      && happy?.err == null
      && receiptDigest === authorized.digest?.toString("hex")
      && after.ownerInput === "9000"
      && after.ownerOutput === "1000"
      && service.signerInvocations === 1,
    expected: "AUTHORIZED and settled 1000",
    observed: authorized.decision === "AUTHORIZED"
      ? `${happy?.err ? "swap failed" : happy?.signature} receipt ${receipt?.toBase58()} digest ${receiptDigest}`
      : authorized.reasons.join("; "),
    signature: happy?.signature ?? null,
    decision: authorized.decision,
    digest: authorized.digest?.toString("hex") ?? null,
    before,
    after,
  });

  const signsBeforeBlocked = service.signerInvocations;
  const blocked = await service.authorize({
    ...proposal,
    nonce: "43",
    assetId: "lab:not-registered",
    evidence: evidence({ ...base, assetId: "lab:not-registered" }),
  });
  record({
    id: "C-BLOCK",
    name: "proposta inválida não recebe assinatura",
    ok: blocked.decision === "BLOCKED" && blocked.proof === null && service.signerInvocations === signsBeforeBlocked,
    expected: "BLOCKED and zero new signatures",
    observed: `${blocked.decision}: ${blocked.reasons.join("; ")}`,
    signerInvocations: service.signerInvocations,
  });

  const bypassReceipt = PublicKey.findProgramAddressSync(
    [Buffer.from("receipt"), mandate.toBuffer(), u64(44n)],
    programId,
  )[0];
  const bypassAccounts = swapAccounts.map((entry, index) => index === 10 ? meta(bypassReceipt, true) : entry);
  const bypass = await submit(connection, [
    ix("execute_swap", [
      u64(1000n), u64(1000n), u64(44n), i64(chainNow + 60n), u64(1n), u64(1n),
      Buffer.alloc(32), Buffer.alloc(32), Buffer.alloc(32), i64(chainNow), i64(chainNow + 120n),
    ], bypassAccounts),
  ], [owner]);
  const bypassText = (bypass.logs ?? []).join("\n");
  const bypassReceiptAccount = await connection.getAccountInfo(bypassReceipt);
  record({
    id: "C-BYPASS",
    name: "execute_swap direto sem ProofGate é rejeitado",
    ok: Boolean(bypass.err) && bypassText.includes("MissingProofGateAuthorization") && !bypassReceiptAccount,
    expected: "MissingProofGateAuthorization",
    observed: bypassText.split("\n").filter((line) => line.includes("Error") || line.includes("failed")).slice(-3).join(" | "),
    signature: bypass.signature,
    receiptExists: Boolean(bypassReceiptAccount),
  });
}
