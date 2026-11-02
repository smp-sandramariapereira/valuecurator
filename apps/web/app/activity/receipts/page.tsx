import type { Metadata } from "next";
import { ActivityEmpty } from "@/components/journey/record-pages";

export const metadata: Metadata = { title: "Recibos | ValueCurator" };

export default function ActivityReceiptsPage() {
  return <ActivityEmpty title="Recibos" body="O recibo continua sendo confirmado pelo laboratório depois que a rede local aceita a transação." href="/lab" hrefLabel="Abrir o laboratório" />;
}
