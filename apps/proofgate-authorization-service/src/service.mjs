/**
 * Authorization boundary. The only exported operation is createAuthorizationService.
 * Signing happens inside the closure, after evaluateAuthorizationRequest returns
 * AUTHORIZED and the trusted configuration is read again. There is no
 * signArbitraryDigest export. The nonce set is process memory only and is
 * not a uniqueness guarantee; the on-chain receipt is.
 */
import { PublicKey } from "@solana/web3.js";
import {
  authorizationDigest,
  canonicalAuthorization,
  executionDigest,
  proofInstruction,
} from "./canonical.mjs";
import { CLASSIC_TOKEN_PROGRAM, verifyLabAsset } from "./assets.mjs";
import { sameTrustedConfig } from "./config.mjs";
import { evidenceDigest, inspectLabEvidence, proposalDigest } from "./evidence.mjs";
import { evaluateAuthorizationRequest, parseBaseUnits } from "./policy.mjs";

const DEFAULT_TTL_SECONDS = 120;

function pubkey(value, label, reasons) {
  try {
    const key = new PublicKey(value);
    if (key.toBase58() !== value) reasons.push(`${label} is not canonical base58`);
    return key;
  } catch {
    reasons.push(`${label} is not a public key`);
    return null;
  }
}

function block(reasons) {
  return { decision: "BLOCKED", reasons: [...new Set(reasons)], proof: null, message: null, digest: null };
}

export function createAuthorizationService({ policySigner, loadConfig, labRegistry, loadMandate, now = () => Date.now() }) {
  if (!policySigner?.secretKey || !policySigner.publicKey) throw new Error("isolated policy signer is required");
  const registry = labRegistry instanceof Map ? labRegistry : new Map(labRegistry);
  const usedNonces = new Set();
  let signs = 0;
  let queue = Promise.resolve();

  async function authorizeExclusive(request) {
    const shape = [];
    if (!request || typeof request !== "object" || Array.isArray(request)) return block(["request is not an object"]);
    const owner = pubkey(request.owner, "owner", shape);
    const mandateKey = pubkey(request.mandate, "mandate", shape);
    const pool = pubkey(request.pool, "pool", shape);
    const inputMint = pubkey(request.inputMint, "input mint", shape);
    const outputMint = pubkey(request.outputMint, "output mint", shape);
    const tokenProgram = pubkey(request.tokenProgram, "token program", shape);
    if (shape.length) return block(shape);
    if (tokenProgram.toBase58() !== CLASSIC_TOKEN_PROGRAM) shape.push("token program is not classic SPL Token");

    const nowSeconds = Math.floor(Number(now()) / 1000);
    const config = await loadConfig();
    if (config?.policySigner?.toBase58() !== policySigner.publicKey.toBase58()) {
      return block(["trusted configuration does not match the isolated signing key"]);
    }
    const asset = verifyLabAsset(registry, {
      assetId: request.assetId,
      outputMint: request.outputMint,
      tokenProgram: request.tokenProgram,
      network: request.network,
    });
    const evidence = request.evidence
      ? inspectLabEvidence(request.evidence, {
        assetId: request.assetId,
        inputMint: request.inputMint,
        outputMint: request.outputMint,
        rateNumerator: request.rateNumerator,
        rateDenominator: request.rateDenominator,
      }, nowSeconds)
      : { ok: false, reasons: ["evidence missing"] };
    let evidenceBytes = null;
    if (evidence.ok) {
      evidenceBytes = evidenceDigest({
        assetId: request.assetId,
        inputMint,
        outputMint,
        rateNumerator: BigInt(request.rateNumerator),
        rateDenominator: BigInt(request.rateDenominator),
        observedAt: request.evidence.observedAt,
        expiresAt: request.evidence.expiresAt,
      });
      if (request.evidence.digest && request.evidence.digest !== evidenceBytes.toString("hex")) {
        evidence.ok = false;
        evidence.reasons = [...evidence.reasons, "evidence digest does not match the evidence body"];
      }
    }
    const mandate = await loadMandate(request);
    const normalized = mandate ? {
      ...mandate,
      maxPerTrade: BigInt(mandate.maxPerTrade),
      maxDaily: BigInt(mandate.maxDaily),
      spent: BigInt(mandate.spent),
      portfolioRemaining: BigInt(mandate.portfolioRemaining),
      rateNumerator: BigInt(mandate.rateNumerator),
      rateDenominator: BigInt(mandate.rateDenominator),
    } : null;
    const nonceKey = `${request.mandate}:${request.nonce}`;
    const decision = evaluateAuthorizationRequest({
      request,
      asset: shape.length ? { ok: false, reasons: shape } : asset,
      evidence,
      config: {
        ...config,
        deploymentId: Buffer.from(config.deploymentId),
      },
      mandate: normalized,
      nowSeconds,
      nonceAlreadyUsed: usedNonces.has(nonceKey),
    });
    if (decision.status !== "AUTHORIZED") return block(decision.reasons);

    const fresh = await loadConfig();
    if (!sameTrustedConfig(config, fresh)) return block(["configuration changed before signing"]);
    if (usedNonces.has(nonceKey)) return block(["nonce already used by this service instance"]);

    const ttl = request.authorizationTtlSeconds ?? DEFAULT_TTL_SECONDS;
    const issuedAt = BigInt(nowSeconds);
    const expiresAt = issuedAt + BigInt(ttl);
    const deadline = issuedAt + 60n;
    const amountIn = parseBaseUnits(request.amountIn);
    const minimumOut = parseBaseUnits(request.minimumAmountOut);
    const rateNumerator = BigInt(request.rateNumerator);
    const rateDenominator = BigInt(request.rateDenominator);
    const amountOut = amountIn * rateNumerator / rateDenominator;
    const execution = executionDigest({
      programId: fresh.programId,
      owner,
      pool,
      mandate: mandateKey,
      inputMint,
      outputMint,
      amountIn,
      amountOut,
      minimumOut,
      nonce: BigInt(request.nonce),
      deadline,
      rateNumerator,
      rateDenominator,
    });
    const proposal = proposalDigest({
      owner, mandate: mandateKey, pool, inputMint, outputMint,
      amountIn, minimumOut, rateNumerator, rateDenominator,
      nonce: BigInt(request.nonce),
      evidenceDigest: evidenceBytes,
    });
    const message = canonicalAuthorization({
      programId: fresh.programId,
      deploymentId: Buffer.from(fresh.deploymentId),
      config: fresh.config,
      policySigner: fresh.policySigner,
      policyVersion: fresh.policyVersion,
      authorizationEpoch: fresh.authorizationEpoch,
      owner,
      mandate: mandateKey,
      pool,
      inputMint,
      outputMint,
      tokenProgram,
      amountIn,
      minimumOut,
      rateNumerator,
      rateDenominator,
      evidenceDigest: evidenceBytes,
      proposalDigest: proposal,
      executionDigest: execution,
      nonce: BigInt(request.nonce),
      issuedAt,
      expiresAt,
    });
    if (!authorizationDigest(message).equals(authorizationDigest(canonicalAuthorization({
      programId: fresh.programId,
      deploymentId: Buffer.from(fresh.deploymentId),
      config: fresh.config,
      policySigner: fresh.policySigner,
      policyVersion: fresh.policyVersion,
      authorizationEpoch: fresh.authorizationEpoch,
      owner, mandate: mandateKey, pool, inputMint, outputMint, tokenProgram,
      amountIn, minimumOut, rateNumerator, rateDenominator,
      evidenceDigest: evidenceBytes, proposalDigest: proposal, executionDigest: execution,
      nonce: BigInt(request.nonce), issuedAt, expiresAt,
    })))) {
      return block(["canonical authorization was not stable"]);
    }
    usedNonces.add(nonceKey);
    signs += 1;
    return {
      decision: "AUTHORIZED",
      reasons: [],
      message,
      digest: authorizationDigest(message),
      proof: proofInstruction(policySigner, message),
      fields: {
        amountIn, minimumOut, nonce: BigInt(request.nonce), deadline, issuedAt, expiresAt,
        rateNumerator, rateDenominator, executionDigest: execution,
        evidenceDigest: evidenceBytes, proposalDigest: proposal,
      },
    };
  }

  function authorize(request) {
    const run = queue.then(() => authorizeExclusive(request));
    queue = run.then(() => undefined, () => undefined);
    return run;
  }

  return {
    authorize,
    get signerInvocations() { return signs; },
  };
}
