import type { Metadata } from "next";
import { Dashboard } from "@/components/dashboard";

export const metadata: Metadata = {
  title: "ValueCurator | AI-Powered Financial Infrastructure",
  description:
    "ValueCurator is a research-driven Deep Tech initiative building intelligent financial infrastructure for tokenized assets, combining AI, quantitative research, verifiable authorization and Solana.",
};

export default function HomePage() {
  return <Dashboard />;
}
