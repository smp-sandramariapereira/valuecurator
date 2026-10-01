# ValueCurator

Evidence-gated authorization infrastructure for autonomous finance on Solana.

**Core principle:** AI advises. Evidence proves. Policy authorizes. The owner controls the capital.

Operational autonomy must never imply sovereignty over capital. AI must not hold keys, alter custody, or bypass deterministic authorization policy.

## Colosseum demo

Program on Devnet. AAPLx evidence is a mainnet read. No AAPLx transaction is submitted. No mainnet deployment.

| Cluster | What a reviewer opens | Ledger |
| --- | --- | --- |
| Devnet | Program `6owAcXj4FxJom96cEX9CSFjGrg6zp4U8atTjrpCUMiW5`, node PDA, `initialize_node`, `metabolize_yield`, `emergency_withdraw`, and a `metabolize_yield` rejected with `UnauthorizedOperator` | Instructions land here |
| Mainnet | AAPLx mint `XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp`, Pyth feed `922`, Jupiter USDC → AAPLx quote | Read only |

The rejected Devnet transaction is [`2sFHnWWS…A1dn`](https://explorer.solana.com/tx/2sFHnWWSCMqNykUGmsmuyZaiM3Rjt82dFtZxHQx4d81gzmhxATLmp48DQvKfSuPTBngHPi3PaAWSgFYrBwAcA1dn?cluster=devnet). The local dashboard lists it next to the three custody signatures. Signatures, the mandate walkthrough, and the owner/operator split are documented in [`apps/web/README.md`](apps/web/README.md).

`https://www.valuecurator.xyz` is the public product URL. It does not yet serve this October demo UI. Publish that build before judges review the site.

## Repository structure

```
apps/web                 Next.js frontend (KAIROS Engine UI + /interview)
apps/discovery-api       Discovery Agent API (wallet auth, interview, evidence)
apps/web/agent           Metabolic agent package (@kairos/metabolic-agent)
packages/discovery-contracts   Shared Discovery transport contracts
infra/                   Reserved for local infrastructure (e.g. Postgres)
docs/                    Monorepo notes
```

App-specific details remain in each app’s own README.

## Prerequisites

- Node.js `>=20.18`
- [pnpm](https://pnpm.io) `9.x` (repo pins `packageManager`)

## Install

From the repository root:

```bash
pnpm install
```

Build shared contracts once (required before Discovery API typecheck/build):

```bash
pnpm --filter @valuecurator/discovery-contracts build
```

## Environment

Copy examples; do not commit real secrets.

| App | Example file |
|-----|----------------|
| Root overview | `.env.example` |
| Web | `apps/web/.env.example` → `apps/web/.env.local` |
| Discovery API | `apps/discovery-api/.env.example` → `apps/discovery-api/.env` |
| Metabolic agent | `apps/web/agent/.env.example` |

Local development defaults:

- Web: `http://127.0.0.1:43147`
- Discovery API: `http://localhost:3001`
- `NEXT_PUBLIC_DISCOVERY_API_URL=http://localhost:3001`
- `CORS_ORIGIN=http://127.0.0.1:43147`

## Scripts (from root)

```bash
pnpm dev:discovery    # Discovery API on :3001
pnpm dev:web          # Next.js on 127.0.0.1:43147

pnpm db:up            # Postgres via Docker Compose (infra/)
pnpm db:migrate       # Apply Drizzle migrations (requires DATABASE_URL)
pnpm test             # Discovery unit + persistence integration tests
pnpm typecheck        # contracts + discovery-api + metabolic agent
pnpm build            # contracts, discovery-api, web
```

Run web and Discovery API in separate terminals. Customer discovery UI: `/interview`.

## Notes

- Discovery persistence defaults to in-memory. Set `DATABASE_URL` + `SESSION_STORE=postgres` for PostgreSQL via Drizzle (`infra/docker-compose.yml`).
- Unit tests use memory; integration tests use PGlite against the same SQL migrations.
- Original standalone repos (`KAIROS-Engine`, `valuecurator-discovery-agent`) are not modified by this monorepo.
