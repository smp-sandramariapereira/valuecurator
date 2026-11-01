# ICM Lab — Stage 0 baseline (2026-11-01)

Branch: `feature/proofgate-multiasset-devnet-e2e`. This is a documentation-only baseline; no deployment or runtime change is authorized by this document.

## Repository evidence inspected
- `README.md`, `apps/web/README.md`: ValueCurator 0.1.0 public approval-only demonstration; AAPLx Mainnet market evidence is read-only and custody transactions are Devnet only.
- `apps/web/agent/src/check-market.ts`: `AAPLx` default symbol, Pyth Pro schema-1 feed config, Mainnet USDC and Jupiter quote, no wallet/transaction.
- `apps/web/agent/src/propose-execution.ts`: immutable proposal verification; logs `APPROVAL ONLY` and no transaction.
- `apps/web/programs/kairos-engine/src/instructions/initialize_node.rs`: PDA derived from `[NODE_SEED, owner]`; one `strategy_mint` stored per node. One owner cannot independently initialize multiple such PDAs using this seed design.
- `apps/web/programs/kairos-engine/src/instructions/execute_strategy_swap.rs`: output mint must equal node's `strategy_mint`, and CPI executable account is pinned to Jupiter v6 program ID. **Do not assume it runs on Devnet.**
- `apps/web/docs/EXECUTION_LIFECYCLE.md`: Mainnet trade execution must remain disabled pending security and network checks.
- `apps/web/SECURITY.md`: prior deploy key exposure in history is documented; real keys and current upgrade authority require verification/rotation planning.
- Root `package.json`: scripts include `pnpm test`, `pnpm test:agent`, `pnpm typecheck`, `pnpm build`, `pnpm security:check`.
- Agent package scripts include `evaluate:shadow`, `evaluate:market`, `check:market`, `propose:execution`, `verify:approval`.

## What was NOT verified
- No tests or builds were executed in this stage.
- No live RPC confirmation, upgrade-authority inspection, key rotation, security audit, Devnet transaction, or dataset quality evaluation was performed.
- No external RWA token mint/issuer eligibility or price-feed coverage beyond existing documentation was authenticated.

## Invariants to preserve
1. Mainnet remains read-only and AAPLx `APPROVAL_ONLY`. Never remove execution locks by switching a UI flag.
2. Do not modify/redeploy the existing KAIROS program or Program ID as part of the Stage 0 or the isolated Settlement Lab.
3. AI never receives signing keys and cannot authorize capital movement.
4. Owner and operator remain distinct; owner authorizes exact proposal; missing evidence fails closed under applicable policy.
5. Devnet synthetic tokens are not real shares, not legal title, and have no financial value.
6. A public price dataset, a synthetic quote, and a verified oracle report have distinct assurance levels.
7. A wallet signature and an off-chain approval receipt are not sufficient on their own unless the settlement program enforces the binding on-chain.

## Next-stage acceptance gates
- Stage 1: registry asset IDs / verified issuer + mint / cluster separation; add asset by data/config without hardcoding new ticker.
- Stage 2: dataset revision, record digest, license, timestamp, leakage checks, reproducible metrics; XA7 relevance labels must not be mislabeled as sentiment.
- Stage 3: versioned canonical evidence envelope; policy-specific oracle requirements; fail-closed and quote/price provenance; authenticated approval binding.
- Stage 4: separately deployed Devnet lab program; transaction checks for account owner, allowed mints, signer, immutable proposal digest, nonce, expiry, min output, budgets, fees, pause/recovery, and replay prevention; adversarial Anchor tests.
- Stage 5: dashboard indicates `SIMULATED`, `APPROVED`, `BLOCKED`, `EXECUTED`, `FAILED` accurately; only chain-confirmed settled operations consume quotas; show balances/slot/signature and prevent UI-only bypass.

## Baseline commands for a trusted checkout (not executed here)
```bash
pnpm install --frozen-lockfile
pnpm security:check
pnpm test
pnpm test:agent
pnpm typecheck
pnpm build
# separately, from the Anchor workspace in apps/web:
# pnpm test:e2e  # verify the exact script and local validator prerequisites first
```

Record SHA, toolchain versions, pass/fail, and CI URLs on execution. Do not store real API keys or private keys in experiment fixtures.
