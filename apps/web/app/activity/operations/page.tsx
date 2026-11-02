import type { Metadata } from "next";
import { ActivityEmpty } from "@/components/journey/record-pages";

export const metadata: Metadata = { title: "Operações | ValueCurator" };

export default function ActivityOperationsPage() {
  return <ActivityEmpty title="Operações" body="Nenhuma operação foi registrada nesta interface. Uma autorização não aparece aqui como execução." href="/lab" hrefLabel="Abrir o laboratório" />;
}
