import type { Metadata } from "next";
import { JudgeAnalysis } from "@/components/judge-analysis";

export const metadata: Metadata = {
  title: "Interview analysis · ValueCurator",
  description: "Public indicators from completed research interviews. The panel does not authorize a transaction.",
};

export default function InterviewAnalysisPage() {
  return <JudgeAnalysis />;
}
