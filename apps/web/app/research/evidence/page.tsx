import type { Metadata } from "next";
import { ResearchEvidence } from "@/components/journey/record-pages";

export const metadata: Metadata = { title: "Evidências de Mercado | ValueCurator" };

export default function ResearchEvidencePage() {
  return <ResearchEvidence />;
}
