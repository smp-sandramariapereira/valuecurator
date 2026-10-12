"use client";

import { useEffect, useMemo, useState } from "react";
import { WalletConnectButton } from "@/components/wallet-connect-button";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection } from "@solana/web3.js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { explorerAddressUrl, formatTokenAmount } from "@/lib/kairos";
import {
  SUBSCRIPTION_AMOUNT,
  SUBSCRIPTION_RECIPIENT,
  SUBSCRIPTION_RPC,
  SUBSCRIPTION_USDC_MINT,
  buildSubscriptionTransfer,
  readDevnetUsdcBalance,
} from "@/lib/subscription";

type Phase = "idle" | "preparing" | "ready" | "sending" | "sent";

function shortAddress(value: string): string {
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

export function SubscriptionCard() {
  const { connected, publicKey, sendTransaction } = useWallet();
  const connection = useMemo(() => new Connection(SUBSCRIPTION_RPC, "confirmed"), []);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<bigint | null>(null);
  const [signature, setSignature] = useState<string | null>(null);

  const payerIsRecipient = publicKey?.equals(SUBSCRIPTION_RECIPIENT) ?? false;
  const hasEnough = walletBalance !== null && walletBalance >= BigInt(SUBSCRIPTION_AMOUNT);
  const canSimulate = connected && publicKey !== null && !payerIsRecipient && phase !== "preparing" && phase !== "sending";
  const canConfirm = phase === "ready" && publicKey !== null && !payerIsRecipient && hasEnough;

  useEffect(() => {
    if (!publicKey) {
      setWalletBalance(null);
      return;
    }
    let cancelled = false;
    setWalletBalance(null);
    void readDevnetUsdcBalance(connection, publicKey)
      .then((amount) => {
        if (!cancelled) setWalletBalance(amount);
      })
      .catch(() => {
        if (!cancelled) setWalletBalance(null);
      });
    return () => {
      cancelled = true;
    };
  }, [connection, publicKey]);

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

  async function confirmAndSign() {
    if (!publicKey || !canConfirm) return;
    setError(null);
    setSignature(null);
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
      setWalletBalance(await readDevnetUsdcBalance(connection, publicKey));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The wallet did not confirm the transfer.");
      setPhase("ready");
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-[-0.04em]">One month of the lock</h1>
        <p className="max-w-2xl text-sm leading-6 text-stocklana-muted">
          You are the owner. This screen reads the Devnet USDC balance in your wallet. It takes 1 USDC only after a second confirmation. It does not buy the asset, it does not enter the program, and it does not move the node vaults.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Two signatures</CardTitle>
          <CardDescription>The first step reads the wallet. The second confirmation signs.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 border-t border-stocklana-border pt-4 text-sm leading-6 text-stocklana-muted">
          <p>The simulation checks a 1 USDC transfer from the connected Devnet wallet. Nothing moves until you confirm a second time.</p>
          <p>The operator key proposes a later buy. Price age and confidence stop that key. Deviation is rejected inside the program before a swap.</p>
          <p>The 15% infrastructure split stays on the treasury you wrote into the node.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment</CardTitle>
          <CardDescription>Devnet USDC. Connect the owner wallet on Devnet. The second confirmation takes 1 USDC from that wallet.</CardDescription>
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
              <WalletConnectButton />
            </div>
            <Button type="button" variant="outline" disabled={!canSimulate} onClick={() => void simulate()}>
              {phase === "preparing" ? "Reading wallet…" : "Simulate on Devnet"}
            </Button>
            <Button type="button" disabled={!canConfirm} onClick={() => void confirmAndSign()}>
              {phase === "sending" ? "Waiting for the wallet…" : "Confirm and sign"}
            </Button>
          </div>
          {connected && publicKey ? (
            <p className="text-sm text-white">
              Devnet wallet balance {walletBalance === null ? "…" : `${formatTokenAmount(walletBalance, 6)} USDC`}
            </p>
          ) : null}
          {phase === "ready" && publicKey ? (
            <p className="text-sm text-white">
              Simulation passed. Confirm again to take 1 USDC from {shortAddress(publicKey.toBase58())} on Devnet.
              {walletBalance !== null && !hasEnough ? " This wallet does not hold 1 USDC, so the second confirmation stays closed." : ""}
            </p>
          ) : null}
          {phase === "sent" && signature ? (
            <p className="text-sm text-white">
              Confirmed on Devnet.{" "}
              <a className="underline-offset-4 hover:underline" href={`https://explorer.solana.com/tx/${signature}?cluster=devnet`} target="_blank" rel="noreferrer">
                {shortAddress(signature)}
              </a>
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
