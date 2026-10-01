# Infrastructure

## PostgreSQL (Discovery API)

```bash
# from repo root
pnpm db:up
```

Connection string (default Compose credentials):

```text
postgresql://valuecurator:valuecurator@127.0.0.1:5432/valuecurator_discovery
```

Apply migrations:

```bash
DATABASE_URL=postgresql://valuecurator:valuecurator@127.0.0.1:5432/valuecurator_discovery \
  pnpm db:migrate
```

On a machine without Docker, the same tables can live in a local file database. Set `SESSION_STORE=pglite` and `PGLITE_DATA_DIR=.data/discovery` in `apps/discovery-api/.env`. That directory is gitignored. Interviews remain after the API restarts.

Configure `apps/discovery-api/.env` for Docker Postgres:

```env
DATABASE_URL=postgresql://valuecurator:valuecurator@127.0.0.1:5432/valuecurator_discovery
SESSION_STORE=postgres
```

Stop:

```bash
pnpm db:down
```
