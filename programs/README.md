# ProofGate Settlement Lab — isolated Anchor workspace

**Experimental only; not deployed.** This root-level Anchor workspace is
separate from `apps/web/Cargo.toml` and the deployed KAIROS Engine. No KAIROS
program, Program ID, vault or existing instruction is modified.

The local Surfpool identity is `CJ2NA3E8ZWZFMjrLtzAKxGZNomLBP4Tvnh8hQiFD3ecA`.
Its secret is `programs/.local-keys/proofgate-settlement-lab-keypair.json`,
which Git ignores. That identity is for the offline simulator only. Do not
deploy it to public Devnet, and do not reuse the KAIROS program id.

What the program checks, and what ProofGate still has to check off-chain, is
separated in `proofgate-settlement-lab/AUTHORIZATION.md`.

## Build prerequisites

- Pin compatible Rust/Solana/Anchor CLI versions after an isolated build.
- `cd programs && cargo test -p proofgate-settlement-lab`
- `cd programs && CARGO_TARGET_DIR="$PWD/target" cargo-build-sbf --manifest-path proofgate-settlement-lab/Cargo.toml`
- Offline Surfpool suite, after the `.so` exists: `node settlement-lab-tests/run.mjs`
  from `programs/`. The suite binds `127.0.0.1` and refuses any other RPC.
- Do not deploy without passing the gates in `docs/icmlab/THREAT_MODEL.md`.

This stage implements SPL Token (classic) only. **Token-2022 extensions, live
oracles and any RWA ownership rights are intentionally unsupported**.
