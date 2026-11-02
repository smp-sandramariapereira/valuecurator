import type { Metadata } from "next";
import { PortfolioRebalance } from "@/components/journey/portfolio-workspace";
import { assetCatalog } from "@/lib/asset-registry";

export const metadata: Metadata = { title: "Ajustar Portfólio | ValueCurator" };

export default function PortfolioRebalancePage() {
  return <PortfolioRebalance assets={assetCatalog} />;
}
