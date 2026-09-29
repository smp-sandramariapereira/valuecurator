# AI execution policy

The AI advisor is an off-chain, non-custodial decision gate. It can return only
`execute` or `defer`; it cannot construct instructions or change the router,
mints, accounts, amount, or minimum output enforced by the Solana program.

## Modes

- `off`: no model request; deterministic strategy execution.
- `shadow`: records model decisions but never blocks execution. Advisor failures
  are logged and execution continues.
- `enforce`: executes only an `execute` decision at or above
  `KAIROS_AI_MIN_CONFIDENCE`. Timeouts, malformed output, and HTTP failures fail closed.

Start every new model in `shadow`. Promote it only after evaluating a representative
window with `pnpm --dir agent evaluate:shadow [path]`. The append-only JSONL log
correlates each decision to a succeeded, failed, or deferred execution without storing
keys, credentials, signatures before broadcast, or raw transactions.

## Request contract

The agent sends only bounded public execution features: mint addresses, input,
expected and minimum output, quoted price impact, route hops, and slippage. The model
returns `decision`, `confidence`, a short `reason`, and `modelVersion`.

Operator private keys, seed phrases, RPC credentials, and raw transactions must never
be sent to the advisor. Unknown values are rejected; remote endpoints must use HTTPS.

## Independent safety boundary

AI output remains subordinate to:

1. operator authorization and the fixed Jupiter v6 program;
2. allowlisted output mint and realized minimum output;
3. per-swap and UTC daily input limits;
4. a persistent consecutive-failure circuit breaker and cooldown.

Risk state is written atomically and survives restarts. Amount limits use raw token
units and must be calibrated to the configured mint decimals before deployment.
