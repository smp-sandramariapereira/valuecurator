"use client";

import { formatTokenAmount, type MetabolicEventRow } from "@/lib/kairos";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function formatTime(ts: number): string {
  if (!Number.isFinite(ts) || ts <= 0) return "—";
  return new Date(ts * 1000).toLocaleString("pt-PT");
}

export function OnChainFeed({
  historyMessage = "",
  events,
  activeSignature,
  onSelect,
  connected,
}: {
  historyMessage?: string;
  events: MetabolicEventRow[];
  activeSignature: string | null;
  onSelect: (signature: string) => void;
  connected: boolean;
}) {
  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>On-chain feed</CardTitle>
          <CardDescription>
            Devnet custody log for this wallet’s PDA. These signatures are metabolize_yield splits, not an AAPLx trade. Select a row to replay the path.
          </CardDescription>
        </div>
        <Badge
          className={
            connected
              ? "border-stocklana-accent/40 text-stocklana-accent"
              : "border-stocklana-border text-stocklana-muted"
          }
        >
          <span className={connected ? "live-dot mr-1.5" : "mr-1.5 h-2 w-2 rounded-full bg-stocklana-border"} />
          {connected ? "RPC Devnet" : "RPC idle"}
        </Badge>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-xs text-stocklana-muted">{historyMessage} Event values use raw units: the event does not identify the mint.</p>
        {events.length === 0 ? (
          <p className="rounded-md border border-dashed border-stocklana-border bg-stocklana-bg/60 px-4 py-8 text-center font-mono text-xs text-stocklana-muted">
            Waiting for logs from this node · metabolize_yield
          </p>
        ) : (
          <ol className="max-h-[28rem] space-y-1 overflow-y-auto pr-1 font-mono text-xs">
            {events.map((event) => {
              const active = event.signature === activeSignature;
              return (
                <li key={event.signature}>
                  <button
                    type="button"
                    onClick={() => onSelect(event.signature)}
                    className={
                      active
                        ? "w-full rounded-md border border-stocklana-purple/50 bg-stocklana-purple/10 p-3 text-left"
                        : "w-full rounded-md border border-transparent p-3 text-left hover:bg-slate-800/40"
                    }
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-stocklana-purple">metabolize_yield</span>
                      <span className="text-stocklana-muted">·</span>
                      <span className="text-stocklana-accent">Confirmed split</span>
                      <span className="ml-auto text-stocklana-muted">{formatTime(event.timestamp)}</span>
                    </div>
                    <p className="mt-2 truncate text-stocklana-muted">{event.signature}</p>
                    <p className="mt-2 text-stocklana-accent">
                      vault {formatTokenAmount(event.vaulted, null)}
                    </p>
                    <p className="text-stocklana-purple">
                      infra {formatTokenAmount(event.infrastructureFunded, null)}
                    </p>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
