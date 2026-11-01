/**
 * Stage 1: research-only asset registry. This module never authorizes trades.
 * A ticker is NOT an identity, a verified mint or an executable mandate.
 */
import { PublicKey } from "@solana/web3.js";
import catalog from "@/data/asset-catalog.json";

export type AssetClass = "EQUITY" | "ETF" | "OTHER_RWA";
export type AssetStatus = "CANDIDATE" | "REFERENCE_DOCUMENTED" | "VERIFIED";
export type AssetNetwork = "mainnet-beta" | "devnet";

export type CatalogAsset = Readonly<{
  assetId: string;
  ticker: string;
  displayName: string;
  assetClass: AssetClass;
  status: AssetStatus;
  referenceSymbol: string | null;
  network: AssetNetwork | null;
  mint: string | null;
  source: string;
  devnetMint: string | null;
}>;

const ID = /^(equity|etf|rwa):[A-Z0-9._:-]{2,80}$/;
const SYMBOL = /^[A-Z0-9.]{1,20}$/;
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid catalog entry");
  }
  return value as Record<string, unknown>;
}
function text(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Invalid ${label}`);
  return value.trim();
}
function nullableText(value: unknown, label: string): string | null {
  return value === null ? null : text(value, label);
}
function validMint(value: string): string {
  const key = new PublicKey(value);
  // Check canonical base58 string; disallow ambiguous/noncanonical addresses.
  if (key.toBase58() !== value) throw new Error("Noncanonical token mint");
  return value;
}
export function parseAsset(value: unknown): CatalogAsset {
  const v = object(value);
  const expected = ["assetId","ticker","displayName","assetClass","status","referenceSymbol","network","mint","source","devnetMint"];
  if (Object.keys(v).sort().join("|") !== expected.sort().join("|")) {
    throw new Error("Unexpected or missing catalog fields");
  }
  const assetId = text(v.assetId, "assetId");
  const ticker = text(v.ticker, "ticker");
  if (!ID.test(assetId) || !SYMBOL.test(ticker)) throw new Error("Invalid asset identity");
  const assetClass = v.assetClass;
  if (assetClass !== "EQUITY" && assetClass !== "ETF" && assetClass !== "OTHER_RWA") throw new Error("Invalid asset class");
  const status = v.status;
  if (status !== "CANDIDATE" && status !== "REFERENCE_DOCUMENTED" && status !== "VERIFIED") throw new Error("Invalid asset status");
  const network = v.network;
  if (network !== null && network !== "mainnet-beta" && network !== "devnet") throw new Error("Invalid network");
  const mint = nullableText(v.mint, "mint");
  const devnetMint = nullableText(v.devnetMint, "devnetMint");
  const referenceSymbol = nullableText(v.referenceSymbol, "referenceSymbol");
  if (referenceSymbol && !/^[A-Za-z0-9.-]{1,32}$/.test(referenceSymbol)) throw new Error("Invalid reference symbol");
  if ((network === null) !== (mint === null)) throw new Error("Mint/network must be paired");
  if (mint) validMint(mint);
  if (devnetMint) validMint(devnetMint);
  if (status === "CANDIDATE" && (mint !== null || devnetMint !== null || network !== null)) {
    throw new Error("Candidate cannot declare a mint");
  }
  if (status !== "CANDIDATE" && mint === null && devnetMint === null) {
    throw new Error("Documented or verified asset requires evidence of a mint");
  }
  if (status !== "CANDIDATE" && !referenceSymbol) {
    throw new Error("Mint mapping requires reference symbol");
  }
  return Object.freeze({
    assetId, ticker, displayName: text(v.displayName,"displayName"),
    assetClass, status, referenceSymbol, network, mint,
    source: text(v.source,"source"), devnetMint,
  });
}
export function parseCatalog(value: unknown): readonly CatalogAsset[] {
  const root = object(value);
  if (root.schemaVersion !== 1 || !Array.isArray(root.assets)) throw new Error("Unknown asset catalog schema");
  const ids = new Set<string>();
  const assets = root.assets.map(parseAsset);
  for (const asset of assets) {
    if (ids.has(asset.assetId)) throw new Error(`Duplicate asset ID: ${asset.assetId}`);
    ids.add(asset.assetId);
  }
  return Object.freeze(assets);
}

/** Selection for research, NOT trade approval. */
export function selectResearchAssets(assets: readonly CatalogAsset[], ids: readonly string[]): readonly CatalogAsset[] {
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate asset selection");
  return ids.map((id) => {
    const asset = assets.find((candidate) => candidate.assetId === id);
    if (!asset) throw new Error(`Unknown asset: ${id}`);
    return asset;
  });
}

/**
 * Defensive gate for the FUTURE Devnet settlement integration.
 * No assets in the initial catalog pass this gate.
 */
export function eligibleForDevnetSettlement(asset: CatalogAsset, allowedMintIds: ReadonlySet<string>): boolean {
  return asset.status === "VERIFIED"
    && asset.devnetMint !== null
    && allowedMintIds.has(asset.devnetMint);
}

export const assetCatalog = parseCatalog(catalog);
