# ProofGate Settlement Lab — isolated Anchor workspace

**Experimental only; not deployed.** This root-level Anchor workspace is
separate from `apps/web/Cargo.toml` and the deployed KAIROS Engine. No KAIROS
program, Program ID, vault or existing instruction is modified.

The separate package intentionally does not register a new deployable Program ID
yet. The temporary `declare_id!` in Rust is a **build-only placeholder** and
must be replaced through a reviewed key-generation and Anchor key-sync procedure
before any Devnet deployment. Do not commit deploy keypairs.

## Build prerequisites

- Pin compatible Rust/Solana/Anchor CLI versions after an isolated build.
- `cd programs && cargo test -p proofgate-settlement-lab`
- `cd programs && cargo check -p proofgate-settlement-lab`
- Before deployment: generate a fresh unique program keypair with controlled
  authority, synchronize the Program ID, run Anchor local-validator integration
  tests, and document the upgrade authority.
- Do not deploy without passing the gates in `docs/icmlab/THREAT_MODEL.md`.

This stage implements SPL Token (classic) only. **Token-2022 extensions, live
oracles and any RWA ownership rights are intentionally unsupported**.
