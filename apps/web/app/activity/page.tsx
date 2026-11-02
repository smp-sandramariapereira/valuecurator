import type { Metadata } from "next";
import { ActivityHome } from "@/components/journey/record-pages";

export const metadata: Metadata = { title: "Atividade | ValueCurator" };

export default function ActivityPage() {
  return <ActivityHome />;
}
