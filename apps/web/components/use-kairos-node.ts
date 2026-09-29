"use client";

import { BorshCoder, EventParser, type Idl } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  getMint,
} from "@solana/spl-token";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useCallback, useEffect, useMemo, useState } from "react";
import idlJson from "@/idl/kairos_engine.json";
import {
  configuredMint,
  decodeNodeAccount,
  findNodePda,
  programId,
  type MetabolicEventRow,
  type NodeAccount,
} from "@/lib/kairos";

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "empty"; reason: string }
  | { status: "error"; message: string }
  | {
      status: "ready";
      node: NodeAccount;
      nodePda: PublicKey;
      treasuryBalance: bigint | null;
      treasuryAta: PublicKey | null;
      vaultBalance: bigint | null;
      decimals: number | null;
    };

export function useKairosNode() {
  const { connection } = useConnection();
  const { publicKey: walletPublicKey } = useWallet();
  const configuredOwner = useMemo(() => {
    const raw = process.env.NEXT_PUBLIC_NODE_OWNER?.trim();
    if (!raw) return { key: null, error: null };
    try {
      return { key: new PublicKey(raw), error: null };
    } catch {
      return { key: null, error: "Invalid NEXT_PUBLIC_NODE_OWNER" };
    }
  }, []);
  const publicKey = configuredOwner.key ?? walletPublicKey;
  const connected = publicKey !== null && configuredOwner.error === null;
  const readOnly = configuredOwner.key !== null;
  const [state, setState] = useState<LoadState>({ status: "idle" });
  const [historyMessage, setHistoryMessage] = useState("");
  const [events, setEvents] = useState<MetabolicEventRow[]>([]);
  const mint = useMemo(() => configuredMint(), []);
  const program = useMemo(() => programId(), []);

  const refresh = useCallback(async () => {
    if (configuredOwner.error) {
      setState({ status: "error", message: configuredOwner.error });
      return;
    }
    if (!connected || !publicKey) {
      setState({ status: "idle" });
      return;
    }
    setState({ status: "loading" });
    try {
      const nodePda = findNodePda(publicKey, program);
      const info = await connection.getAccountInfo(nodePda, "confirmed");
      if (!info) {
        setState({
          status: "empty",
          reason: `Node not found at ${nodePda.toBase58()}. Deploy and run initialize_node with this wallet.`,
        });
        return;
      }
      if (!info.owner.equals(program)) throw new Error("Node account belongs to another program");
      const node = decodeNodeAccount(info.data);
      let treasuryBalance: bigint | null = null;
      let treasuryAta: PublicKey | null = null;
      let vaultBalance: bigint | null = null;
      let decimals: number | null = null;
      if (mint) {
        decimals = (await getMint(connection, mint, "confirmed", TOKEN_2022_PROGRAM_ID)).decimals;
        const vaultAta = getAssociatedTokenAddressSync(mint, nodePda, true, TOKEN_2022_PROGRAM_ID);
        try {
          const balance = await connection.getTokenAccountBalance(vaultAta, "confirmed");
          vaultBalance = BigInt(balance.value.amount);
        } catch {
          // Missing account or RPC failure is unknown, never an invented zero.
        }
        treasuryAta = getAssociatedTokenAddressSync(
          mint,
          node.treasuryPubkey,
          false,
          TOKEN_2022_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        );
        try {
          const bal = await connection.getTokenAccountBalance(treasuryAta, "confirmed");
          treasuryBalance = BigInt(bal.value.amount);
        } catch {
          treasuryBalance = null;
        }
      }
      setState({
        status: "ready",
        node,
        nodePda,
        treasuryBalance,
        treasuryAta,
        vaultBalance,
        decimals,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setState({ status: "error", message });
    }
  }, [connected, connection, mint, program, publicKey, configuredOwner.error]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, 8_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (!connected || !publicKey) {
      setEvents([]);
      return;
    }
    const myNode = findNodePda(publicKey, program);
    setEvents([]);
    const parser = new EventParser(program, new BorshCoder(idlJson as Idl));
    let cancelled = false;
    function ingest(logs: string[], signature: string, slot?: number) {
      if (cancelled) return;
      try {
        for (const event of parser.parseLogs(logs)) {
          if (event.name.toLowerCase() !== "metabolicevent") continue;
          const data = event.data as {
            node: PublicKey;
            vaulted: { toString(): string };
            infrastructureFunded?: { toString(): string };
            infrastructure_funded?: { toString(): string };
            timestamp: { toString(): string };
          };
          if (!data.node.equals(myNode)) continue;
          const infrastructure = data.infrastructure_funded ?? data.infrastructureFunded;
          if (!infrastructure) throw new Error("Event is missing infrastructure_funded");
          const row: MetabolicEventRow = {
            signature, slot, node: data.node.toBase58(),
            vaulted: BigInt(data.vaulted.toString()),
            infrastructureFunded: BigInt(infrastructure.toString()),
            timestamp: Number(data.timestamp.toString()),
          };
          setEvents(prev => prev.some(item => item.signature === signature) ? prev :
            [row, ...prev].sort((a, b) => (b.slot ?? 0) - (a.slot ?? 0)).slice(0, 40));
        }
      } catch {
        // Ignore malformed logs, not failed transactions.
      }
    }
    const sub = connection.onLogs(program, (log, context) => {
      if (!log.err) ingest(log.logs, log.signature, context.slot);
    }, "confirmed");
    async function loadHistory() {
      try {
        const signatures = await connection.getSignaturesForAddress(myNode, { limit: 40 }, "confirmed");
        // Sequential requests bound RPC pressure on the public endpoint.
        for (const entry of signatures) {
          if (cancelled) return;
          if (entry.err) continue;
          const tx = await connection.getTransaction(entry.signature, {
            commitment: "confirmed", maxSupportedTransactionVersion: 0,
          });
          if (tx?.meta && !tx.meta.err && tx.meta.logMessages) {
            ingest(tx.meta.logMessages, entry.signature, tx.slot);
          }
        }
      } catch {
        if (!cancelled) setHistoryMessage("History unavailable from RPC; live events remain active.");
      }
    }
    setHistoryMessage("Querying the node's latest 40 transactions…");
    void loadHistory().finally(() => {
      if (!cancelled) setHistoryMessage(prev => prev.startsWith("Querying") ?
        "History is limited to the latest 40 transactions available from the RPC." : prev);
    });
    return () => {
      cancelled = true;
      void connection.removeOnLogsListener(sub);
    };
  }, [connected, connection, program, publicKey, configuredOwner.error]);

  return { state, events, mint, refresh, connected, publicKey, readOnly, historyMessage };
}
