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

Configure `apps/discovery-api/.env`:

```env
DATABASE_URL=postgresql://valuecurator:valuecurator@127.0.0.1:5432/valuecurator_discovery
SESSION_STORE=postgres
```

Stop:

```bash
pnpm db:down
```
