import type { Metadata } from "next";
import { AssetCatalogViewer } from "@/components/asset-catalog-viewer";
import { assetCatalog } from "@/lib/asset-registry";

export const metadata: Metadata = {
  title: "Research Asset Catalog | ValueCurator",
  description: "Multi-asset research-only registry. No trades, real shares or Devnet settlement are enabled.",
};

export default function AssetsPage() {
  return <AssetCatalogViewer assets={assetCatalog} />;
}
