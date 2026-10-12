"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection } from "@solana/web3.js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { explorerAddressUrl } from "@/lib/kairos";
import {
  SUBSCRIPTION_AMOUNT,
  SUBSCRIPTION_RECIPIENT,
  SUBSCRIPTION_RPC,
  SUBSCRIPTION_USDC_MINT,
  buildSubscriptionTransfer,
} from "@/lib/subscription";

const WalletMultiButton = dynamic(
  async () => {
    const mod = await import("@solana/wallet-adapter-react-ui");
    return mod.WalletMultiButton;
  },
  { ssr: false, loading: () => <Button variant="outline">Wallet…</Button> },
);

type Phase = "idle" | "preparing" | "ready";

function shortAddress(value: string): string {
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

export function SubscriptionCard() {
  const { connected, publicKey } = useWallet();
  const connection = useMemo(() => new Connection(SUBSCRIPTION_RPC, "confirmed"), []);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);

  const payerIsRecipient = publicKey?.equals(SUBSCRIPTION_RECIPIENT) ?? false;
  const canSimulate = connected && publicKey !== null && !payerIsRecipient && phase !== "preparing";

  async function simulate() {
    if (!publicKey) return;
    setError(null);
    setPhase("preparing");
    try {
      const transaction = await buildSubscriptionTransfer(connection, publicKey);
      const simulation = await connection.simulateTransaction(transaction);
      if (simulation.value.err) {
        const logs = simulation.value.logs?.slice(-4).join(" ") ?? "";
        setError(logs || "Devnet simulation rejected the transfer.");
        setPhase("idle");
        return;
      }
      setPhase("ready");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Devnet simulation did not finish.");
      setPhase("idle");
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="space-y-3">
        <Link href="/" className="font-mono text-xs uppercase tracking-[0.18em] text-stocklana-accent">
          ValueCurator
        </Link>
        <h1 className="text-3xl font-semibold tracking-[-0.04em]">One month of the lock</h1>
        <p className="max-w-2xl text-sm leading-6 text-stocklana-muted">
          You are the owner. This screen simulates one month of the lock for one node, so you can see the operator key proposing buys only inside the limits you record. It does not buy the asset, it does not enter the program, it does not move the node vaults, and it does not transfer USDC.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Two signatures</CardTitle>
          <CardDescription>This page only simulates the owner side.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 border-t border-stocklana-border pt-4 text-sm leading-6 text-stocklana-muted">
          <p>The simulation checks a 1 USDC transfer to the subscription wallet. It does not submit that transfer.</p>
          <p>The operator key proposes a later buy. Price age and confidence stop that key. Deviation is rejected inside the program before a swap.</p>
          <p>The 15% infrastructure split stays on the treasury you wrote into the node.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment</CardTitle>
          <CardDescription>Devnet USDC. Connect the owner wallet on Devnet. Simulate does not move value.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 border-t border-stocklana-border pt-4">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wider text-stocklana-muted">Amount</dt>
              <dd className="mt-1 font-mono text-white">1 USDC · {SUBSCRIPTION_AMOUNT.toLocaleString("en-US")} raw</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-stocklana-muted">Cluster</dt>
              <dd className="mt-1 font-mono text-white">devnet</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-wider text-stocklana-muted">Recipient</dt>
              <dd className="mt-1">
                <a
                  className="font-mono text-sm text-stocklana-accent underline-offset-4 hover:underline"
                  href={explorerAddressUrl(SUBSCRIPTION_RECIPIENT.toBase58(), "devnet")}
                  target="_blank"
                  rel="noreferrer"
                >
                  {SUBSCRIPTION_RECIPIENT.toBase58()}
                </a>
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-wider text-stocklana-muted">Mint</dt>
              <dd className="mt-1 font-mono text-xs text-white">{SUBSCRIPTION_USDC_MINT.toBase58()}</dd>
            </div>
          </dl>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="min-w-0 sm:w-56 [&_.wallet-adapter-button]:h-11 [&_.wallet-adapter-button]:w-full">
              <WalletMultiButton />
            </div>
            <Button type="button" variant="outline" disabled={!canSimulate} onClick={() => void simulate()}>
              {phase === "preparing" ? "Simulating…" : "Simulate on Devnet"}
            </Button>
          </div>
          {phase === "ready" && publicKey ? (
            <p className="text-sm text-white">
              Simulation passed for 1 USDC from {shortAddress(publicKey.toBase58())} to {shortAddress(SUBSCRIPTION_RECIPIENT.toBase58())} on Devnet. No transaction was submitted.
            </p>
          ) : null}

          {connected && publicKey ? (
            <p className="font-mono text-xs text-stocklana-muted">
              Payer {shortAddress(publicKey.toBase58())}
            </p>
          ) : (
            <p className="text-sm text-stocklana-muted">Connect the owner wallet before the simulation.</p>
          )}
          {payerIsRecipient ? (
            <p className="text-sm text-amber-200">This wallet is the recipient. Connect the owner wallet.</p>
          ) : null}
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
