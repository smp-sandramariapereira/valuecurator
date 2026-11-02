import type { Metadata } from "next";
import { MandateAccess } from "@/components/journey/mandate-access";

export const metadata: Metadata = { title: "Mandatos | ValueCurator" };

export default function MandatesPage() {
  return <MandateAccess />;
}
