# ValueCurator

Evidence-gated authorization infrastructure for autonomous finance on Solana.

**Core principle:** AI advises. Evidence proves. Policy authorizes. The owner controls the capital.

Operational autonomy must never imply sovereignty over capital. AI must not hold keys, alter custody, or bypass deterministic authorization policy.

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

pnpm test             # Discovery API vitest suite
pnpm typecheck        # contracts + discovery-api + metabolic agent
pnpm build            # contracts, discovery-api, web
```

Run web and Discovery API in separate terminals. Customer discovery UI: `/interview`.

## Notes

- Discovery storage remains `InMemorySessionRepository` (persistence is the next milestone).
- Original standalone repos (`KAIROS-Engine`, `valuecurator-discovery-agent`) are not modified by this monorepo.
