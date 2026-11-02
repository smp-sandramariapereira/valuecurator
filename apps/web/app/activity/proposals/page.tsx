import type { Metadata } from "next";
import { ActivityEmpty } from "@/components/journey/record-pages";

export const metadata: Metadata = { title: "Propostas | ValueCurator" };

export default function ActivityProposalsPage() {
  return <ActivityEmpty title="Propostas" body="Não há propostas persistidas fora do dashboard e do laboratório." href="/proofgate" hrefLabel="Abrir a central de propostas" />;
}
