export const CLASSIC_TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
export const LAB_NETWORK = "devnet-lab";

/**
 * The research catalog does not carry a verified lab mint or token program.
 * A ticker, a mainnet mint, or REFERENCE_DOCUMENTED status cannot settle.
 */
export function catalogEntryCanSettle(entry) {
  return entry?.verificationStatus === "VERIFIED"
    && entry?.network === LAB_NETWORK
    && typeof entry?.mint === "string"
    && entry?.tokenProgram === CLASSIC_TOKEN_PROGRAM
    && entry?.synthetic === true;
}

export function verifyLabAsset(registry, request) {
  const reasons = [];
  const record = registry.get(request.assetId) ?? null;
  if (!record) return { ok: false, record: null, reasons: ["asset is not in the lab registry"] };
  if (!catalogEntryCanSettle(record)) reasons.push("asset is not a verified synthetic lab mint");
  if (record.mint !== request.outputMint) reasons.push("mint does not match the lab registry");
  if (request.tokenProgram !== record.tokenProgram) reasons.push("token program does not match the lab registry");
  if (request.network && request.network !== record.network) reasons.push("network does not match the lab registry");
  if (record.network !== LAB_NETWORK) reasons.push("lab registry network is not the experimental profile");
  return { ok: reasons.length === 0, record, reasons };
}
