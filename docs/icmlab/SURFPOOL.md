# Surfpool testing profiles — ValueCurator / ICM Lab

**Feature branch only. No automatic deployment or signing.** Profiles run independent of the existing `apps/web/Anchor.toml`; KAIROS program settings remain unchanged.

## Requirements

- Node.js >= 20.18 and pnpm 9.15.9 (for root package scripts)
- Surfpool installed and available as `surfpool` on PATH
- To build the separate Settlement Lab: compatible Rust, Anchor and Solana toolchain, plus fresh deployment key/ID before any real deploy

The Surfpool flags are documented at https://solana.com/docs/tools/surfpool/toolchain/cli. Profiles deliberately use `--no-deploy` because automatic runbooks and changing the existing KAIROS identity are out of scope.

## Profiles

From the **repository root**:

| Command | Role | Effect |
| --- | --- | --- |
| `pnpm surfpool:local` | Offline isolated Surfpool | Starts local RPC :8899, no remote fetch and no auto-deploy |
| `pnpm surfpool:devnet-fork` | Devnet datasource simulator | Starts local RPC :8899, may clone Devnet accounts, no public Devnet transactions, no auto-deploy |
| `pnpm surfpool:local:check` | Local RPC | Read-only `getVersion` against localhost:8899 |
| `pnpm surfpool:devnet:check` | Public Devnet RPC | Read-only `getVersion` against https://api.devnet.solana.com |
| `pnpm surfpool:test` | Script tests | Node unit tests, no Surfpool daemon or network access |

**Run only one Surfpool instance on :8899 at a time.** Stop with Ctrl+C. The command holds the terminal while the simulator runs. Use a second terminal to issue test RPC calls.

When working with an already-running Surfpool, a separate Solana CLI can target it without modifying global configuration:

```bash
solana --url http://127.0.0.1:8899 cluster-version
```

For public Devnet, use an explicit URL in each read-only command:

```bash
solana --url https://api.devnet.solana.com cluster-version
```

The scripts do **not** run `solana config set`, manage SOL keys or sign transactions.

## Critical limitations

- Surfpool forks *account state* from Devnet; it is **not** public Devnet and produces no public-chain signatures or Explorer records.
- `--no-deploy` intentionally prevents automatic program deployment; future local E2E test harnesses must explicitly deploy a **reviewed, correctly keyed** program binary into the simulation.
- The separate `programs/proofgate-settlement-lab` currently uses a **placeholder** program ID. Do not deploy that identity; generate a fresh keypair in approved secret storage, synchronize Rust/Anchor configuration, and review upgrade authorities.
- Current Stage 4 settlement Rust code has not passed cargo check/Anchor security integration tests and remains unsuitable for deploy.
- No tokens are currently provisioned by these scripts. They do not run swaps.
- No Mainnet write or real-world RWA execution is supported.

## Acceptance

```bash
pnpm surfpool:test
# terminal A
pnpm surfpool:local
# terminal B
pnpm surfpool:local:check
# after stopping A:
pnpm surfpool:devnet-fork
# another terminal:
pnpm surfpool:local:check
pnpm surfpool:devnet:check
```

Do not treat the connectivity tests as Settlement Lab integration tests. Those must separately prove owner signature, nonce replay protection, daily quotas, reserve custody, slippage, and rollback.
