# ICM Lab — Security threat model and review checklist

**Status: design-only; no tests or runtime changes performed.** The lab uses valueless Devnet assets but should model production-grade invariants.

| Threat | Required control / test |
| --- | --- |
| AI/operator moves capital autonomously | Separate owner authorization; never provide AI with keys; program validates signing authority. |
| Substitution of RWA ticker/mint | Bind `asset_id`, cluster, token program, input/output mint, decimals, owner mandate to authorization; registry allowlist. |
| Cross-network replay | Domain-separated payload with genesis/cluster, program ID, expiry and unique nonce. |
| Replayed or modified proposal | Canonical digest + nonce consumed atomically + test altered quantities/mints/quote. |
| Stale/missing/malicious price | Fail closed when required; synthetic quote only in explicit Devnet test mandate with bounded size. |
| Forged confidence/provenance | Distinguish signed provider attestation from off-chain labels and hashes; verify attestations if relied on by on-chain policy. |
| Operator swaps directly, bypassing UI | Enforcement of mandate / owner authorization within Anchor, even when called via raw RPC. |
| Vault substitution / token account confusion | Check seeds, bumps, token-account mint, owner, program IDs, and account data before transfers. |
| Fee extraction or excessive slippage | Signed fee bounds, integer checked math, minimum output, exact-input checks and post-transfer balance invariants. |
| Double execution / failed transaction quota | Atomic nonce/risk state update; debit only for successful settlement. |
| Cross-tenant asset theft | Two unrelated owners; ensure no cross-mandate vault authority or shareable nonce. |
| Compromised deployment/upgrade key | Existing SECURITY.md documents exposed historical key; verify authorities, rotate/redeploy where necessary before trusting any program for value. |
| Faulty token extensions | Restrict supported Token-2022 extensions, malicious transfer hooks, transfer fees, freeze authorities; test or reject unknown behavior. |
| Fake news, poisoned datasets, data leakage | Pin licenses/revisions/hashes, dedupe; chronological splits and out-of-sample tests. |
| Operational outages | Retry policy, RPC confirmation/reconciliation, pause authority and bounded test funds. |

## Hard security gates before implementing transactions
1. Written account schema and signer/authority matrix reviewed.
2. All token mints and test reserves are explicitly Devnet and synthetic.
3. No dependency on the current `execute_strategy_swap` Jupiter v6 CPI for Devnet.
4. On-chain approval binding & nonce mechanism selected, specified and adversarially tested.
5. Anchor integration tests cover expiry, bad signer, stale mandatory quote, wrong mint, duplicate nonce, cross-owner attacks, slippage, unexpected token programs/extensions, vault drain, pause and recovery.
6. Recheck `apps/web/SECURITY.md` and effective upgrade authority; record result without exporting keys.
7. No automatic promotion to Mainnet; a separate audit/security and regulatory decision is mandatory.
