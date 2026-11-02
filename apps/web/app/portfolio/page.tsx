import type { Metadata } from "next";
import { PortfolioOverview } from "@/components/journey/portfolio-workspace";
import { assetCatalog } from "@/lib/asset-registry";

export const metadata: Metadata = { title: "Portfólio | ValueCurator" };

export default function PortfolioPage() {
  return <PortfolioOverview assets={assetCatalog} />;
}
