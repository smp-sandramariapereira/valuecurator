import type { Metadata } from "next";
import { Dashboard } from "@/components/dashboard";

export const metadata: Metadata = {
  title: "App · ValueCurator",
  description: "Devnet demonstration of the ValueCurator mandate, market gate and owner controls.",
};

export default function ApplicationPage() {
  return <Dashboard />;
}
