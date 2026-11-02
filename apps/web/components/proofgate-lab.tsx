"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, Transaction } from "@solana/web3.js";
import { WalletConnectButton } from "@/components/wallet-connect-button";
import { labProgress } from "@/lib/lab-progress.mjs";

const INPUT_NAME = "Synthetic dUSDC";
const INPUT_SYMBOL = "dUSDC";

type LabConfig = {
  ok?: boolean;
  network?: string;
  rpcUrl?: string;
  programId?: string;
  policyVersion?: string;
  authorizationEpoch?: string;
  paused?: boolean;
  policySigner?: string;
  inputMint?: string;
  outputMint?: string;
  reasons?: string[];
  error?: string;
  networkIdentity?: string;
};

type LabAsset = {
  assetId: string;
  ticker: string;
  displayName: string;
  lane: "RESEARCH_ONLY" | "LAB_VERIFIED" | "BLOCKED";
  disclaimer: string;
  mint: string | null;
};

type Mandate = {
  exists?: boolean;
  portfolioExists?: boolean;
  mandateExists?: boolean;
  owner?: string;
  pool?: string;
  inputMint?: string;
  outputMint?: string;
  maxPerTrade?: string;
  maxDaily?: string;
  spent?: string;
  portfolioRemaining?: string;
  expiresAt?: number;
  paused?: boolean;
  rateNumerator?: string;
  rateDenominator?: string;
  rateExpiresAt?: number;
};

type DecisionName = "PENDING" | "BLOCKED" | "AUTHORIZED" | "EXPIRED" | "REVOKED" | "ERROR" | "EXECUTED";

async function postJson(path: string, body: unknown) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  return { response, payload };
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function localRpc(url: string | undefined) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost") && parsed.port === "18999";
  } catch {
    return false;
  }
}

export function ProofGateLab() {
  const { publicKey, signMessage, signTransaction, connected, disconnecting } = useWallet();
  const [config, setConfig] = useState<LabConfig | null>(null);
  const [assets, setAssets] = useState<LabAsset[]>([]);
  const [mandate, setMandate] = useState<Mandate | null>(null);
  const [amount, setAmount] = useState("1000");
  const [minimum, setMinimum] = useState("1000");
  const [decision, setDecision] = useState<DecisionName>("PENDING");
  const [reasons, setReasons] = useState<string[]>([]);
  const [authorization, setAuthorization] = useState<Record<string, string | number> | null>(null);
  const [receipt, setReceipt] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState("lab:dAAPL");

  const refresh = useCallback(async () => {
    const [configResponse, assetResponse] = await Promise.all([
      fetch("/api/lab/config"),
      fetch("/api/lab/assets"),
    ]);
    setConfig(await configResponse.json());
    const assetPayload = await assetResponse.json();
    setAssets(assetPayload.assets ?? []);
    if (publicKey) {
      const assetQuery = selectedAssetId ? `&asset=${encodeURIComponent(selectedAssetId)}` : "";
      const mandateResponse = await fetch(`/api/lab/mandate?owner=${publicKey.toBase58()}${assetQuery}`);
      setMandate(await mandateResponse.json());
    } else {
      setMandate(null);
    }
  }, [publicKey, selectedAssetId]);

  useEffect(() => {
    void refresh();
  }, [refresh, connected, disconnecting]);

  useEffect(() => {
    const verifiedIds = assets.filter((asset) => asset.lane === "LAB_VERIFIED").map((asset) => asset.assetId);
    if (verifiedIds.length === 0 || verifiedIds.includes(selectedAssetId)) return;
    setSelectedAssetId(verifiedIds[0]);
  }, [assets, selectedAssetId]);

  async function authenticated(path: string, extra: Record<string, unknown>) {
    if (!publicKey || !signMessage) throw new Error("Connect a wallet before requesting a signature.");
    const challenge = await postJson("/api/lab/challenge", { owner: publicKey.toBase58() });
    if (!challenge.response.ok) throw new Error(challenge.payload.error ?? "Authentication challenge failed.");
    const message = new TextEncoder().encode(challenge.payload.message);
    const signatureBytes = await signMessage(message);
    return postJson(path, {
      ...extra,
      owner: publicKey.toBase58(),
      challenge: {
        nonce: challenge.payload.nonce,
        signature: bytesToBase64(signatureBytes),
      },
    });
  }

  async function evaluate() {
    setBusy(true);
    setReceipt(null);
    setAuthorization(null);
    try {
      const result = await authenticated("/api/lab/authorize", {
        assetId: selectedAssetId,
        amountIn: amount,
        minimumAmountOut: minimum,
        nonce: String(Date.now()),
        walletCluster: "surfpool-local",
      });
      const payload = result.payload;
      setReasons(payload.reasons ?? []);
      if (payload.decision === "AUTHORIZED") {
        setDecision("AUTHORIZED");
        setAuthorization(payload);
      } else if (payload.decision === "ERROR") {
        setDecision("ERROR");
      } else {
        setDecision("BLOCKED");
      }
    } catch (error) {
      setDecision("ERROR");
      setReasons([error instanceof Error ? error.message : "The wallet did not sign the authentication message. No settlement was requested."]);
    } finally {
      setBusy(false);
    }
  }

  async function settle() {
    if (!authorization || !publicKey || !signTransaction || !config?.rpcUrl) return;
    if (!localRpc(config.rpcUrl)) {
      setDecision("ERROR");
      setReasons(["The configured RPC is not the local Surfpool endpoint."]);
      return;
    }
    if (Math.floor(Date.now() / 1000) >= Number(authorization.expiresAt)) {
      setDecision("EXPIRED");
      setReasons(["The authorization window elapsed before the wallet signed."]);
      return;
    }
    const fresh = await fetch("/api/lab/config").then((response) => response.json());
    if (fresh.authorizationEpoch !== authorization.authorizationEpoch || fresh.policyVersion !== authorization.policyVersion || fresh.paused) {
      setDecision(fresh.paused ? "BLOCKED" : "REVOKED");
      setReasons(["The ProofGate configuration changed after authorization. The transaction was not sent."]);
      return;
    }
    setBusy(true);
    try {
      const transaction = Transaction.from(base64ToBytes(String(authorization.proof)));
      const signed = await signTransaction(transaction);
      const connection = new Connection(config.rpcUrl, "confirmed");
      const signature = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: true });
      await connection.confirmTransaction({
        signature,
        blockhash: String(authorization.blockhash),
        lastValidBlockHeight: Number(authorization.lastValidBlockHeight),
      }, "confirmed");
      const reconciled = await postJson("/api/lab/reconcile", {
        signature,
        receiptAddress: authorization.receipt,
        authorizationDigest: authorization.digest,
      });
      setReceipt({ signature, ...reconciled.payload });
      setDecision(reconciled.payload.decision === "EXECUTED" ? "EXECUTED" : "ERROR");
      setReasons(reconciled.payload.reasons ?? []);
      await refresh();
    } catch (error) {
      setDecision("ERROR");
      setReasons([error instanceof Error ? error.message : "The wallet refused to sign. No transaction was sent."]);
    } finally {
      setBusy(false);
    }
  }

  async function setup(kind: "portfolio" | "mandate") {
    setBusy(true);
    try {
      const prepared = await authenticated("/api/lab/setup", { kind, assetId: selectedAssetId });
      if (!prepared.payload.transaction || !signTransaction || !config?.rpcUrl || !localRpc(config.rpcUrl)) {
        setDecision("ERROR");
        setReasons(prepared.payload.reasons ?? ["The lab could not prepare the owner account."]);
        return;
      }
      const transaction = Transaction.from(base64ToBytes(prepared.payload.transaction));
      const signed = await signTransaction(transaction);
      const connection = new Connection(config.rpcUrl, "confirmed");
      const signature = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: true });
      await connection.confirmTransaction({
        signature,
        blockhash: prepared.payload.blockhash,
        lastValidBlockHeight: prepared.payload.lastValidBlockHeight,
      }, "confirmed");
      await refresh();
    } catch (error) {
      setDecision("ERROR");
      setReasons([error instanceof Error ? error.message : "The wallet refused the account setup. Nothing was submitted."]);
    } finally {
      setBusy(false);
    }
  }

  const verifiedAssets = assets.filter((asset) => asset.lane === "LAB_VERIFIED");
  const verified = verifiedAssets.find((asset) => asset.assetId === selectedAssetId) ?? verifiedAssets[0];
  const outputName = verified?.displayName ?? "Synthetic dAAPL";
  const inputMint = config?.inputMint ?? mandate?.inputMint;
  const outputMint = verified?.mint ?? config?.outputMint ?? mandate?.outputMint;
  const progress = labProgress({
    connected: Boolean(publicKey),
    setupKnown: !publicKey || mandate !== null,
    portfolioExists: Boolean(mandate?.portfolioExists || mandate?.exists),
    mandateExists: Boolean(mandate?.exists),
    decision,
  });
  const currentStep = progress.steps.find((step) => step.state === "current");

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-stocklana-muted">ProofGate Lab · synthetic only</p>
        <h1 className="text-2xl font-semibold">Local settlement experiment</h1>
        <p className="max-w-3xl text-sm text-stocklana-muted">
          Each synthetic mint in this Surfpool is an experimental SPL token. It is not a share of the named company. The research catalog cannot settle.
          Phantom must use the RPC shown below. This page never receives the ProofGate key.
        </p>
      </header>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-sm font-semibold">Settlement pair</h2>
        <p className="mt-2 text-sm">{INPUT_NAME} ({INPUT_SYMBOL}) → {outputName}</p>
        <label className="mt-3 block text-xs text-stocklana-muted">Synthetic twin
          <select
            className="mt-1 block rounded-lg border border-white/20 bg-transparent px-3 py-2 text-sm text-white"
            value={verified?.assetId ?? selectedAssetId}
            onChange={(event) => {
              setSelectedAssetId(event.target.value);
              setAuthorization(null);
              setDecision("PENDING");
              setReasons([]);
            }}
          >
            {(verifiedAssets.length > 0 ? verifiedAssets : [{ assetId: "lab:dAAPL", displayName: "Synthetic dAAPL" }]).map((asset) => (
              <option key={asset.assetId} value={asset.assetId}>{asset.displayName}</option>
            ))}
          </select>
        </label>
        <p className="mt-1 text-xs text-stocklana-muted">These names are labels on this page. Phantom shows the mint address. Each twin has its own pool and its own mandate. The portfolio stays on Synthetic dUSDC.</p>
        <dl className="mt-3 space-y-1 font-mono text-xs text-stocklana-muted">
          <div>Input mint {inputMint ?? "waiting for the lab API"}</div>
          <div>Output mint {outputMint ?? "waiting for the lab API"}</div>
          <div>Wallet RPC {config?.rpcUrl ?? "waiting for the lab API"}</div>
        </dl>
        <p className="mt-3 text-sm text-stocklana-muted">Set the Phantom network to this RPC before connecting.</p>
        <div className="mt-4 border-t border-white/10 pt-3">
          <h3 className="text-sm font-semibold">Next step</h3>
          <p className="mt-2 text-sm">{progress.current === "loading" ? "Reading the portfolio and mandate." : currentStep ? currentStep.title : "The local swap is confirmed. The receipt below is the record."}</p>
          {currentStep ? <p className="mt-1 text-sm text-stocklana-muted">{currentStep.wallet}</p> : null}
          <ol className="mt-3 space-y-2 text-sm">
            {progress.steps.map((step, index) => (
              <li key={step.id} className={step.state === "current" ? "text-white" : "text-stocklana-muted"}>
                <span className="font-mono text-xs">{index + 1}. {step.state === "done" ? "Done" : step.state === "current" ? "Now" : "Later"}</span>
                <span> · {step.title}</span>
                <span className="mt-1 block text-xs">{step.wallet}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 md:grid-cols-2">
        <div>
          <h2 className="text-sm font-semibold">Environment</h2>
          <dl className="mt-3 space-y-1 font-mono text-xs text-stocklana-muted">
            <div>Network {config?.network ?? "unavailable"}</div>
            <div>RPC {config?.rpcUrl ?? config?.error ?? "not configured"}</div>
            <div>Program {config?.programId ?? "—"}</div>
            <div>Policy version {config?.policyVersion ?? "—"} · epoch {config?.authorizationEpoch ?? "—"}</div>
            <div>Config {config?.paused ? "paused" : config?.ok ? "active" : "unavailable"}</div>
            <div>Wallet {publicKey ? publicKey.toBase58() : "not connected"}</div>
          </dl>
          <p className="mt-2 text-xs text-stocklana-muted">{config?.networkIdentity}</p>
        </div>
        <div className="flex flex-col justify-between gap-3">
          <WalletConnectButton />
          {!publicKey ? <p className="text-sm text-stocklana-muted">Research entries stay visible. Settlement stays closed until a wallet connects.</p> : null}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-sm font-semibold">Assets</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {assets.map((asset) => (
            <li key={asset.assetId} className="flex flex-col gap-1 border-t border-white/10 pt-2">
              <span>{asset.displayName} · {asset.ticker} · {asset.lane}</span>
              <span className="text-xs text-stocklana-muted">{asset.disclaimer}{asset.mint ? ` Mint ${asset.mint}` : ""}</span>
            </li>
          ))}
          {assets.length === 0 ? <li className="text-stocklana-muted">The lab API has not returned assets yet.</li> : null}
        </ul>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-sm font-semibold">Mandate</h2>
        {mandate?.exists ? (
          <dl className="mt-3 grid gap-1 font-mono text-xs text-stocklana-muted md:grid-cols-2">
            <div>Owner {mandate.owner}</div>
            <div>Pool {mandate.pool}</div>
            <div>Input {INPUT_NAME} {mandate.inputMint}</div>
            <div>Output {outputName} {mandate.outputMint}</div>
            <div>Per trade {mandate.maxPerTrade}</div>
            <div>Daily {mandate.maxDaily}</div>
            <div>Spent {mandate.spent}</div>
            <div>Portfolio remaining {mandate.portfolioRemaining}</div>
            <div>Expires {mandate.expiresAt}</div>
            <div>Paused {mandate.paused ? "yes" : "no"}</div>
            <div>Pool rate {mandate.rateNumerator}/{mandate.rateDenominator}</div>
            <div>Rate expires {mandate.rateExpiresAt ?? "unavailable"}</div>
          </dl>
        ) : (
          <div className="mt-3 flex flex-col gap-2 text-sm text-stocklana-muted">
            <p>{publicKey ? "This wallet has no portfolio or mandate on the current Surfpool." : "Connect a wallet to read a mandate."}</p>
            {publicKey ? (
              <div className="flex gap-2">
                <button className="rounded-lg border border-white/20 px-3 py-2 disabled:opacity-50" type="button" disabled={busy || Boolean(mandate?.portfolioExists)} onClick={() => void setup("portfolio")}>Initialize portfolio</button>
                <button className="rounded-lg border border-white/20 px-3 py-2 disabled:opacity-50" type="button" disabled={busy || !mandate?.portfolioExists} onClick={() => void setup("mandate")}>Initialize mandate</button>
              </div>
            ) : null}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-sm font-semibold">Proposal</h2>
        <p className="mt-2 text-sm text-stocklana-muted">
          {verified ? `${INPUT_NAME} → ${outputName}` : "No verified synthetic mint in this runtime"}. Evidence is the pool&apos;s fixed rate, rebuilt by the server.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <label className="text-xs text-stocklana-muted">Amount
            <input className="mt-1 block rounded-lg border border-white/20 bg-transparent px-3 py-2 text-sm text-white" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </label>
          <label className="text-xs text-stocklana-muted">Minimum output
            <input className="mt-1 block rounded-lg border border-white/20 bg-transparent px-3 py-2 text-sm text-white" value={minimum} onChange={(event) => setMinimum(event.target.value)} />
          </label>
          <button className="self-end rounded-lg bg-white px-3 py-2 text-sm font-semibold text-black disabled:opacity-50" type="button" disabled={busy || !publicKey || !verified} onClick={() => void evaluate()}>
            Request ProofGate decision
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-sm font-semibold">Decision · {decision}</h2>
        <ul className="mt-2 list-disc pl-5 text-sm text-stocklana-muted">
          {reasons.map((reason) => <li key={reason}>{reason}</li>)}
        </ul>
        {decision === "AUTHORIZED" && authorization ? (
          <div className="mt-3 space-y-2 text-sm">
            <p>Owner {String(authorization.owner)}. Amount {String(authorization.amountIn)} for at least {String(authorization.minimumAmountOut)}. Expected output {String(authorization.expectedOut)}.</p>
            <p className="font-mono text-xs text-stocklana-muted">Digest {String(authorization.digest)}</p>
            <button className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-black" type="button" disabled={busy} onClick={() => void settle()}>
              Sign with wallet and settle
            </button>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-sm font-semibold">Receipt</h2>
        {receipt ? (
          <pre className="mt-3 overflow-auto text-xs text-stocklana-muted">{JSON.stringify(receipt, null, 2)}</pre>
        ) : (
          <p className="mt-2 text-sm text-stocklana-muted">A signature from the wallet is not a completed swap. The receipt appears after the local RPC confirms it.</p>
        )}
      </section>
    </main>
  );
}
