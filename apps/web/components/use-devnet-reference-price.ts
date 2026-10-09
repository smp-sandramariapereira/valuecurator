"use client";

import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useEffect, useMemo, useState } from "react";
import {
  DEVNET_NODE_ADDRESS,
  decodeReferencePrice,
  findReferencePricePda,
  programId,
  type ReferencePriceAccount,
} from "@/lib/kairos";

export type DevnetReferencePriceState =
  | { status: "loading"; address: PublicKey }
  | { status: "empty"; address: PublicKey }
  | { status: "error"; address: PublicKey; message: string }
  | { status: "ready"; address: PublicKey; price: ReferencePriceAccount };

export function useDevnetReferencePrice(): DevnetReferencePriceState {
  const { connection } = useConnection();
  const program = useMemo(() => programId(), []);
  const node = useMemo(() => new PublicKey(DEVNET_NODE_ADDRESS), []);
  const address = useMemo(() => findReferencePricePda(node, program), [node, program]);
  const [state, setState] = useState<DevnetReferencePriceState>({ status: "loading", address });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading", address });
    void connection
      .getAccountInfo(address, "confirmed")
      .then((info) => {
        if (cancelled) return;
        if (!info) {
          setState({ status: "empty", address });
          return;
        }
        if (!info.owner.equals(program)) {
          setState({ status: "error", address, message: "Account belongs to another program" });
          return;
        }
        const price = decodeReferencePrice(info.data);
        if (!price.node.equals(node)) {
          setState({ status: "error", address, message: "Account node does not match this node" });
          return;
        }
        setState({ status: "ready", address, price });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setState({ status: "error", address, message });
      });
    return () => {
      cancelled = true;
    };
  }, [address, connection, node, program]);

  return state;
}
