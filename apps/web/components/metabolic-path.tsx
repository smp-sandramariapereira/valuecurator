"use client";

import { useEffect, useState } from "react";
import { formatTokenAmount, type MetabolicEventRow } from "@/lib/kairos";
import { explorerTxUrl } from "@/lib/kairos";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function MetabolicPath({
  event,
  playId,
  onReplay,
}: {
  event: MetabolicEventRow | null;
  playId: number;
  onReplay: () => void;
}) {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduceMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const playing = Boolean(event) && !reduceMotion && playId > 0;

  return (
    <Card>
      <CardHeader className="sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>This node’s path</CardTitle>
          <CardDescription>
            Replay of the latest <code className="text-zinc-300">MetabolicEvent</code> confirmed
            from this wallet. Without an event, nothing moves.
          </CardDescription>
        </div>
        {event ? (
          <Button type="button" variant="outline" className="mt-3 sm:mt-0" onClick={onReplay}>
            Replay path
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <svg
            key={playing ? `play-${playId}` : event ? `still-${event.signature}` : "idle"}
            viewBox="0 0 760 220"
            className="h-auto w-full min-w-[36rem] text-zinc-100"
            role="img"
            aria-label={
              event
                ? `Split confirmed: ${formatTokenAmount(event.vaulted, null)} to the vault, ${formatTokenAmount(event.infrastructureFunded, null)} to the treasury`
                : "Waiting for a MetabolicEvent from this node"
            }
          >
            <rect x="16" y="84" width="132" height="52" rx="6" className="fill-[#111D2B] stroke-[#2B3A4B]" />
            <text x="82" y="108" textAnchor="middle" className="fill-[#A8B3C2]" fontSize="11" fontFamily="ui-monospace, monospace">
              ATA operator
            </text>
            <text x="82" y="124" textAnchor="middle" className="fill-[#A8B3C2]" fontSize="10" fontFamily="ui-monospace, monospace">
              inflow
            </text>

            <rect x="220" y="80" width="168" height="60" rx="6" className="fill-[#111D2B] stroke-[#E0B96A]" />
            <text x="304" y="106" textAnchor="middle" className="fill-[#E0B96A]" fontSize="12" fontFamily="ui-monospace, monospace">
              metabolize_yield
            </text>
            <text x="304" y="124" textAnchor="middle" className="fill-[#A8B3C2]" fontSize="10" fontFamily="ui-monospace, monospace">
              Anchor
            </text>

            <rect x="548" y="24" width="196" height="56" rx="6" className="fill-[#111D2B] stroke-[#7DA2F8]" />
            <text x="646" y="48" textAnchor="middle" className="fill-[#7DA2F8]" fontSize="12" fontFamily="ui-monospace, monospace">
              Vault · event
            </text>
            <text x="646" y="66" textAnchor="middle" className="fill-[#7DA2F8]" fontSize="11" fontFamily="ui-monospace, monospace">
              {event ? "confirmed" : "—"}
            </text>

            <rect x="548" y="140" width="196" height="56" rx="6" className="fill-[#111D2B] stroke-[#E0B96A]" />
            <text x="646" y="164" textAnchor="middle" className="fill-[#F0D6A2]" fontSize="12" fontFamily="ui-monospace, monospace">
              Treasury · event
            </text>
            <text x="646" y="182" textAnchor="middle" className="fill-[#E0B96A]" fontSize="11" fontFamily="ui-monospace, monospace">
              {event ? "confirmed" : "—"}
            </text>

            <path d="M148 110 H220" className="fill-none stroke-[#2B3A4B]" strokeWidth="2" />
            <path
              d="M388 110 C460 110 480 52 548 52"
              className="fill-none stroke-[#7DA2F8]"
              strokeWidth="2"
            />
            <path
              d="M388 110 C460 110 480 168 548 168"
              className="fill-none stroke-[#E0B96A]"
              strokeWidth="2"
            />

            {playing ? (
              <>
                <circle r="6" fill="#7DA2F8">
                  <animateMotion dur="0.9s" fill="freeze" path="M148,110 H388" />
                </circle>
                <circle r="6" fill="#7DA2F8" opacity="0">
                  <animate
                    attributeName="opacity"
                    begin="0.85s"
                    to="1"
                    dur="0.01s"
                    fill="freeze"
                  />
                  <animateMotion
                    dur="0.9s"
                    begin="0.85s"
                    fill="freeze"
                    path="M388,110 C460,110 480,52 548,52"
                  />
                </circle>
                <circle r="6" fill="#E0B96A" opacity="0">
                  <animate
                    attributeName="opacity"
                    begin="0.85s"
                    to="1"
                    dur="0.01s"
                    fill="freeze"
                  />
                  <animateMotion
                    dur="0.9s"
                    begin="0.85s"
                    fill="freeze"
                    path="M388,110 C460,110 480,168 548,168"
                  />
                </circle>
              </>
            ) : event ? (
              <>
                <circle cx="388" cy="110" r="6" fill="#7DA2F8" />
                <circle cx="548" cy="52" r="6" fill="#7DA2F8" />
                <circle cx="548" cy="168" r="6" fill="#E0B96A" />
              </>
            ) : (
              <text x="380" y="204" textAnchor="middle" className="fill-[#A8B3C2]" fontSize="12" fontFamily="ui-monospace, monospace">
                No event from this node — the path remains idle
              </text>
            )}
          </svg>
        </div>
        {event ? (
          <p className="mt-3 truncate font-mono text-xs text-stocklana-muted">
            Tx{" "}
            <a
              className="font-mono text-xs text-stocklana-accent underline-offset-2 hover:underline"
              href={explorerTxUrl(event.signature)}
              target="_blank"
              rel="noreferrer"
            >
              {event.signature}
            </a>
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
