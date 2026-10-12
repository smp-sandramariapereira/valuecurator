import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";

/** Circle USDC on Devnet. This mint does not exist on mainnet-beta. */
export const SUBSCRIPTION_USDC_MINT = new PublicKey(
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
);

/** Public receiving address. The key file stays outside the repository. */
export const SUBSCRIPTION_RECIPIENT = new PublicKey(
  "8iRQ6eL4fEBdSgK8MoFrrHQZdX7GDuxrP8sSrFz1hJXh",
);

/** 1 USDC, six decimals. */
export const SUBSCRIPTION_AMOUNT = 1_000_000;

export const SUBSCRIPTION_RPC = "https://api.devnet.solana.com";

export function subscriptionDestination(owner: PublicKey): PublicKey {
  return getAssociatedTokenAddressSync(SUBSCRIPTION_USDC_MINT, owner);
}

export async function buildSubscriptionTransfer(
  connection: Connection,
  payer: PublicKey,
): Promise<Transaction> {
  const source = getAssociatedTokenAddressSync(SUBSCRIPTION_USDC_MINT, payer);
  const destination = subscriptionDestination(SUBSCRIPTION_RECIPIENT);
  const transaction = new Transaction().add(
    createAssociatedTokenAccountIdempotentInstruction(
      payer,
      destination,
      SUBSCRIPTION_RECIPIENT,
      SUBSCRIPTION_USDC_MINT,
    ),
    createTransferInstruction(
      source,
      destination,
      payer,
      SUBSCRIPTION_AMOUNT,
    ),
  );
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = payer;
  return transaction;
}
