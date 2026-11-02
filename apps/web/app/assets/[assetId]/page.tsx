import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AssetDossier } from "@/components/journey/asset-workspace";
import { assetCatalog } from "@/lib/asset-registry";

type AssetPageProps = { params: { assetId: string } };

export function generateStaticParams() {
  return assetCatalog.map((asset) => ({ assetId: asset.assetId }));
}

export function generateMetadata({ params }: AssetPageProps): Metadata {
  const asset = assetCatalog.find((item) => item.assetId === decodeURIComponent(params.assetId));
  return { title: asset ? `${asset.ticker} | ValueCurator` : "Ativo | ValueCurator" };
}

export default function AssetDossierPage({ params }: AssetPageProps) {
  const asset = assetCatalog.find((item) => item.assetId === decodeURIComponent(params.assetId));
  if (!asset) notFound();
  return <AssetDossier asset={asset} />;
}
