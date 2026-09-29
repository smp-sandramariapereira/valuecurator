"use client";

import type { MetabolicEventRow } from "@/lib/kairos";
import { OnChainFeed } from "@/components/on-chain-feed";

/** Visual feed lives in OnChainFeed; this keeps the previous import path. */
export function EventLog(props: {
  events: MetabolicEventRow[];
  activeSignature: string | null;
  onSelect: (signature: string) => void;
}) {
  return <OnChainFeed {...props} connected />;
}
