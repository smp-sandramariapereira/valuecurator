"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection } from "@solana/web3.js";
import { Badge } from "@/components/ui/badge";
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

type Phase = "idle" | "preparing" | "ready" | "sending" | "sent";

function shortAddress(value: string): string {
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

export function SubscriptionCard() {
  const { connected, publicKey, sendTransaction } = useWallet();
  const connection = useMemo(() => new Connection(SUBSCRIPTION_RPC, "confirmed"), []);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);

  const payerIsRecipient = publicKey?.equals(SUBSCRIPTION_RECIPIENT) ?? false;
  const canSimulate = connected && publicKey !== null && !payerIsRecipient && (phase === "idle" || phase === "ready");
  const canSend = phase === "ready" && publicKey !== null && !payerIsRecipient;

  async function simulate() {
    if (!publicKey) return;
    setError(null);
    setSignature(null);
    setPhase("preparing");
    try {
      const transaction = await buildSubscriptionTransfer(connection, publicKey);
      const simulation = await connection.simulateTransaction(transaction);
      if (simulation.value.err) {
        const logs = simulation.value.logs?.slice(-4).join(" ") ?? "";
        setError(logs || "Mainnet simulation rejected the transfer.");
        setPhase("idle");
        return;
      }
      setPhase("ready");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Mainnet simulation did not finish.");
      setPhase("idle");
    }
  }

  async function signAndSend() {
    if (!publicKey) return;
    setError(null);
    setPhase("sending");
    try {
      const transaction = await buildSubscriptionTransfer(connection, publicKey);
      const sent = await sendTransaction(transaction, connection);
      await connection.confirmTransaction(
        {
          signature: sent,
          blockhash: transaction.recentBlockhash!,
          lastValidBlockHeight: transaction.lastValidBlockHeight!,
        },
        "confirmed",
      );
      setSignature(sent);
      setPhase("sent");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The wallet did not send the transfer.");
      setPhase("ready");
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
          You are the owner. This payment covers one node for one month, so the operator key can propose buys only inside the limits you record. It does not buy the asset, it does not enter the program, and it does not move the node vaults.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Two signatures</CardTitle>
          <CardDescription>This page asks only for the owner signature.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 border-t border-stocklana-border pt-4 text-sm leading-6 text-stocklana-muted">
          <p>Your signature sends 1 USDC to the subscription wallet.</p>
          <p>The operator key proposes a later buy. Price age and confidence stop that key. Deviation is rejected inside the program before a swap.</p>
          <p>The 15% infrastructure split stays on the treasury you wrote into the node.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment</CardTitle>
          <CardDescription>Mainnet USDC. The wallet that signs must be the owner, on mainnet.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 border-t border-stocklana-border pt-4">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wider text-stocklana-muted">Amount</dt>
              <dd className="mt-1 font-mono text-white">1 USDC · {SUBSCRIPTION_AMOUNT.toLocaleString("en-US")} raw</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-stocklana-muted">Cluster</dt>
              <dd className="mt-1 font-mono text-white">mainnet-beta</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-wider text-stocklana-muted">Recipient</dt>
              <dd className="mt-1">
                <a
                  className="font-mono text-sm text-stocklana-accent underline-offset-4 hover:underline"
                  href={explorerAddressUrl(SUBSCRIPTION_RECIPIENT.toBase58(), "mainnet-beta")}
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
              {phase === "preparing" ? "Simulating…" : "Simulate on mainnet"}
            </Button>
            <Button type="button" disabled={!canSend} onClick={() => void signAndSend()}>
              {phase === "sending" ? "Waiting for signature…" : "Sign 1 USDC"}
            </Button>
          </div>
          {phase === "ready" && publicKey ? (
            <p className="text-sm text-white">
              Simulation passed. The next click asks the wallet to send 1 USDC from {shortAddress(publicKey.toBase58())} to {shortAddress(SUBSCRIPTION_RECIPIENT.toBase58())} on mainnet.
            </p>
          ) : null}

          {connected && publicKey ? (
            <p className="font-mono text-xs text-stocklana-muted">
              Signer {shortAddress(publicKey.toBase58())}
            </p>
          ) : (
            <p className="text-sm text-stocklana-muted">Connect the owner wallet before signing.</p>
          )}
          {payerIsRecipient ? (
            <p className="text-sm text-amber-200">This wallet is the recipient. Connect the owner wallet.</p>
          ) : null}
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          {signature ? (
            <p className="text-sm text-white">
              <Badge className="mr-2 border-stocklana-accent/30 text-stocklana-accent">Confirmed</Badge>
              <a className="underline-offset-4 hover:underline" href={`https://explorer.solana.com/tx/${signature}?cluster=mainnet-beta`} target="_blank" rel="noreferrer">
                {shortAddress(signature)}
              </a>
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
