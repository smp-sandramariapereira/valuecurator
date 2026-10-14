import type { Metadata } from "next";
import { DiscoveryInterview } from "@/components/discovery-interview";

export const metadata: Metadata = {
  title: "Research Interview · ValueCurator",
  description: "A signed research session for businesses and agent operators. The signature does not move tokens.",
};

export default function InterviewPage() {
  return <DiscoveryInterview />;
}
