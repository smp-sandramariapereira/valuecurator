import type { Metadata } from "next";
import { ProofGateHome } from "@/components/journey/record-pages";

export const metadata: Metadata = { title: "ProofGate | ValueCurator" };

export default function ProofGatePage() {
  return <ProofGateHome />;
}
