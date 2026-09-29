import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import anchor from "@coral-xyz/anchor";

const { AnchorProvider, BN, Program, setProvider } = anchor;
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createMint,
  getAccount,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import idl from "../idl/kairos_engine.json" with { type: "json" };

describe("KAIROS Engine end-to-end", () => {
  const provider = AnchorProvider.env();
  setProvider(provider);
  const program = new Program(idl, provider);
  const payer = provider.wallet.payer;

  const owner = Keypair.generate();
  const operator = Keypair.generate();
  const replacementOperator = Keypair.generate();
  const treasury = Keypair.generate();

  let mint;
  let strategyMint;
  let node;
  let source;
  let replacementSource;
  let vault;
  let treasuryToken;
  let ownerToken;

  before(async () => {
    mint = await createMint(
      provider.connection,
      payer,
      payer.publicKey,
      null,
      6,
      undefined,
      undefined,
      TOKEN_2022_PROGRAM_ID,
    );

    strategyMint = await createMint(
      provider.connection,
      payer,
      payer.publicKey,
      null,
      6,
      undefined,
      undefined,
      TOKEN_2022_PROGRAM_ID,
    );

    [node] = PublicKey.findProgramAddressSync(
      [Buffer.from("node"), owner.publicKey.toBuffer()],
      program.programId,
    );

    source = (await getOrCreateAssociatedTokenAccount(
      provider.connection, payer, mint, operator.publicKey, false,
      undefined, undefined, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
    )).address;
    replacementSource = (await getOrCreateAssociatedTokenAccount(
      provider.connection, payer, mint, replacementOperator.publicKey, false,
      undefined, undefined, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
    )).address;
    vault = (await getOrCreateAssociatedTokenAccount(
      provider.connection, payer, mint, node, true,
      undefined, undefined, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
    )).address;
    treasuryToken = (await getOrCreateAssociatedTokenAccount(
      provider.connection, payer, mint, treasury.publicKey, false,
      undefined, undefined, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
    )).address;
    ownerToken = (await getOrCreateAssociatedTokenAccount(
      provider.connection, payer, mint, owner.publicKey, false,
      undefined, undefined, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
    )).address;

    await mintTo(
      provider.connection, payer, mint, source, payer, 10_000n,
      [], undefined, TOKEN_2022_PROGRAM_ID,
    );
    await mintTo(
      provider.connection, payer, mint, replacementSource, payer, 100n,
      [], undefined, TOKEN_2022_PROGRAM_ID,
    );
  });

  it("rejects using the governance owner as the hot operator", async () => {
    const invalidOwner = Keypair.generate();
    const [invalidNode] = PublicKey.findProgramAddressSync(
      [Buffer.from("node"), invalidOwner.publicKey.toBuffer()],
      program.programId,
    );

    await assert.rejects(
      program.methods
        .initializeNode(1500, treasury.publicKey, invalidOwner.publicKey, strategyMint)
        .accountsPartial({
          payer: provider.wallet.publicKey,
          owner: invalidOwner.publicKey,
          node: invalidNode,
          systemProgram: SystemProgram.programId,
        })
        .signers([invalidOwner])
        .rpc(),
      /InvalidOperator/,
    );
  });

  it("initializes governance, operator, treasury, and strategy mint", async () => {
    await program.methods
      .initializeNode(
        1500,
        treasury.publicKey,
        operator.publicKey,
        strategyMint,
      )
      .accountsPartial({
        payer: provider.wallet.publicKey,
        owner: owner.publicKey,
        node,
        systemProgram: SystemProgram.programId,
      })
      .signers([owner])
      .rpc();

    const account = await program.account.nodeAccount.fetch(node);
    assert.equal(account.owner.toBase58(), owner.publicKey.toBase58());
    assert.equal(account.operator.toBase58(), operator.publicKey.toBase58());
    assert.equal(account.strategyMint.toBase58(), strategyMint.toBase58());
  });

  it("rejects an unauthorized operator without moving funds", async () => {
    await assert.rejects(
      program.methods
        .metabolizeYield(new BN(100))
        .accountsPartial({
          operator: replacementOperator.publicKey,
          owner: owner.publicKey,
          node,
          treasuryPubkey: treasury.publicKey,
          mint,
          sourceToken: replacementSource,
          vaultToken: vault,
          treasuryToken,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([replacementOperator])
        .rpc(),
      /UnauthorizedOperator/,
    );

    assert.equal((await getAccount(provider.connection, replacementSource, undefined, TOKEN_2022_PROGRAM_ID)).amount, 100n);
    assert.equal((await getAccount(provider.connection, vault, undefined, TOKEN_2022_PROGRAM_ID)).amount, 0n);
  });

  it("rejects zero-value metabolism", async () => {
    await assert.rejects(
      program.methods
        .metabolizeYield(new BN(0))
        .accountsPartial({
          operator: operator.publicKey,
          owner: owner.publicKey,
          node,
          treasuryPubkey: treasury.publicKey,
          mint,
          sourceToken: source,
          vaultToken: vault,
          treasuryToken,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([operator])
        .rpc(),
      /ZeroAmount/,
    );
  });

  it("splits operator yield into treasury and recoverable vault", async () => {
    await program.methods
      .metabolizeYield(new BN(10_000))
      .accountsPartial({
        operator: operator.publicKey,
        owner: owner.publicKey,
        node,
        treasuryPubkey: treasury.publicKey,
        mint,
        sourceToken: source,
        vaultToken: vault,
        treasuryToken,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([operator])
      .rpc();

    assert.equal((await getAccount(provider.connection, treasuryToken, undefined, TOKEN_2022_PROGRAM_ID)).amount, 1_500n);
    assert.equal((await getAccount(provider.connection, vault, undefined, TOKEN_2022_PROGRAM_ID)).amount, 8_500n);
  });

  it("rejects a strategy call through an arbitrary router", async () => {
    const outputVault = (await getOrCreateAssociatedTokenAccount(
      provider.connection, payer, strategyMint, node, true,
      undefined, undefined, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
    )).address;

    await assert.rejects(
      program.methods
        .executeStrategySwap(Buffer.alloc(0), new BN(8_500), new BN(1))
        .accountsPartial({
          operator: operator.publicKey,
          owner: owner.publicKey,
          node,
          inputMint: mint,
          outputMint: strategyMint,
          inputVault: vault,
          outputVault,
          inputTokenProgram: TOKEN_2022_PROGRAM_ID,
          outputTokenProgram: TOKEN_2022_PROGRAM_ID,
          jupiterProgram: SystemProgram.programId,
        })
        .signers([operator])
        .rpc(),
    );
  });

  it("lets only the owner recover the remaining vault balance", async () => {
    await assert.rejects(
      program.methods
        .emergencyWithdraw(new BN(1))
        .accountsPartial({
          owner: replacementOperator.publicKey,
          node,
          mint,
          vaultToken: vault,
          destinationToken: ownerToken,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([replacementOperator])
        .rpc(),
    );

    await program.methods
      .emergencyWithdraw(new BN(8_500))
      .accountsPartial({
        owner: owner.publicKey,
        node,
        mint,
        vaultToken: vault,
        destinationToken: ownerToken,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([owner])
      .rpc();

    assert.equal((await getAccount(provider.connection, vault, undefined, TOKEN_2022_PROGRAM_ID)).amount, 0n);
    assert.equal((await getAccount(provider.connection, ownerToken, undefined, TOKEN_2022_PROGRAM_ID)).amount, 8_500n);
  });

  it("allows only the owner to rotate the operational key", async () => {
    await assert.rejects(
      program.methods
        .updateOperator(replacementOperator.publicKey)
        .accountsPartial({ owner: replacementOperator.publicKey, node })
        .signers([replacementOperator])
        .rpc(),
    );

    await program.methods
      .updateOperator(replacementOperator.publicKey)
      .accountsPartial({ owner: owner.publicKey, node })
      .signers([owner])
      .rpc();

    const account = await program.account.nodeAccount.fetch(node);
    assert.equal(account.operator.toBase58(), replacementOperator.publicKey.toBase58());
  });

  it("revokes the previous operator immediately and authorizes the replacement", async () => {
    await assert.rejects(
      program.methods
        .metabolizeYield(new BN(1))
        .accountsPartial({
          operator: operator.publicKey,
          owner: owner.publicKey,
          node,
          treasuryPubkey: treasury.publicKey,
          mint,
          sourceToken: source,
          vaultToken: vault,
          treasuryToken,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([operator])
        .rpc(),
    );

    await program.methods
      .metabolizeYield(new BN(100))
      .accountsPartial({
        operator: replacementOperator.publicKey,
        owner: owner.publicKey,
        node,
        treasuryPubkey: treasury.publicKey,
        mint,
        sourceToken: replacementSource,
        vaultToken: vault,
        treasuryToken,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([replacementOperator])
      .rpc();

    assert.equal((await getAccount(provider.connection, replacementSource, undefined, TOKEN_2022_PROGRAM_ID)).amount, 0n);
    assert.equal((await getAccount(provider.connection, vault, undefined, TOKEN_2022_PROGRAM_ID)).amount, 85n);
  });
});
