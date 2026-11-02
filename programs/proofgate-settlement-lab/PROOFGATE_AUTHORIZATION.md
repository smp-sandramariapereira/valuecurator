# ProofGate authorization V1

The Settlement Lab settles a swap only when the owner signed the Solana transaction and the previous instruction is an Ed25519 verification of the authorization for that same operation. Neither signature replaces the other. `REVIEWABLE` is not an input.

## Trust model

| Role | Who | What they can do |
| --- | --- | --- |
| Config initializer | Program constant `BMa9qun9QuCceSgozPtPNwQarro5CvQ63Twv3jDWcY8a` | Create the single `["proofgate-config"]` account. The secret stays in `programs/.local-keys/` and is not the policy signer. |
| Admin authority | The initializer, stored on the config | Pause authorizations, change `policy_version`, advance `authorization_epoch`, rotate the policy signer. |
| Policy signer | A key stored on the config, different from the admin | Sign authorization digests. The test fixture generates this key in memory. It is not the owner and not the pool admin. |
| Owner | The mandate owner | Sign the swap transaction and pause their own mandate or portfolio. They cannot withdraw a completed swap. |
| Pool admin | The pool PDA's admin | Fund and, only while the pool is paused, withdraw that pool's reserves. |
| Revocation | Admin, by advancing `authorization_epoch` | Every authorization carrying the previous epoch stops matching the message the program rebuilds. Rotating the policy signer also advances the epoch. |

A user cannot register their own ProofGate authority. `execute_swap` loads the config from the seeds `["proofgate-config"]` and the initializer check rejects every other creator. An account that merely has the same fields is not accepted.

The SVM does not give a program the cluster genesis hash. The deployment identity is the 32-byte `deployment_id` written once, by the initializer, into the config. This run uses 32 bytes of value `0x07`. It is not the string `devnet` supplied by the client. Another installation has another config and another id, so an authorization does not travel between them.

## Canonical authorization

Domain, UTF-8, with no length prefix: `proofgate-settlement-lab/authorization-v1`.

Then, in this order, little-endian integers, no JSON and no floating point:

| Field | Size |
| --- | --- |
| schema version | 1 byte, value `1` |
| program id | 32 |
| deployment id | 32 |
| proofgate config | 32 |
| policy signer | 32 |
| policy version | u64 |
| authorization epoch | u64 |
| owner | 32 |
| mandate | 32 |
| pool | 32 |
| input mint | 32 |
| output mint | 32 |
| token program | 32 |
| amount in | u64 |
| minimum amount out | u64 |
| quoted rate numerator | u64 |
| quoted rate denominator | u64 |
| evidence digest | 32 |
| proposal digest | 32 |
| execution digest | 32 |
| nonce | u64 |
| issued at | i64 |
| expires at | i64 |

The encoding is 530 bytes. Rust `authorization_message` and JavaScript `canonicalAuthorization` produce the same bytes. The shared vector hashes to `79f797722d8826bb42c40785417d33c6d3e58867e3ca6caddded9d3b8d0b31f3`. Changing any one of program id, deployment id, amount, evidence digest, proposal digest, or nonce changes the hash. The host test and the Surfpool suite both check that vector before sending a transaction.

## What is signed

A legacy Solana transaction holds 1232 bytes. The 530-byte canonical message, the Ed25519 public key and signature, and the swap accounts do not fit together. The Ed25519 precompile therefore signs the 32-byte SHA-256 of the canonical message. The program rebuilds the 530 bytes from the accounts and arguments it is executing, hashes them, and requires the verified message to be that digest.

The precompile is `Ed25519SigVerify111111111111111111111111111`. The program accepts the previous instruction only when:

- its program id is that precompile and it has no accounts;
- it declares exactly one signature and padding `0`;
- the signature, public key, and message offsets all use instruction index `65535`, meaning the Ed25519 instruction itself;
- the public key is the config's `policy_signer`;
- the message is exactly 32 bytes and equals the rebuilt authorization digest.

A valid signature of some other message, a signature by another key, or an Ed25519 instruction whose offsets point at a numeric instruction index are rejected. The client does not send a `signature_verified` flag.

Four values stay distinct:

- Execution digest: SHA-256 of the swap parameters under `proofgate-settlement-lab/execution-v1`. The receipt field `evidence_digest` still stores this hash, at the same offset as before.
- Evidence digest and proposal digest: 32-byte commitments inside the authorization. The program does not recompute them from the Research Lab. It does require that the signed authorization and the executed arguments carry the same bytes.
- Authorization digest: SHA-256 of the 530-byte canonical authorization. The receipt stores it in `authorization_digest`. The Ed25519 signature is over this digest.
- Policy signature: the 64-byte Ed25519 signature inside the precompile instruction.

## Execution

1. `apps/proofgate-authorization-service` decides whether an operation may be signed. The signer runs only after that decision is `AUTHORIZED`, then again after the trusted config is read a second time. The older in-suite fixture still signs the adversarial cases directly; it is not the authorization service.
2. The fixture builds the canonical authorization and its digest.
3. The transaction is `[Ed25519 verify, execute_swap]`. The owner signs the transaction. The policy key does not sign the transaction; it signs the digest.
4. The program checks pause, mandate expiry, the 300-second deadline, and the per-trade cap.
5. It rebuilds the authorization from the executed accounts and arguments and binds the Ed25519 instruction.
6. It checks the authorization window, the pool rate, `minimum_out`, the reserve, and the execution digest.
7. It updates the daily counters and rejects the sum when either cap would break.
8. It transfers input and output with `transfer_checked` and creates the receipt. The receipt seeds remain `["receipt", mandate, nonce]`.

An authorization above the mandate or portfolio cap is still rejected. An operation inside those caps without a matching authorization is rejected. A failed transaction leaves balances, counters, and the new receipt unchanged. Reusing a nonce hits the existing receipt account.

Changing `policy_version` or `authorization_epoch` changes the message the program rebuilds, so previously signed digests no longer match. An ordinary `set_policy_version` now requires `new_policy_version > current_policy_version` and increments `authorization_epoch`. An equal or lower version returns `PolicyRegression` and leaves both fields unchanged. Signer rotation and `advance_authorization_epoch` also increment the epoch. Pause and resume do not change version or epoch, and they do not reverse a swap that already landed. This phase has no policy rollback.

## Limits

The lab program does not verify the Research Lab, an oracle, or a `REVIEWABLE` decision. The off-chain service in `apps/proofgate-authorization-service` is a local deterministic boundary, not a production signer and not an authenticated public API. The dashboard is not connected. There is no public deploy and no real-asset settlement. The admin cannot lower `policy_version`. The admin can still rotate the policy signer, advance the epoch, and pause. The genesis hash is not read on-chain. SHA-256 is the binding between the canonical bytes and the 32 bytes the precompile signs. A valid signature shows that the configured policy key signed that digest. It does not, by itself, prove the off-chain process stayed honest if that key is exposed.
