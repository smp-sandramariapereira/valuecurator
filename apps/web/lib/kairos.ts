import { PublicKey } from "@solana/web3.js";

export const DEFAULT_RPC_URL = "https://api.devnet.solana.com";
export const DEFAULT_PROGRAM_ID = "6owAcXj4FxJom96cEX9CSFjGrg6zp4U8atTjrpCUMiW5";
export const NODE_SEED = Buffer.from("node");
export const BPS_DENOMINATOR = 10_000;

export function programId(): PublicKey {
  return new PublicKey(
    process.env.NEXT_PUBLIC_PROGRAM_ID?.trim() || DEFAULT_PROGRAM_ID,
  );
}

export function rpcUrl(): string {
  return process.env.NEXT_PUBLIC_RPC_URL?.trim() || DEFAULT_RPC_URL;
}

export function explorerTxUrl(signature: string): string {
  const rpc = rpcUrl();
  const cluster = rpc.includes("mainnet") ? "mainnet-beta" : "devnet";
  return `https://explorer.solana.com/tx/${signature}?cluster=${cluster}`;
}

export function configuredMint(): PublicKey | null {
  const raw = process.env.NEXT_PUBLIC_MINT?.trim();
  if (!raw) return null;
  return new PublicKey(raw);
}

export function findNodePda(owner: PublicKey, program: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([NODE_SEED, owner.toBuffer()], program)[0];
}

export type NodeAccount = {
  owner: PublicKey;
  operator: PublicKey;
  infrastructureFeeBps: number;
  totalMetabolized: bigint;
  treasuryPubkey: PublicKey;
  strategyAuthority: PublicKey;
  bump: number;
};

export function decodeNodeAccount(data: Uint8Array): NodeAccount {
  if (data.length < 8 + 32 + 32 + 2 + 8 + 32 + 32 + 1) {
    throw new Error("Node account too small for NodeAccount");
  }
  const buf = Buffer.from(data);
  let offset = 8;
  const owner = new PublicKey(buf.subarray(offset, offset + 32));
  offset += 32;
  const operator = new PublicKey(buf.subarray(offset, offset + 32));
  offset += 32;
  const infrastructureFeeBps = buf.readUInt16LE(offset);
  offset += 2;
  const totalMetabolized = buf.readBigUInt64LE(offset);
  offset += 8;
  const treasuryPubkey = new PublicKey(buf.subarray(offset, offset + 32));
  offset += 32;
  const strategyAuthority = new PublicKey(buf.subarray(offset, offset + 32));
  offset += 32;
  const bump = buf[offset] ?? 0;
  return {
    owner,
    operator,
    infrastructureFeeBps,
    totalMetabolized,
    treasuryPubkey,
    strategyAuthority,
    bump,
  };
}

export type MetabolicEventRow = {
  signature: string;
  node: string;
  vaulted: bigint;
  infrastructureFunded: bigint;
  timestamp: number;
  slot?: number;
};

export function splitPreview(total: bigint, feeBps: number): {
  infrastructure: bigint;
  vaulted: bigint;
} {
  const infrastructure =
    (total * BigInt(feeBps)) / BigInt(BPS_DENOMINATOR);
  return { infrastructure, vaulted: total - infrastructure };
}

export const SIX_CAPITALS = [
  {
    id: "financeiro",
    name: "Financial capital",
    role: "live",
    blurb: "85% allocated to the node vault",
  },
  {
    id: "infra",
    name: "Infrastructure gas",
    role: "live",
    blurb: "15% for RPC, fees, and node operating cost",
  },
  {
    id: "humano",
    name: "Human capital",
    role: "latent",
    blurb: "No on-chain account in this MVP yet",
  },
  {
    id: "social",
    name: "Social capital",
    role: "latent",
    blurb: "No on-chain account in this MVP yet",
  },
  {
    id: "intelectual",
    name: "Intellectual capital",
    role: "latent",
    blurb: "No on-chain account in this MVP yet",
  },
  {
    id: "natural",
    name: "Natural capital",
    role: "latent",
    blurb: "No on-chain account in this MVP yet",
  },
] as const;

/** Exact token formatting: never converts u64 amounts to Number. */
export function formatTokenAmount(value: bigint, decimals: number | null): string {
  if (decimals === null) return value.toString() + " raw units";
  const sign = value < BigInt(0) ? "-" : "";
  const digits = (value < BigInt(0) ? -value : value).toString().padStart(decimals + 1, "0");
  if (decimals === 0) return sign + digits;
  const fraction = digits.slice(-decimals).replace(/0+$/, "");
  return sign + digits.slice(0, -decimals) + (fraction ? "." + fraction : "");
}
