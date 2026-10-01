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

export function explorerAddressUrl(address: string, cluster: "devnet" | "mainnet-beta"): string {
  return `https://explorer.solana.com/address/${address}?cluster=${cluster}`;
}

export const DEVNET_NODE_ADDRESS = "LwuCrFTwdkkH24Ni3Kc4UuL56pzvvnyag1gNQzjCALS";
export const MAINNET_AAPLX_MINT = "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp";
export const MAINNET_PYTH_AAPLX_FEED = "922";

/** Published Devnet custody transactions. They are not an AAPLx trade. */
export const DEVNET_CUSTODY_TXS = [
  {
    id: "initialize",
    label: "Initialize node",
    instruction: "initialize_node",
    signature:
      "5KfFCT55w2sen5mgHm99V2V9aRJ6EM7UX9HsZQ7CTKq6ycyDNmvmPhqn8PzcAnADSEDT36fhJ4FXgyJDthtrMhX5",
  },
  {
    id: "metabolize",
    label: "15/85 split",
    instruction: "metabolize_yield",
    signature:
      "5iYZdNguAxH5u1niikvtBW7oPLj9qodor5coKmDyZWoJaXKsqfwroaJdyy7r23zRTFQYinXH7wACMUdgYXQ9chJq",
  },
  {
    id: "recover",
    label: "Owner recovery",
    instruction: "emergency_withdraw",
    signature:
      "FVUB863oWXv2i9ymxsro6yEjbmP2XVirBBLZEAYm8xU2qRuuSoJkpfBjUWUu5q18D4GhEKmAtTSCWbNJQ4FjrtE",
  },
] as const;

/** Devnet metabolize_yield signed by an operator who is not registered on the node. */
export const DEVNET_REJECTION_TX = {
  id: "reject-operator",
  label: "Rejected operator",
  instruction: "metabolize_yield",
  error: "UnauthorizedOperator",
  signature:
    "2sFHnWWSCMqNykUGmsmuyZaiM3Rjt82dFtZxHQx4d81gzmhxATLmp48DQvKfSuPTBngHPi3PaAWSgFYrBwAcA1dn",
} as const;

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
