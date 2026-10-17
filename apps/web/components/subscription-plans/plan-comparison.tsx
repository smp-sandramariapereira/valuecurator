"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const plans = [
  {
    id: "basic",
    detail: "Hermes only. No fallback. The 1 USDC Devnet screen is a separate illustration and is not this plan.",
  },
  {
    id: "operator",
    detail: "Pyth Pro and Hermes, with fallback only when the server plan allows it. A client cannot switch itself onto this plan.",
  },
];

export function PlanComparison() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Evidence plans</CardTitle>
        <CardDescription>These plans limit which oracle evidence the server will admit. They do not price the asset and they do not move the node.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {plans.map((plan) => (
          <article key={plan.id} className="rounded-xl border border-white/10 p-4">
            <h3 className="font-medium text-white">{plan.id}</h3>
            <p className="mt-2 text-sm text-stocklana-muted">{plan.detail}</p>
          </article>
        ))}
      </CardContent>
    </Card>
  );
}
