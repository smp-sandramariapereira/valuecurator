import type { Metadata } from "next";
import { ProofGateAuthorizations } from "@/components/journey/record-pages";

export const metadata: Metadata = { title: "Autorizações | ValueCurator" };

export default function ProofGateAuthorizationsPage() {
  return <ProofGateAuthorizations />;
}
