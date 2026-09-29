import { PublicKey } from "@solana/web3.js";

export const NODE_SEED = Buffer.from("node");

export function findNodePda(
  programId: PublicKey,
  owner: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([NODE_SEED, owner.toBuffer()], programId);
}
