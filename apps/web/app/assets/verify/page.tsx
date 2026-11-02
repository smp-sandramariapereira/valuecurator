import type { Metadata } from "next";
import { AssetVerification } from "@/components/journey/asset-workspace";
import { assetCatalog } from "@/lib/asset-registry";

export const metadata: Metadata = { title: "Verificação de Ativos | ValueCurator" };

export default function AssetVerifyPage() {
  return <AssetVerification assets={assetCatalog} />;
}
