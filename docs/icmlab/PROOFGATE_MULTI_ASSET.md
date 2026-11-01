# Stage 3 — ProofGate multiasset off-chain review

**Status:** implemented as a stand-alone review policy in the feature branch. **Not an approval or execution feature.**

## Scope and integration

- `apps/web/agent/src/multiasset-proofgate.ts`: deterministic, off-chain evaluation of Devnet-only synthetic proposals, per-asset and portfolio-wide input caps, mandatorily matching mint/asset identity and quote parameters, expiry and data-age checks, and research envelope quarantine. Outputs `REVIEWABLE` or `BLOCKED`; **`executionEnabled: false` in all outcomes**.
- `apps/web/agent/src/multiasset-proofgate.test.ts`: tests for allowed review, unknown assets, unsupported/unverified registry state, mismatched mints, stale evidence, slippage, risk, oracle enforcement and corrupted research mode.

### Source-policy controls
- `DEVNET_LAB` + explicit `oracleRequired: false` may accept a quote marked `SYNTHETIC_TEST`, but **only for review**.
- `DEVNET_LAB` + `oracleRequired: true` blocks synthetic quotes.
- `PRICE_PROTECTED` requires an authenticated oracle **and remains blocked** until a trusted verification adapter is implemented.
- A caller string `AUTHENTICATED_ORACLE` is **not a signature check**. Current implementation rejects it, rather than allowing spoofing.
- Mainnet AAPLx `APPROVAL_ONLY` remains unchanged, as do the current oracle-contracts and existing KAIROS program.

### Research Lab adapter
The evaluator can accept the `research-relevance-v1` summary exported by `apps/research-lab/pipeline.py`. It checks that results remain `RESEARCH_ONLY`, never authorize execution and contain an asset association. The research digest is included in the review decision; classification predictions **do not** become BUY/SELL orders.

### Limitation and trust boundary
This is an isolated stage-3 library. It is **not yet wired to live dashboard state, persistent risk storage, wallet approval or an Anchor program**. Any registry or risk snapshot supplied by an external caller must be authenticated/validated by the future server and ultimately rechecked at the on-chain settlement boundary. Off-chain review does not protect funds.

### Test command (not verified in this GitHub-only change)
```bash
pnpm --filter @kairos/metabolic-agent test
pnpm typecheck
pnpm security:check
```

## Gates for Stage 4
1. Define mandate signatures, canonical serialisation, signer matrix and replay-resistance.
2. Bind program ID, chain identity, owner, mandate, mints, amount, quote digest, expiry and nonce.
3. Implement isolated Anchor Devnet settlement and reserves, with on-chain independent validation.
4. Provision valueless Devnet mints only after keys/upgrade authorities are reviewed.
5. Run adversarial tests; do not treat `REVIEWABLE` as `APPROVED` or `EXECUTED`.
