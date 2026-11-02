import type { CatalogAsset } from "@/lib/asset-registry";

export type AssetPresentation = {
  assetId: string;
  ticker: string;
  displayName: string;
  category: CatalogAsset["assetClass"];
  registryStatus: CatalogAsset["status"];
  network: string;
  mint: string;
  tokenProgram: string;
  source: string;
  referenceSymbol: string;
  identityLabel: string;
  marketDataLabel: string;
  executionLabel: string;
  researchLabel: string;
};

const IDENTITY_LABEL = {
  CANDIDATE: "Identidade não confirmada",
  REFERENCE_DOCUMENTED: "Verificação disponível",
  VERIFIED: "Identidade verificada no registro",
} as const;

export function presentAsset(asset: CatalogAsset): AssetPresentation {
  return {
    assetId: asset.assetId,
    ticker: asset.ticker,
    displayName: asset.displayName,
    category: asset.assetClass,
    registryStatus: asset.status,
    network: asset.network ?? "Não disponível",
    mint: asset.mint ?? "Não disponível",
    tokenProgram: "Não disponível",
    source: asset.source,
    referenceSymbol: asset.referenceSymbol ?? "Não disponível",
    identityLabel: IDENTITY_LABEL[asset.status],
    marketDataLabel: "Fonte não consultada nesta sessão",
    executionLabel: "Não habilitada",
    researchLabel: "Disponível para pesquisa",
  };
}

export function assetPath(assetId: string): string {
  return `/assets/${encodeURIComponent(assetId)}`;
}
