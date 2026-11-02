import type { Metadata } from "next";
import { ResearchScenarios } from "@/components/journey/record-pages";

export const metadata: Metadata = { title: "Cenários | ValueCurator" };

export default function ResearchScenariosPage() {
  return <ResearchScenarios />;
}
