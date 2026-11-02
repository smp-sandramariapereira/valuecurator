import type { Metadata } from "next";
import { ProofGatePolicies } from "@/components/journey/record-pages";

export const metadata: Metadata = { title: "Políticas | ValueCurator" };

export default function ProofGatePoliciesPage() {
  return <ProofGatePolicies />;
}
