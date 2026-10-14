import type { Metadata } from "next";
import { SubscriptionCard } from "@/components/subscription-card";

export const metadata: Metadata = {
  title: "Subscription · ValueCurator",
  description: "Read the Devnet USDC balance and take 1 USDC only after a second confirmation. The transfer does not buy the asset.",
};

export default function SubscribePage() {
  return <SubscriptionCard />;
}
