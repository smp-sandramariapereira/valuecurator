"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const WalletMultiButton = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false },
);

/** True after the first browser paint, so wallet HTML is not hydrated from the server. */
export function useWalletUiReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);
  return ready;
}

export function WalletConnectButton() {
  const ready = useWalletUiReady();
  if (!ready) {
    return (
      <Button variant="outline" type="button" className="h-11 w-full">
        Select Wallet
      </Button>
    );
  }
  return <WalletMultiButton />;
}
