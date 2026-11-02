/**
 * Pure decision. This module cannot sign and does not receive a private key.
 * AUTHORIZED means the deterministic policy allows the signing boundary to run.
 * It does not mean the swap has settled.
 */
const U64_MAX = (1n << 64n) - 1n;
export const MAX_AUTHORIZATION_TTL_SECONDS = 300;

export function parseBaseUnits(value) {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]*)$/.test(value)) return null;
  try {
    const amount = BigInt(value);
    if (amount <= 0n || amount > U64_MAX) return null;
    return amount;
  } catch {
    return null;
  }
}

export function evaluateAuthorizationRequest(input) {
  const reasons = [];
  const { request, asset, evidence, config, mandate, nowSeconds, nonceAlreadyUsed } = input;
  // `approved` and `status: REVIEWABLE` are not read as permission.
  if (request?.profile === "MAINNET_READ_ONLY") reasons.push("mainnet read-only profile cannot authorize settlement");
  if (request?.profile !== "DEVNET_LAB") reasons.push("profile is not the experimental lab");
  if (!asset?.ok) reasons.push(...(asset?.reasons ?? ["asset not verified"]));
  if (!evidence?.ok) reasons.push(...(evidence?.reasons ?? ["evidence missing"]));
  if (!config) reasons.push("trusted configuration missing");
  else {
    if (config.paused) reasons.push("proofgate configuration is paused");
    if (config.profile !== "DEVNET_LAB") reasons.push("trusted deployment is not the lab profile");
    if (request?.policyVersion !== undefined && BigInt(request.policyVersion) !== BigInt(config.policyVersion)) {
      reasons.push("client policy version does not match the trusted configuration");
    }
    if (request?.authorizationEpoch !== undefined && BigInt(request.authorizationEpoch) !== BigInt(config.authorizationEpoch)) {
      reasons.push("client authorization epoch does not match the trusted configuration");
    }
    if (request?.deploymentId && Buffer.compare(Buffer.from(request.deploymentId), config.deploymentId) !== 0) {
      reasons.push("client deployment id does not match the trusted configuration");
    }
    if (request?.policySigner && request.policySigner !== config.policySigner.toBase58()) {
      reasons.push("client policy signer does not match the trusted configuration");
    }
  }
  if (!mandate) reasons.push("mandate not found");
  else {
    if (mandate.owner !== request.owner) reasons.push("mandate belongs to another owner");
    if (mandate.mandate !== request.mandate) reasons.push("mandate identity mismatch");
    if (mandate.pool !== request.pool) reasons.push("mandate pool mismatch");
    if (mandate.inputMint !== request.inputMint || mandate.outputMint !== request.outputMint) {
      reasons.push("mandate mints do not match the proposal");
    }
    if (mandate.paused || mandate.poolPaused || mandate.portfolioPaused) reasons.push("mandate, pool or portfolio is paused");
    if (!Number.isSafeInteger(mandate.expiresAt) || mandate.expiresAt <= nowSeconds) reasons.push("mandate expired");
    const amount = parseBaseUnits(request.amountIn);
    const minimum = parseBaseUnits(request.minimumAmountOut);
    if (amount === null || minimum === null) reasons.push("amount is not a positive base-unit integer");
    else {
      if (amount > mandate.maxPerTrade || amount > mandate.maxDaily - mandate.spent) reasons.push("amount exceeds mandate limits");
      if (amount > mandate.portfolioRemaining) reasons.push("amount exceeds the aggregate portfolio limit");
      const quoted = amount * mandate.rateNumerator / mandate.rateDenominator;
      if (quoted <= 0n || minimum > quoted) reasons.push("minimum output is inconsistent with the fixed lab rate");
      if (request.rateNumerator !== mandate.rateNumerator.toString() || request.rateDenominator !== mandate.rateDenominator.toString()) {
        reasons.push("quoted rate does not match the mandate pool");
      }
    }
  }
  const nonce = parseBaseUnits(request?.nonce ?? "");
  if (nonce === null) reasons.push("nonce is invalid");
  else if (nonceAlreadyUsed) reasons.push("nonce already used by this service instance");
  if (request?.authorizationTtlSeconds !== undefined) {
    if (!Number.isSafeInteger(request.authorizationTtlSeconds) || request.authorizationTtlSeconds < 1
        || request.authorizationTtlSeconds > MAX_AUTHORIZATION_TTL_SECONDS) {
      reasons.push("authorization lifetime exceeds the lab maximum");
    }
  }
  if (request?.research !== undefined && !evidence?.ok) reasons.push("research output is not settlement evidence");
  return {
    status: reasons.length === 0 ? "AUTHORIZED" : "BLOCKED",
    reasons: [...new Set(reasons)],
  };
}
