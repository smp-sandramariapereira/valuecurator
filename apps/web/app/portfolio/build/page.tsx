import type { Metadata } from "next";
import { PortfolioBuilder } from "@/components/journey/portfolio-workspace";
import { assetCatalog } from "@/lib/asset-registry";

export const metadata: Metadata = { title: "Construir Portfólio | ValueCurator" };

export default function PortfolioBuildPage() {
  return <PortfolioBuilder assets={assetCatalog} />;
}
