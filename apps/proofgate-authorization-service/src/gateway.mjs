/**
 * Local lab boundary. The browser receives decisions and an unsigned-by-owner
 * transaction. The policy secret never leaves this process.
 */
import { Connection, PublicKey } from "@solana/web3.js";
import { CLASSIC_TOKEN_PROGRAM } from "./assets.mjs";
import { parseProofGateConfig } from "./config.mjs";
import { evidenceDigest } from "./evidence.mjs";
import { assertLabEnvironment } from "./environment.mjs";
import { createAuthorizationService } from "./service.mjs";
import { createSessionStore } from "./session.mjs";
import {
  SETTLEMENT_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "./canonical.mjs";
import {
  buildOwnerSetupTransaction,
  buildSettlementTransaction,
  unsignedTransactionBase64,
} from "./settlement-tx.mjs";

const CLOCK = new PublicKey("SysvarC1ock11111111111111111111111111111111");
const MAX_BODY_BYTES = 8_192;

function text(value, max = 80) {
  return typeof value === "string" && value.length > 0 && value.length <= max ? value : null;
}

function digits(value) {
  return typeof value === "string" && /^(0|[1-9][0-9]{0,19})$/.test(value) ? value : null;
}

function listedLabAssets(runtime) {
  if (!runtime) return [];
  if (Array.isArray(runtime.assets) && runtime.assets.length > 0) return runtime.assets;
  if (!runtime.asset) return [];
  return [{
    ...runtime.asset,
    pool: runtime.asset.pool ?? runtime.pool,
    mint: runtime.asset.mint ?? runtime.outputMint,
  }];
}

function selectedLabAsset(runtime, assetId) {
  const assets = listedLabAssets(runtime);
  if (typeof assetId === "string" && assetId.length > 0) {
    return assets.find((asset) => asset.assetId === assetId) ?? null;
  }
  return assets.find((asset) => asset.assetId === runtime?.asset?.assetId) ?? assets[0] ?? null;
}

function assetPool(runtime, asset) {
  return asset?.pool ?? runtime?.pool ?? null;
}

function assetOutputMint(runtime, asset) {
  return asset?.mint ?? runtime?.outputMint ?? null;
}

export function createLabGateway({
  env,
  policySigner,
  runtime,
  connection,
  researchAssets = [],
  now = () => Date.now(),
  session = createSessionStore({ now }),
}) {
  const environment = assertLabEnvironment(env);
  const rpc = connection ?? (environment.ok ? new Connection(environment.rpcUrl, "confirmed") : null);
  let chainSeconds = Math.floor(now() / 1000);
  let service = null;

  function signer() {
    if (!service) {
      service = createAuthorizationService({
        policySigner,
        now: () => chainSeconds * 1000,
        labRegistry: new Map(listedLabAssets(runtime).map((asset) => [asset.assetId, asset])),
        loadConfig: () => loadTrustedConfig(),
        loadMandate: (request) => loadTrustedMandate(request.owner, selectedLabAsset(runtime, request.assetId)),
      });
    }
    return service;
  }

  async function account(address) {
    return rpc.getAccountInfo(new PublicKey(address));
  }

  async function chainNow() {
    const info = await account(CLOCK.toBase58());
    if (!info) throw new Error("Clock sysvar is missing");
    return Number(Buffer.from(info.data).readBigInt64LE(32));
  }

  async function loadTrustedConfig() {
    if (!runtime) throw new Error("lab runtime is missing");
    const info = await account(runtime.config);
    if (!info) throw new Error("proofgate config is missing");
    const parsed = parseProofGateConfig(info.data);
    if (Buffer.from(parsed.deploymentId).toString("hex") !== runtime.deploymentId) {
      throw new Error("runtime deployment id does not match the chain");
    }
    if (parsed.policySigner.toBase58() !== runtime.policySigner) {
      throw new Error("runtime policy signer does not match the chain");
    }
    if (parsed.policySigner.toBase58() !== policySigner.publicKey.toBase58()) {
      throw new Error("isolated signing key does not match the chain");
    }
    return {
      ...parsed,
      programId: SETTLEMENT_PROGRAM_ID,
      config: new PublicKey(runtime.config),
      profile: "DEVNET_LAB",
    };
  }

  async function ownerSetupPresence(owner, asset) {
    if (!runtime || !asset || !assetPool(runtime, asset)) return { portfolioExists: false, mandateExists: false };
    const ownerKey = new PublicKey(owner);
    const portfolio = PublicKey.findProgramAddressSync(
      [Buffer.from("portfolio"), ownerKey.toBuffer(), new PublicKey(runtime.inputMint).toBuffer()],
      SETTLEMENT_PROGRAM_ID,
    )[0];
    const mandate = PublicKey.findProgramAddressSync(
      [Buffer.from("mandate"), ownerKey.toBuffer(), new PublicKey(assetPool(runtime, asset)).toBuffer()],
      SETTLEMENT_PROGRAM_ID,
    )[0];
    const [portfolioAccount, mandateAccount] = await Promise.all([
      account(portfolio.toBase58()),
      account(mandate.toBase58()),
    ]);
    return { portfolioExists: Boolean(portfolioAccount), mandateExists: Boolean(mandateAccount) };
  }

  async function loadTrustedMandate(owner, asset) {
    const poolId = assetPool(runtime, asset);
    if (!runtime || !asset || !poolId) return null;
    const ownerKey = new PublicKey(owner);
    const pool = new PublicKey(poolId);
    const inputMint = new PublicKey(runtime.inputMint);
    const portfolio = PublicKey.findProgramAddressSync(
      [Buffer.from("portfolio"), ownerKey.toBuffer(), inputMint.toBuffer()],
      SETTLEMENT_PROGRAM_ID,
    )[0];
    const mandate = PublicKey.findProgramAddressSync(
      [Buffer.from("mandate"), ownerKey.toBuffer(), pool.toBuffer()],
      SETTLEMENT_PROGRAM_ID,
    )[0];
    const [mandateAccount, poolAccount, portfolioAccount] = await Promise.all([
      account(mandate.toBase58()),
      account(pool.toBase58()),
      account(portfolio.toBase58()),
    ]);
    if (!mandateAccount || !poolAccount || !portfolioAccount) return null;
    const data = Buffer.from(mandateAccount.data);
    const poolData = Buffer.from(poolAccount.data);
    const portfolioData = Buffer.from(portfolioAccount.data);
    return {
      owner: new PublicKey(data.subarray(8, 40)).toBase58(),
      mandate: mandate.toBase58(),
      pool: new PublicKey(data.subarray(40, 72)).toBase58(),
      inputMint: new PublicKey(poolData.subarray(40, 72)).toBase58(),
      outputMint: new PublicKey(poolData.subarray(72, 104)).toBase58(),
      maxPerTrade: data.readBigUInt64LE(72),
      maxDaily: data.readBigUInt64LE(80),
      spent: data.readBigUInt64LE(88),
      portfolioRemaining: portfolioData.readBigUInt64LE(72) - portfolioData.readBigUInt64LE(80),
      rateNumerator: poolData.readBigUInt64LE(104),
      rateDenominator: poolData.readBigUInt64LE(112),
      rateExpiresAt: Number(poolData.readBigInt64LE(120)),
      paused: data[112] !== 0,
      poolPaused: poolData[128] !== 0,
      portfolioPaused: portfolioData[96] !== 0,
      expiresAt: Number(data.readBigInt64LE(104)),
    };
  }

  function publicAsset(record, lane) {
    return {
      assetId: record.assetId,
      ticker: record.ticker ?? record.assetId,
      displayName: record.displayName,
      lane,
      mint: lane === "LAB_VERIFIED" ? record.mint : null,
      synthetic: lane === "LAB_VERIFIED",
      disclaimer: lane === "LAB_VERIFIED"
        ? "Experimental synthetic token. It is not a share of the named company."
        : "Research catalog entry. It cannot be settled.",
    };
  }

  async function getConfig() {
    if (!environment.ok) return { ok: false, status: "ERROR", reasons: environment.reasons };
    try {
      const program = await account(environment.programId);
      if (!program?.executable) return { ok: false, status: "ERROR", reasons: ["settlement program is not executable on this RPC"] };
      const config = await loadTrustedConfig();
      return {
        ok: true,
        network: "surfpool-local",
        rpcUrl: environment.rpcUrl,
        programId: environment.programId,
        deploymentId: Buffer.from(config.deploymentId).toString("hex"),
        config: runtime.config,
        policySigner: config.policySigner.toBase58(),
        policyVersion: config.policyVersion.toString(),
        authorizationEpoch: config.authorizationEpoch.toString(),
        paused: config.paused,
        wallet: null,
        inputMint: runtime.inputMint,
        outputMint: runtime.outputMint,
        networkIdentity: "loopback RPC only; Surfpool does not provide a genesis hash",
      };
    } catch (error) {
      return { ok: false, status: "ERROR", reasons: [error instanceof Error ? error.message : "RPC unavailable"], confirmed: false };
    }
  }

  async function getAssets() {
    if (!environment.ok) return { ok: false, status: "ERROR", reasons: environment.reasons, confirmed: false };
    const research = researchAssets.map((asset) => publicAsset(asset, "RESEARCH_ONLY"));
    const records = listedLabAssets(runtime);
    if (records.length === 0) return { ok: true, assets: research };
    try {
      const listed = [];
      for (const record of records) {
        const mint = await account(record.mint);
        const lane = mint ? "LAB_VERIFIED" : "BLOCKED";
        listed.push({
          ...publicAsset(record, lane === "LAB_VERIFIED" ? "LAB_VERIFIED" : "RESEARCH_ONLY"),
          lane,
          mint: mint ? record.mint : null,
        });
      }
      return { ok: true, assets: [...research, ...listed] };
    } catch (error) {
      return { ok: false, status: "ERROR", reasons: [error instanceof Error ? error.message : "RPC unavailable"], confirmed: false };
    }
  }

  async function getMandate(owner, assetId) {
    const key = text(owner, 64);
    if (!key) return { ok: false, status: "ERROR", reasons: ["owner is invalid"] };
    const asset = selectedLabAsset(runtime, assetId);
    if (assetId && !asset) return { ok: false, status: "ERROR", reasons: ["asset is not the verified lab mint"] };
    try {
      const setup = await ownerSetupPresence(key, asset);
      const mandate = await loadTrustedMandate(key, asset);
      if (!mandate) return { ok: true, exists: false, owner: key, ...setup };
      return {
        ok: true,
        exists: true,
        portfolioExists: true,
        mandateExists: true,
        owner: mandate.owner,
        pool: mandate.pool,
        inputMint: mandate.inputMint,
        outputMint: mandate.outputMint,
        maxPerTrade: mandate.maxPerTrade.toString(),
        maxDaily: mandate.maxDaily.toString(),
        spent: mandate.spent.toString(),
        portfolioRemaining: mandate.portfolioRemaining.toString(),
        expiresAt: mandate.expiresAt,
        paused: mandate.paused || mandate.poolPaused || mandate.portfolioPaused,
        rateNumerator: mandate.rateNumerator.toString(),
        rateDenominator: mandate.rateDenominator.toString(),
        rateExpiresAt: mandate.rateExpiresAt,
      };
    } catch (error) {
      return { ok: false, status: "ERROR", reasons: [error instanceof Error ? error.message : "RPC unavailable"], confirmed: false };
    }
  }

  function challenge({ owner, host }) {
    if (!session.allow(`challenge:${owner}`)) return { ok: false, status: 429, error: "rate limit" };
    return { ok: true, ...session.issue({ owner, host }) };
  }

  async function proposalFromChain(owner, body) {
    const current = await chainNow();
    chainSeconds = current;
    const asset = selectedLabAsset(runtime, body.assetId);
    if (!asset) return { error: "asset is not the verified lab mint" };
    const mandate = await loadTrustedMandate(owner, asset);
    if (!mandate) return { error: "mandate not found" };
    const remaining = mandate.rateExpiresAt - current;
    if (remaining <= 0) return { error: "conversion rate expired" };
    const ttl = Math.min(body.authorizationTtlSeconds ?? 120, remaining);
    const observedAt = current - 5;
    const outputMint = assetOutputMint(runtime, asset);
    const evidence = {
      schema: "lab-fixed-rate-v1",
      profile: "DEVNET_LAB",
      assetId: asset.assetId,
      inputMint: runtime.inputMint,
      outputMint,
      rateNumerator: mandate.rateNumerator.toString(),
      rateDenominator: mandate.rateDenominator.toString(),
      observedAt,
      expiresAt: current + ttl,
    };
    return {
      current,
      request: {
        profile: "DEVNET_LAB",
        assetId: asset.assetId,
        owner,
        mandate: mandate.mandate,
        pool: assetPool(runtime, asset),
        inputMint: runtime.inputMint,
        outputMint,
        tokenProgram: CLASSIC_TOKEN_PROGRAM,
        network: "devnet-lab",
        amountIn: body.amountIn,
        minimumAmountOut: body.minimumAmountOut,
        rateNumerator: mandate.rateNumerator.toString(),
        rateDenominator: mandate.rateDenominator.toString(),
        nonce: body.nonce,
        authorizationTtlSeconds: ttl,
        evidence,
      },
    };
  }

  async function authorize({ host, body, bytes = 0 }) {
    if (bytes > MAX_BODY_BYTES) return { ok: false, status: 413, error: "request is too large" };
    if (!environment.ok) return { ok: false, status: "ERROR", decision: "ERROR", reasons: environment.reasons, proof: null };
    if (!body || typeof body !== "object") return { ok: false, status: 400, error: "request body must be an object" };
    if (body.walletCluster === "mainnet-beta" || body.walletCluster === "mainnet") {
      return { ok: false, decision: "BLOCKED", reasons: ["wallet cluster is not the local lab"], proof: null, signerInvocations: signer().signerInvocations };
    }
    const owner = text(body.owner, 64);
    const amountIn = digits(body.amountIn);
    const minimumAmountOut = digits(body.minimumAmountOut);
    const nonce = digits(body.nonce);
    if (!owner || !amountIn || !minimumAmountOut || !nonce) {
      return { ok: false, decision: "BLOCKED", reasons: ["proposal fields are invalid"], proof: null };
    }
    if (!session.allow(`authorize:${owner}`)) return { ok: false, status: 429, error: "rate limit" };
    const auth = session.consume({
      owner,
      host,
      nonce: text(body.challenge?.nonce, 64),
      signature: text(body.challenge?.signature, 120),
    });
    if (!auth.ok) return { ok: false, decision: "BLOCKED", reasons: [auth.error], proof: null, signerInvocations: service?.signerInvocations ?? 0 };
    const asset = selectedLabAsset(runtime, body.assetId);
    if (body.assetId && !asset) {
      return { ok: false, decision: "BLOCKED", reasons: ["asset is not the verified lab mint"], proof: null, signerInvocations: signer().signerInvocations };
    }
    let built;
    try {
      built = await proposalFromChain(owner, { assetId: asset?.assetId, amountIn, minimumAmountOut, nonce, authorizationTtlSeconds: body.authorizationTtlSeconds });
    } catch (error) {
      return { ok: false, status: "ERROR", decision: "ERROR", reasons: [error instanceof Error ? error.message : "RPC unavailable"], proof: null, confirmed: false };
    }
    if (built.error) return { ok: false, decision: "BLOCKED", reasons: [built.error], proof: null, signerInvocations: signer().signerInvocations };
    const beforeSigns = signer().signerInvocations;
    const decision = await signer().authorize(built.request);
    if (decision.decision !== "AUTHORIZED") {
      return { ok: true, decision: "BLOCKED", reasons: decision.reasons, proof: null, signerInvocations: signer().signerInvocations, signed: signer().signerInvocations > beforeSigns };
    }
    const latest = await rpc.getLatestBlockhash("confirmed");
    const settled = asset ?? selectedLabAsset(runtime, body.assetId);
    const mandate = await loadTrustedMandate(owner, settled);
    const portfolio = PublicKey.findProgramAddressSync(
      [Buffer.from("portfolio"), new PublicKey(owner).toBuffer(), new PublicKey(runtime.inputMint).toBuffer()],
      SETTLEMENT_PROGRAM_ID,
    )[0];
    const builtTx = buildSettlementTransaction({
      authorization: decision,
      proof: decision.proof,
      owner,
      pool: assetPool(runtime, settled),
      mandate: mandate.mandate,
      portfolio,
      inputMint: runtime.inputMint,
      outputMint: assetOutputMint(runtime, settled),
      config: runtime.config,
      blockhash: latest.blockhash,
      lastValidBlockHeight: latest.lastValidBlockHeight,
    });
    return {
      ok: true,
      decision: "AUTHORIZED",
      reasons: [],
      proof: unsignedTransactionBase64(builtTx.transaction),
      blockhash: latest.blockhash,
      lastValidBlockHeight: latest.lastValidBlockHeight,
      digest: decision.digest.toString("hex"),
      executionDigest: Buffer.from(decision.fields.executionDigest).toString("hex"),
      receipt: builtTx.receipt.toBase58(),
      nonce,
      expiresAt: Number(decision.fields.expiresAt),
      issuedAt: Number(decision.fields.issuedAt),
      amountIn,
      minimumAmountOut,
      expectedOut: (decision.fields.amountIn * decision.fields.rateNumerator / decision.fields.rateDenominator).toString(),
      rateNumerator: mandate.rateNumerator.toString(),
      rateDenominator: mandate.rateDenominator.toString(),
      owner,
      policyVersion: (await loadTrustedConfig()).policyVersion.toString(),
      authorizationEpoch: (await loadTrustedConfig()).authorizationEpoch.toString(),
      transactionBytes: builtTx.size,
      signerInvocations: signer().signerInvocations,
      signed: true,
      evidenceDigest: evidenceDigest({
        assetId: settled.assetId,
        inputMint: new PublicKey(runtime.inputMint),
        outputMint: new PublicKey(assetOutputMint(runtime, settled)),
        rateNumerator: mandate.rateNumerator,
        rateDenominator: mandate.rateDenominator,
        observedAt: built.request.evidence.observedAt,
        expiresAt: built.request.evidence.expiresAt,
      }).toString("hex"),
    };
  }

  async function setup({ host, body }) {
    const owner = text(body?.owner, 64);
    const auth = session.consume({
      owner,
      host,
      nonce: text(body?.challenge?.nonce, 64),
      signature: text(body?.challenge?.signature, 120),
    });
    if (!auth.ok) return { ok: false, decision: "BLOCKED", reasons: [auth.error] };
    const kind = body.kind === "portfolio" || body.kind === "mandate" ? body.kind : null;
    const asset = selectedLabAsset(runtime, body.assetId);
    if (!kind || !runtime || !asset || !assetPool(runtime, asset)) return { ok: false, decision: "BLOCKED", reasons: ["setup is unavailable"] };
    const maxPerTrade = BigInt(runtime.limits.maxPerTrade);
    const maxDaily = BigInt(runtime.limits.maxDaily);
    const portfolioDaily = BigInt(runtime.limits.portfolioDaily);
    const latest = await rpc.getLatestBlockhash("confirmed");
    const current = await chainNow();
    const ownerKey = new PublicKey(owner);
    const portfolio = PublicKey.findProgramAddressSync(
      [Buffer.from("portfolio"), ownerKey.toBuffer(), new PublicKey(runtime.inputMint).toBuffer()],
      SETTLEMENT_PROGRAM_ID,
    )[0];
    const mandate = PublicKey.findProgramAddressSync(
      [Buffer.from("mandate"), ownerKey.toBuffer(), new PublicKey(assetPool(runtime, asset)).toBuffer()],
      SETTLEMENT_PROGRAM_ID,
    )[0];
    const built = buildOwnerSetupTransaction({
      kind,
      owner,
      pool: assetPool(runtime, asset),
      inputMint: runtime.inputMint,
      portfolio,
      mandate,
      maxPerTrade,
      maxDaily: kind === "portfolio" ? portfolioDaily : maxDaily,
      expiresAt: current + 86_400,
      blockhash: latest.blockhash,
      lastValidBlockHeight: latest.lastValidBlockHeight,
    });
    return {
      ok: true,
      decision: "PENDING",
      transaction: unsignedTransactionBase64(built.transaction),
      blockhash: latest.blockhash,
      lastValidBlockHeight: latest.lastValidBlockHeight,
      portfolio: portfolio.toBase58(),
      mandate: mandate.toBase58(),
      maxPerTrade: maxPerTrade.toString(),
      maxDaily: (kind === "portfolio" ? portfolioDaily : maxDaily).toString(),
    };
  }

  async function receipt(address) {
    const key = text(address, 64);
    if (!key) return { ok: false, status: "ERROR", reasons: ["receipt address is invalid"] };
    try {
      const info = await account(key);
      if (!info) return { ok: true, exists: false };
      const data = Buffer.from(info.data);
      return {
        ok: true,
        exists: true,
        address: key,
        mandate: new PublicKey(data.subarray(8, 40)).toBase58(),
        owner: new PublicKey(data.subarray(40, 72)).toBase58(),
        nonce: data.readBigUInt64LE(72).toString(),
        amountIn: data.readBigUInt64LE(80).toString(),
        amountOut: data.readBigUInt64LE(88).toString(),
        executionDigest: data.subarray(96, 128).toString("hex"),
        authorizationDigest: data.subarray(136, 168).toString("hex"),
      };
    } catch (error) {
      return { ok: false, status: "ERROR", reasons: [error instanceof Error ? error.message : "RPC unavailable"], confirmed: false };
    }
  }

  async function reconcile({ signature, receiptAddress, authorizationDigest }) {
    const sig = text(signature, 128);
    const address = text(receiptAddress, 64);
    const digest = text(authorizationDigest, 64);
    if (!sig || !address || !digest) return { ok: false, decision: "ERROR", reasons: ["reconciliation inputs are invalid"], confirmed: false };
    try {
      const tx = await rpc.getTransaction(sig, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
      if (!tx) return { ok: false, decision: "ERROR", reasons: ["transaction is not confirmed"], confirmed: false };
      if (tx.meta?.err) return { ok: false, decision: "ERROR", reasons: ["transaction failed on chain"], confirmed: false, err: tx.meta.err };
      const found = await receipt(address);
      if (!found.exists) return { ok: false, decision: "ERROR", reasons: ["receipt account is missing"], confirmed: false };
      if (found.authorizationDigest !== digest) return { ok: false, decision: "ERROR", reasons: ["authorization digest does not match the receipt"], confirmed: false };
      return {
        ok: true,
        decision: "EXECUTED",
        confirmed: true,
        signature: sig,
        receipt: found,
        preTokenBalances: tx.meta.preTokenBalances ?? [],
        postTokenBalances: tx.meta.postTokenBalances ?? [],
      };
    } catch (error) {
      return { ok: false, decision: "ERROR", reasons: [error instanceof Error ? error.message : "RPC unavailable"], confirmed: false };
    }
  }

  return {
    getConfig,
    getAssets,
    getMandate,
    challenge,
    authorize,
    setup,
    receipt,
    reconcile,
    get signerInvocations() { return service?.signerInvocations ?? 0; },
    tokenProgram: TOKEN_PROGRAM_ID.toBase58(),
  };
}

export { MAX_BODY_BYTES };
