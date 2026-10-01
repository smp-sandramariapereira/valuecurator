# Monorepo notes

## Layout

- `apps/web` — ValueCurator / KAIROS Next.js frontend (formerly `KAIROS-Engine`)
- `apps/discovery-api` — Discovery Agent Fastify API (formerly `valuecurator-discovery-agent`)
- `apps/web/agent` — metabolic agent package (`@kairos/metabolic-agent`), nested under web
- `packages/discovery-contracts` — shared Discovery contracts
- `infra/` — reserved for Compose / deployment scaffolding (PostgreSQL next)
- `docs/` — monorepo-level notes

## Package manager

Use **pnpm** from the repository root. Nested `package-lock.json` / app-level
`pnpm-lock.yaml` files are obsolete after root workspace install.

## Persistence

Discovery API storage is selected at process start:

- default / tests: `InMemorySessionRepository`
- runtime Postgres: `DATABASE_URL` + `SESSION_STORE=postgres` with Drizzle migrations under `apps/discovery-api/drizzle/`
- Compose: `infra/docker-compose.yml`
