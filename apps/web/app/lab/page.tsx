import type { Metadata } from "next";
import { ProofGateLab } from "@/components/proofgate-lab";

export const metadata: Metadata = {
  title: "ProofGate Lab · ValueCurator",
  description: "Local synthetic settlement lab. Research assets are not executable shares.",
};

export default function LabPage() {
  return <ProofGateLab />;
}
