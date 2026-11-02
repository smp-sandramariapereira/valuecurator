import { PublicKey } from "@solana/web3.js";

export function parseProofGateConfig(data) {
  const bytes = Buffer.from(data);
  if (bytes.length < 122) throw new Error("ProofGate config account is too small");
  return {
    adminAuthority: new PublicKey(bytes.subarray(8, 40)),
    policySigner: new PublicKey(bytes.subarray(40, 72)),
    policyVersion: bytes.readBigUInt64LE(72),
    authorizationEpoch: bytes.readBigUInt64LE(80),
    deploymentId: Buffer.from(bytes.subarray(88, 120)),
    paused: bytes[120] !== 0,
  };
}

export function sameTrustedConfig(left, right) {
  const sameKey = (leftKey, rightKey) => leftKey?.toBase58() === rightKey?.toBase58();
  return left.paused === right.paused
    && left.policyVersion === right.policyVersion
    && left.authorizationEpoch === right.authorizationEpoch
    && sameKey(left.policySigner, right.policySigner)
    && Buffer.from(left.deploymentId).equals(Buffer.from(right.deploymentId))
    && sameKey(left.programId, right.programId)
    && sameKey(left.config, right.config);
}
