"use client";

import { WalletAdapterNetwork, type Adapter } from "@solana/wallet-adapter-base";
import {
  ConnectionProvider,
  useWallet,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalContext, useWalletModal } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { rpcUrl } from "@/lib/kairos";

import "@solana/wallet-adapter-react-ui/styles.css";

const ALLOWED_WALLETS = new Set(["Phantom", "Solflare"]);

function allowWallet(adapter: Adapter): Promise<boolean> {
  return Promise.resolve(ALLOWED_WALLETS.has(adapter.name));
}

function AllowedWalletModal() {
  const { wallets, select } = useWallet();
  const { setVisible } = useWalletModal();
  const allowed = wallets.filter((wallet) => ALLOWED_WALLETS.has(wallet.adapter.name));

  return (
    <div
      className="wallet-adapter-modal wallet-adapter-modal-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wallet-adapter-modal-title"
      onClick={() => setVisible(false)}
    >
      <div className="wallet-adapter-modal-container">
        <div className="wallet-adapter-modal-wrapper" onClick={(event) => event.stopPropagation()}>
          <button className="wallet-adapter-modal-button-close" type="button" onClick={() => setVisible(false)} aria-label="Close">
            <svg width="14" height="14">
              <path d="M14 12.461 8.3 6.772l5.234-5.233L12.006 0 6.772 5.234 1.54 0 0 1.539l5.234 5.233L0 12.006l1.539 1.528L6.772 8.3l5.69 5.7L14 12.461z" />
            </svg>
          </button>
          <h1 className="wallet-adapter-modal-title" id="wallet-adapter-modal-title">
            Connect a wallet on Solana to continue
          </h1>
          <ul className="wallet-adapter-modal-list">
            {allowed.map((wallet) => (
              <li key={wallet.adapter.name}>
                <button
                  className="wallet-adapter-button"
                  type="button"
                  onClick={() => {
                    select(wallet.adapter.name);
                    setVisible(false);
                  }}
                >
                  <i className="wallet-adapter-button-start-icon">
                    <img src={wallet.adapter.icon} alt="" width={24} height={24} />
                  </i>
                  {wallet.adapter.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function AllowedWalletModalProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const { wallet, select } = useWallet();

  useEffect(() => {
    const name = wallet?.adapter.name;
    if (name && !ALLOWED_WALLETS.has(name)) select(null);
  }, [select, wallet]);

  return (
    <WalletModalContext.Provider value={{ visible, setVisible }}>
      {children}
      {visible ? <AllowedWalletModal /> : null}
    </WalletModalContext.Provider>
  );
}

export function WalletProviders({ children }: { children: ReactNode }) {
  const endpoint = useMemo(() => rpcUrl(), []);
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter({ network: WalletAdapterNetwork.Devnet })],
    [],
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={allowWallet}>
        <AllowedWalletModalProvider>{children}</AllowedWalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
