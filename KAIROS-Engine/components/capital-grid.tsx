"use client";

import { Landmark, ShieldCheck } from "lucide-react";
import { formatTokenAmount, type NodeAccount } from "@/lib/kairos";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function CapitalGrid({
  node,
  treasuryBalance,
  vaultBalance,
  decimals,
}: {
  node: NodeAccount;
  treasuryBalance: bigint | null;
  vaultBalance: bigint | null;
  decimals: number | null;
}) {
  const vaultPct = (10_000 - node.infrastructureFeeBps) / 100;
  const treasuryPct = node.infrastructureFeeBps / 100;
  const destinations = [
    {
      id: "vault",
      name: "Recoverable vault",
      description: "PDA-controlled custody; the owner retains emergency withdrawal authority.",
      rule: `${vaultPct}% of each metabolize_yield`,
      balance: vaultBalance,
      icon: ShieldCheck,
      tone: "text-stocklana-accent",
    },
    {
      id: "treasury",
      name: "Infrastructure treasury",
      description: "Receives the protocol fee in the processed token; it is not automatically converted to SOL.",
      rule: `${treasuryPct}% of each metabolize_yield`,
      balance: treasuryBalance,
      icon: Landmark,
      tone: "text-stocklana-purple",
    },
  ] as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vault custody and distribution</CardTitle>
        <CardDescription>
          Shows only destinations implemented on-chain. The 85/15 rule is applied to every inflow; the balances below represent current holdings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-2">
          {destinations.map((destination) => {
            const Icon = destination.icon;
            return (
              <section key={destination.id} className="rounded-md border border-stocklana-border bg-stocklana-bg/30 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${destination.tone}`} />
                    <h3 className="text-sm font-semibold text-white">{destination.name}</h3>
                  </div>
                  <Badge className="border-stocklana-accent/40 text-stocklana-accent">ON-CHAIN</Badge>
                </div>
                <p className="mt-3 text-xs leading-5 text-stocklana-muted">{destination.description}</p>
                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-stocklana-border pt-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-stocklana-muted">Rule</p>
                    <p className="mt-1 font-mono text-xs text-white">{destination.rule}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wider text-stocklana-muted">Current balance</p>
                    <p className={`mt-1 font-mono text-sm tabular-nums ${destination.tone}`}>
                      {destination.balance === null
                        ? "Unavailable"
                        : formatTokenAmount(destination.balance, decimals)}
                    </p>
                  </div>
                </div>
              </section>
            );
          })}
        </div>

        <div>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-stocklana-bg" aria-label={`Distribution: ${vaultPct}% vault e ${treasuryPct}% treasury`}>
            <div className="bg-stocklana-accent" style={{ width: `${vaultPct}%` }} />
            <div className="bg-stocklana-purple" style={{ width: `${treasuryPct}%` }} />
          </div>
          <div className="mt-2 flex flex-wrap justify-between gap-2 font-mono text-[11px]">
            <span className="text-stocklana-accent">{vaultPct}% recoverable vault</span>
            <span className="text-stocklana-purple">{treasuryPct}% treasury</span>
          </div>
          <p className="mt-2 text-xs text-stocklana-muted">
            The bar represents the distribution policy, not the ratio between current balances.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
