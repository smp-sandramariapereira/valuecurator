import type { Metadata } from "next";
import { ResearchHome } from "@/components/journey/record-pages";

export const metadata: Metadata = { title: "Inteligência | ValueCurator" };

export default function ResearchPage() {
  return <ResearchHome />;
}
