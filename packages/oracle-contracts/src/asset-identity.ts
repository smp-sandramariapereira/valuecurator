import { z } from "zod";

export const assetIdentitySchema = z
  .object({
    symbol: z.string().trim().min(1),
    mint: z.string().trim().min(32).max(44),
    network: z.literal("mainnet-beta"),
  })
  .strict();

export type AssetIdentity = z.infer<typeof assetIdentitySchema>;

export function parseAssetIdentity(value: unknown): AssetIdentity {
  return assetIdentitySchema.parse(value);
}

export function sameAsset(left: AssetIdentity, right: AssetIdentity): boolean {
  return left.symbol === right.symbol && left.mint === right.mint && left.network === right.network;
}
