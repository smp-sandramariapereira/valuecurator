import { PublicKey } from "@solana/web3.js";

export const NODE_SEED = Buffer.from("node");
export const REFERENCE_PRICE_SEED = Buffer.from("reference-price");

export function findNodePda(
  programId: PublicKey,
  owner: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([NODE_SEED, owner.toBuffer()], programId);
}

export function findReferencePricePda(
  programId: PublicKey,
  node: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [REFERENCE_PRICE_SEED, node.toBuffer()],
    programId,
  );
}
