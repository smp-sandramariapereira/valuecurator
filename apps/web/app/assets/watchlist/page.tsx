import type { Metadata } from "next";
import { AssetWatchlist } from "@/components/journey/asset-workspace";
import { assetCatalog } from "@/lib/asset-registry";

export const metadata: Metadata = { title: "Lista de Observação | ValueCurator" };

export default function WatchlistPage() {
  return <AssetWatchlist assets={assetCatalog} />;
}
