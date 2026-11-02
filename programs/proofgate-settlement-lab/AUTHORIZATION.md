# Settlement Lab authorization boundary

This note covers the isolated program in `programs/proofgate-settlement-lab`.
It does not describe KAIROS, and it does not treat a ProofGate `REVIEWABLE`
result as permission to move tokens.

## What the program verifies

`execute_swap` accepts the swap only when all of the following hold inside
the program:

- The transaction signer is the owner stored on the mandate and the portfolio.
  The mandate PDA is derived from that owner and the pool. The portfolio PDA
  is derived from that owner and the input mint.
- The pool, mandate, and portfolio are unpaused. The mandate `expires_at` is
  still in the future. The instruction deadline is within 300 seconds.
- `amount_in` is within the mandate per-trade cap. After the daily counters
  advance, both the mandate and the portfolio daily caps still hold. Those
  counters move in the same transaction as the transfers.
- The quoted rate equals the rate stored on the pool. Output is
  `amount_in * rate_numerator / rate_denominator`, in integer base units,
  rounded down. `minimum_out` cannot exceed that output. The pool's output
  vault must already contain it.
- The input and output mints are the pool's mints. Transfers use the classic
  SPL Token program and `transfer_checked`.
- The receipt PDA is `["receipt", mandate, nonce]`. Creating it in this
  transaction consumes the nonce. A second transaction with the same nonce
  cannot create it again.
- The program hashes the parameters it is about to execute: program id,
  owner, pool, mandate, both mints, amount in, amount out, minimum out,
  nonce, deadline, and both rate integers. The domain prefix is the UTF-8
  string `proofgate-settlement-lab/execution-v1`. The client digest must
  equal that hash. The receipt stores the program's hash. This execution
  digest is not a ProofGate approval.
- The instruction immediately before the swap is one Ed25519 verification
  by the policy signer stored in the singleton `["proofgate-config"]`
  account. The signed message is the SHA-256 of the canonical authorization
  reconstructed from this swap. The schema, the trust root, and the reason
  the precompile signs the digest are in `PROOFGATE_AUTHORIZATION.md`.

A direct RPC call has to satisfy the same checks. The owner signature does
not replace the ProofGate authorization, and the ProofGate authorization
does not replace the owner signature, the mandate limits, or the pause.

## What remains outside the program

The program verifies a signature from the configured policy signer. It does
not read the Research Lab, the asset catalog, or a `REVIEWABLE` decision.
It does not verify an oracle signature, a market price, or the words
`REVIEWABLE` and `BLOCKED`. Any classic SPL mint pair can be initialized by
the pool admin. The synthetic names dUSDC and dAAPL exist in the local test,
not in the account data.

The digest binds the executed numbers. It does not prove that an off-chain
policy approved them.

## Custody model

The lab is an administered experimental pool. Users do not leave a deposit
that the program owes back.

- The owner keeps both token balances until `execute_swap`.
- That instruction transfers input into the pool vault and output out of the
  pool vault in the same transaction. A rejected swap leaves both balances
  and both spent counters unchanged.
- After a successful swap, the input tokens are the admin counterparty's
  reserve. The owner has no instruction that redeems them. Adding one would
  allow a second claim on an already completed exchange.
- `withdraw_input_reserve` and `withdraw_output_reserve` require the pool
  admin's signature, a paused pool, the classic SPL Token program, and the
  pool PDA as the vault authority. The destination token account must be
  owned by that same admin and must use the vault's mint. The vault itself
  must be the associated token account of that pool. Another pool's vault,
  another mint, or a user wallet does not satisfy those constraints.
- Pause blocks new swaps. It does not reverse a swap that already landed.
- The admin can still pause and withdraw the reserves. That authority is the
  counterparty's recovery path, not a user-sovereign vault.
