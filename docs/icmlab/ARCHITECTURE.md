# ICM Lab — Multi-asset evidence-gated Devnet lab (design proposal)

**Status:** proposed, not implemented. Stage 0 only.

## Goals
Enable an owner to choose multiple *eligible* RWA reference assets (stocks, ETFs later), obtain public-data/optional-oracle evidence, receive AI-originated proposals, apply deterministic ProofGate policies, sign an exact authorized proposal, and settle an isolated synthetic token trade on Solana Devnet. All artifacts must support independent verification.

## Trust boundaries
```text
Asset catalog (untrusted discovery) -> verified registry (approved asset IDs, mints and networks)
Public news / historical OHLCV / Pyth -> versioned evidence snapshots (provenance/quality)
AI Research Lab (untrusted signal) -> ProofGate off-chain policy and audit
                         -> exact owner-authorized proposal
                         -> isolated Anchor Devnet Settlement Lab (independent on-chain invariants)
                         -> confirmed token balances / signatures / reconciled receipt
```

### Asset identity
Use `asset_id` distinct from ticker and distinct from mint address. Store class, issuer/source provenance, network-specific mint, token program, decimals, feed IDs and source coverage, registry verification status, quote asset, and feature flags per environment. Selection is not authorization: only the owner's allowlist and executable supported mints permit settlement. No arbitrary mint address paste into executable mandate. Devnet symbols such as dAAPL/dNVDA are **synthetic test-token names**, not tokenized stock ownership.

### Evidence
Record `dataset_id`, pinned revision/hash, observation timestamps, relevant symbol mapping, model version/digest, signal, price/quote source, price timestamp, age, confidence (if supported), policy version, cluster, issuer/asset mapping and canonical evidence digest.
Profiles:
- `RESEARCH`: datasets/market history; no settlement.
- `DEVNET_LAB`: synthetic quotes permitted only under explicit test-mandate policy and bounded test amounts; oracle optional.
- `PRICE_PROTECTED`: authenticated reference evidence is mandatory per policy, or explicitly preapproved equivalent; missing/expired invalid data blocks.
- `MAINNET_READ_ONLY`: preserve current AAPLx path; no real transaction.
A public data hash proves integrity of submitted content, **not real-world accuracy** or right to trade. A signed owner-posted reference does not automatically mean a Pyth-verified oracle report.

### Separate programs
**Existing KAIROS** remains unchanged, with its original one-strategy-mint-per-owner-node semantics and pinned Jupiter route. A separate Devnet Settlement Lab will have its own Program ID, independent custody authorities and mint-pair allowlists. Do not assume it can spend existing KAIROS vault balances. A future linkage is a separately reviewed migration/change.

**Proposed accounts:** lab configuration authority, mandate PDA derived from owner + mandate ID, per-mandate mint allowance or bounded array, reserve vaults, nonces/receipts, pause and emergency recovery authority. Analyze account sizing, rent, token extensions and compute budget before coding.

**Execution requirements:** sign a canonical payload binding program ID, cluster/genesis, owner, operator, mandate ID/version, input/output mint, token program, amount in, min out, quote/evidence digest, expiry, nonce, fee terms. The Anchor instruction independently verifies applicable signatures/authority, reserves, expiry, nonce uniqueness, allowed token accounts/mints/programs, exposure/risk budget and post-transfer invariants; no AI access to keys. Use checked integer arithmetic. Atomic swap is a lab transfer against pre-funded test liquidity, **not** Jupiter/Mainnet liquidity or a real equity trade.

### Event / status semantics
`PROPOSED` -> `BLOCKED` or `APPROVED` -> `SUBMITTED` -> `EXECUTED` / `FAILED`. Receipt must include evidence hash, policy version, approval method, transaction signature, slot, pre/post balances, and source-mode label. Charge quota only on confirmed settled operations; reconciliation must tolerate RPC retry/reorg failure. Client-only blocking does not count as on-chain enforcement.

## Non-goals in this phase
Mainnet order execution, investment returns claims, full asset issuance rights, legal share tokenization, custody of real funds, production AMM, arbitrary RWA listings, or artifact-tokenization marketplace.

## Next implementation slices
1. Asset Registry and UI read-only multiasset selection.
2. Research Lab versioned public datasets and evaluation.
3. Evidence-policy contract + ProofGate multiasset limits, with backwards-compatible AAPLx support.
4. Devnet isolated program + SDK + tests and test mint provisioning.
5. End-to-end dashboard and auditable replayable experiment report.
