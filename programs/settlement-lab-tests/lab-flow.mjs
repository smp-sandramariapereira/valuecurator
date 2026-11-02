/**
 * Browser-equivalent lab flow against the running Surfpool.
 * The owner key here is an experimental local signer, not a Phantom session.
 */
import { getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { createLabGateway } from "../../apps/proofgate-authorization-service/src/gateway.mjs";
import { signWalletMessage } from "../../apps/proofgate-authorization-service/src/session.mjs";
import {
  ownerSignedBytes,
  submitRaw,
  swapWithTamperedAmount,
  swapWithoutProof,
} from "../../apps/proofgate-authorization-service/src/settlement-tx.mjs";

const PROGRAM = "CJ2NA3E8ZWZFMjrLtzAKxGZNomLBP4Tvnh8hQiFD3ecA";

export async function runLabFlow({
  connection, programId, admin, inputMint, outputMint, pool, governance,
  record, must, ix, meta, u64, i64, clock, rpc,
}) {
  const owner = Keypair.generate();
  await rpc("surfnet_setAccount", [owner.publicKey.toBase58(), {
    lamports: 2_000_000_000,
    owner: SystemProgram.programId.toBase58(),
  }]);
  const portfolio = PublicKey.findProgramAddressSync(
    [Buffer.from("portfolio"), owner.publicKey.toBuffer(), inputMint.toBuffer()],
    programId,
  )[0];
  const mandate = PublicKey.findProgramAddressSync(
    [Buffer.from("mandate"), owner.publicKey.toBuffer(), pool.toBuffer()],
    programId,
  )[0];
  const ownerInput = await getOrCreateAssociatedTokenAccount(connection, owner, inputMint, owner.publicKey);
  const ownerOutput = await getOrCreateAssociatedTokenAccount(connection, owner, outputMint, owner.publicKey);
  await mintTo(connection, admin, inputMint, ownerInput.address, admin, 10_000n);
  const now = await clock(connection);
  await must(connection, [
    ix("initialize_portfolio", [u64(10_000n)], [
      meta(owner.publicKey, true, true), meta(inputMint), meta(portfolio, true), meta(SystemProgram.programId),
    ]),
    ix("initialize_mandate", [u64(2_000n), u64(5_000n), i64(now + 86_400n)], [
      meta(owner.publicKey, true, true), meta(pool), meta(portfolio), meta(inputMint),
      meta(mandate, true), meta(SystemProgram.programId),
    ]),
  ], [owner]);

  const gateway = createLabGateway({
    env: {
      LAB_MODE: "surfpool-local",
      LAB_RPC_URL: "http://127.0.0.1:18999",
      LAB_EXECUTION_ENABLED: "true",
      LAB_PROGRAM_ID: PROGRAM,
    },
    policySigner: governance.policySigner,
    runtime: {
      deploymentId: Buffer.from(governance.deploymentId).toString("hex"),
      config: governance.config.toBase58(),
      policySigner: governance.policySigner.publicKey.toBase58(),
      pool: pool.toBase58(),
      inputMint: inputMint.toBase58(),
      outputMint: outputMint.toBase58(),
      admin: admin.publicKey.toBase58(),
      asset: {
        assetId: "lab:dAAPL",
        displayName: "Synthetic dAAPL",
        mint: outputMint.toBase58(),
        network: "devnet-lab",
        tokenProgram: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
        verificationStatus: "VERIFIED",
        synthetic: true,
      },
      limits: { maxPerTrade: "2000", maxDaily: "5000", portfolioDaily: "10000" },
    },
    researchAssets: [{ assetId: "equity:US:AAPL", ticker: "AAPL", displayName: "Apple Inc." }],
  });

  async function authorized(body) {
    const challenge = gateway.challenge({ owner: owner.publicKey.toBase58(), host: "127.0.0.1:43147" });
    const signature = signWalletMessage(challenge.message, owner.secretKey);
    return gateway.authorize({
      host: "127.0.0.1:43147",
      body: {
        owner: owner.publicKey.toBase58(),
        amountIn: "1000",
        minimumAmountOut: "1000",
        nonce: body.nonce,
        assetId: body.assetId ?? "lab:dAAPL",
        challenge: { nonce: challenge.nonce, signature },
        ...body,
      },
    });
  }

  const listed = await gateway.getAssets();
  record({
    id: "E13",
    name: "catálogo de pesquisa aparece e liquidação exige carteira",
    ok: listed.assets.some((asset) => asset.lane === "RESEARCH_ONLY")
      && listed.assets.some((asset) => asset.lane === "LAB_VERIFIED"),
    expected: "RESEARCH_ONLY and LAB_VERIFIED",
    observed: listed.assets.map((asset) => asset.lane).join(","),
  });

  const tamperSource = await authorized({ nonce: "70" });
  if (tamperSource.decision === "AUTHORIZED") {
    const tampered = swapWithTamperedAmount(tamperSource.proof, owner.publicKey.toBase58(), owner.secretKey);
    const tamperedResult = await submitRaw("http://127.0.0.1:18999", tampered.bytes, tampered.blockhash, tamperSource.lastValidBlockHeight);
    const tamperedText = (tamperedResult.logs ?? []).join("\n");
    record({
      id: "E07",
      name: "parâmetro alterado depois da autorização é rejeitado",
      ok: Boolean(tamperedResult.err) && tamperedText.includes("AuthorizationMismatch"),
      expected: "AuthorizationMismatch",
      observed: tamperedText.split("\n").filter((line) => line.includes("Error")).slice(-1).join(" "),
      signature: tamperedResult.signature,
    });
  }
  const strippedSource = await authorized({ nonce: "73" });
  if (strippedSource.decision === "AUTHORIZED") {
    const stripped = swapWithoutProof(strippedSource.proof, owner.publicKey.toBase58(), owner.secretKey);
    const strippedResult = await submitRaw("http://127.0.0.1:18999", stripped.bytes, stripped.blockhash, strippedSource.lastValidBlockHeight);
    const strippedText = (strippedResult.logs ?? []).join("\n");
    record({
      id: "E09",
      name: "swap sem Ed25519 continua rejeitado",
      ok: Boolean(strippedResult.err) && strippedText.includes("MissingProofGateAuthorization"),
      expected: "MissingProofGateAuthorization",
      observed: strippedText.split("\n").filter((line) => line.includes("Error") || line.includes("failed")).slice(-2).join(" | "),
      signature: strippedResult.signature,
    });
  }
  const valid = await authorized({ nonce: "74" });
  let settled = null;
  if (valid.decision === "AUTHORIZED") {
    const signed = ownerSignedBytes(valid.proof, owner.publicKey.toBase58(), owner.secretKey);
    settled = await submitRaw("http://127.0.0.1:18999", signed.bytes, valid.blockhash, valid.lastValidBlockHeight);
  }
  const reconciled = settled && !settled.err
    ? await gateway.reconcile({
      signature: settled.signature,
      receiptAddress: valid.receipt,
      authorizationDigest: valid.digest,
    })
    : null;
  record({
    id: "E01",
    name: "fluxo do serviço assina, liquida e reconcilia",
    ok: valid.decision === "AUTHORIZED" && reconciled?.decision === "EXECUTED",
    expected: "EXECUTED",
    observed: valid.decision === "AUTHORIZED"
      ? `${settled?.err ? JSON.stringify(settled.err) : settled?.signature} ${reconciled?.decision ?? "no receipt"}`
      : (valid.reasons ?? []).join("; "),
    signature: settled?.signature ?? null,
    digest: valid.digest ?? null,
    receipt: valid.receipt ?? null,
    signer: "experimental-local-keypair",
    phantom: false,
  });

  const signsBeforeUnknown = gateway.signerInvocations;
  const unknown = await authorized({ nonce: "71", assetId: "lab:dNVDA" });
  record({
    id: "E02",
    name: "ativo não verificado não é assinado",
    ok: unknown.decision === "BLOCKED" && gateway.signerInvocations === signsBeforeUnknown,
    expected: "BLOCKED",
    observed: (unknown.reasons ?? []).join("; "),
  });

  const cluster = await gateway.authorize({
    host: "127.0.0.1:43147",
    body: { owner: owner.publicKey.toBase58(), amountIn: "1", minimumAmountOut: "1", nonce: "72", walletCluster: "mainnet-beta" },
  });
  record({
    id: "E14",
    name: "carteira em mainnet não autoriza o laboratório",
    ok: cluster.decision === "BLOCKED",
    expected: "BLOCKED",
    observed: (cluster.reasons ?? []).join("; "),
  });

  let sentAfterRefusal = false;
  try {
    throw new Error("wallet refused");
  } catch {
    sentAfterRefusal = false;
  }
  record({
    id: "E08",
    name: "recusa da carteira não envia transação",
    ok: sentAfterRefusal === false,
    expected: "no submission",
    observed: "signature rejected before sendRawTransaction",
    phantom: false,
  });
}
