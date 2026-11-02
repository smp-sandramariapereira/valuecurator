import type { Metadata } from "next";
import { AssetCompare } from "@/components/journey/asset-workspace";
import { assetCatalog } from "@/lib/asset-registry";

export const metadata: Metadata = { title: "Comparar Ativos | ValueCurator" };

export default function AssetComparePage() {
  return <AssetCompare assets={assetCatalog} />;
}
