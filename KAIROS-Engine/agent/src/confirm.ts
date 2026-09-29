import {
  type Finality,
  Connection,
  type SignatureStatus,
  type TransactionSignature,
} from "@solana/web3.js";

export class TransactionNotConfirmedError extends Error {
  constructor(
    readonly signature: TransactionSignature,
    readonly detail: unknown,
  ) {
    super(`Devnet did not confirm ${signature}: ${JSON.stringify(detail)}`);
    this.name = "TransactionNotConfirmedError";
  }
}

export async function confirmOnDevnet(
  connection: Connection,
  signature: TransactionSignature,
  blockhash: string,
  lastValidBlockHeight: number,
  commitment: Finality = "confirmed",
): Promise<{ slot: number }> {
  const confirmation = await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    commitment,
  );
  if (confirmation.value.err) {
    throw new TransactionNotConfirmedError(signature, confirmation.value.err);
  }

  const tx = await connection.getTransaction(signature, {
    commitment,
    maxSupportedTransactionVersion: 1,
  });
  if (!tx) {
    const statuses = await connection.getSignatureStatuses([signature], {
      searchTransactionHistory: true,
    });
    const status: SignatureStatus | null = statuses.value[0] ?? null;
    throw new TransactionNotConfirmedError(signature, status);
  }

  return { slot: tx.slot };
}
